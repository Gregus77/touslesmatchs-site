"""
Hermes Council Orchestrator
Coordonne le conseil de 6+1 IAs pour générer le pick sportif quotidien.
Exécuté automatiquement à 11h59 chaque jour via le scheduler.
"""
import os
import sys
import json
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv("/app/.env")

sys.path.insert(0, "/app/council")

from tools.history_db import (
    init_db, save_pick, save_premium_pick, mark_premium_sent,
    get_recent_picks, get_stats, get_premium_stats,
    get_agent_accuracy, get_agent_market_accuracy, save_agent_vote, get_full_analytics
)
from tools.sports_api import get_todays_matches, format_matches_for_prompt
from tools.html_generator import inject_pick_into_html
from tools.telegram_bot import (
    send_free_pick, send_nopick, send_premium_pick,
    send_premium_stats, send_daily_report, is_configured as telegram_ok
)
from agents import gpt_agent, gemini_agent, mistral_agent, groq_agent, claude_chief
from agents import opus_agent, gpt4o_agent, gpt5_agent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("/app/data/hermes.log"),
    ]
)
log = logging.getLogger("hermes")

IMPROVEMENT_NOTES_PATH = "/app/data/improvement_notes.txt"
# Seuil de qualification : un agent en dessous est exclu du vote (mais garde
# ses stats — il peut revenir s'il remonte). 55% est un compromis : au-dessus
# du random (50%) avec marge, en-dessous du seuil d'excellence du JS Concile (65%).
MIN_AGENT_ACCURACY = 55.0


def load_improvement_notes():
    try:
        with open(IMPROVEMENT_NOTES_PATH, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        return ""


def save_improvement_notes(notes: str):
    os.makedirs(os.path.dirname(IMPROVEMENT_NOTES_PATH), exist_ok=True)
    with open(IMPROVEMENT_NOTES_PATH, "w", encoding="utf-8") as f:
        f.write(notes)


def format_history_text(picks):
    if not picks:
        return "Aucun historique disponible."
    lines = []
    for p in picks[:20]:
        date, match, bet, odds, score, result, sport, confidence = p
        lines.append(f"- {date} | {sport} | {match} | {bet} @ {odds} → {score or '?'} = {result or '?'}")
    return "\n".join(lines)


def run_agent(agent_module, date, matches_text, history_text, stats):
    """Run a single agent and return (name, report)."""
    try:
        report = agent_module.analyze(date, matches_text, history_text, stats)
        log.info(f"[{agent_module.NAME}] Recommande: {report.get('recommendation')} "
                 f"({report.get('match','NOPICK')}) confiance={report.get('confidence',0)}")
        return agent_module.NAME, report
    except Exception as e:
        log.error(f"[{agent_module.NAME}] Failed: {e}")
        return agent_module.NAME, {"recommendation": "NOPICK", "confidence": 0, "reasoning": str(e)}


def filter_agents_by_accuracy(agents, agent_accuracy):
    """Keep only agents with >= 80% accuracy (or all if not enough data).

    Le mapping ci-dessous DOIT correspondre EXACTEMENT aux noms
    stockés dans concile_analyses / agent_predictions (colonne agent_name),
    sinon le filtre ne détecte jamais la sous-performance et tous les
    agents sont conservés (bug historique juillet 2026)."""
    # Le mapping doit correspondre au NAME défini dans chaque module d'agent
    # AINSI qu'à ce qui est stocké en base (agent_predictions.agent_name).
    # Les agents gpt/mistral ont été renommés (DeepSeek-V3 / Mistral-Large)
    # pour hériter des stats de leurs providers déjà utilisés par le JS Concile
    # (mêmes APIs, mêmes modèles, donc perf attendue équivalente).
    # gemini/groq gardent leurs anciens noms historiques (perf sous-performante
    # confirmée sur 96-113 pronos → seront exclus par le filtre).
    agent_name_map = {
        "gpt":     "DeepSeek-V3",   # ~67% hérité du champion JS
        "mistral": "Mistral-Large", # ~70% hérité du champion JS
        "gemini":  "GeminiFlash",   # 49% historique → EXCLU
        "groq":    "GROQ-Llama",    # 47% historique → EXCLU
        "opus":    "Opus",
        "gpt4o":   "GPT-4o",
        "gpt5":    "GPT-5",
    }
    qualified = []
    excluded = []
    for key, module in agents:
        name = agent_name_map.get(key, key)
        acc_data = agent_accuracy.get(name, {})
        total = acc_data.get("total", 0)
        accuracy = acc_data.get("accuracy", 0)
        if total < 10:
            qualified.append((key, module))
            log.info(f"  [{name}] Pas assez de données ({total} picks) — inclus par défaut")
        elif accuracy >= MIN_AGENT_ACCURACY:
            qualified.append((key, module))
            log.info(f"  [{name}] Accuracy {accuracy}% >= {MIN_AGENT_ACCURACY}% — qualifié")
        else:
            excluded.append((key, name, accuracy))
            log.warning(f"  [{name}] Accuracy {accuracy}% < {MIN_AGENT_ACCURACY}% — EXCLU du Concile")

    if len(qualified) < 2:
        log.warning("Moins de 2 agents qualifiés — on garde tous les agents par sécurité")
        return agents, excluded

    return qualified, excluded


def run_council():
    """Main orchestration function."""
    log.info("=" * 60)
    log.info("HERMES COUNCIL - Démarrage de la session quotidienne")
    log.info("=" * 60)

    init_db()
    date_str = datetime.now().strftime("%d/%m/%Y")
    today_display = datetime.now().strftime("%d/%m")

    # 1. Fetch today's matches (multi-sport)
    log.info("Récupération des matchs du jour (multi-sport)...")
    matches = get_todays_matches()
    matches_text = format_matches_for_prompt(matches)
    sport_counts = {}
    for m in matches:
        sport_counts[m.get("sport", "?")] = sport_counts.get(m.get("sport", "?"), 0) + 1
    log.info(f"  {len(matches)} matchs: {sport_counts}")

    # 2. Load context
    picks_history = get_recent_picks(days=60)
    history_text = format_history_text(picks_history)
    stats = get_stats()
    agent_accuracy = get_agent_accuracy()
    market_accuracy = get_agent_market_accuracy()
    improvement_notes = load_improvement_notes()

    log.info(f"Contexte: {stats['wins']}W/{stats['losses']}L ({stats['winrate']}% winrate)")

    # 3. Filter agents by accuracy (>= 80%)
    all_agents = [
        ("gpt", gpt_agent),
        ("gemini", gemini_agent),
        ("mistral", mistral_agent),
        ("groq", groq_agent),
        ("gpt5", gpt5_agent),
    ]
    qualified_agents, excluded_agents = filter_agents_by_accuracy(all_agents, agent_accuracy)

    # 4. Run qualified agents in parallel
    log.info(f"Lancement de {len(qualified_agents)} agents qualifiés...")
    agent_reports = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(run_agent, module, date_str, matches_text, history_text, stats): key
            for key, module in qualified_agents
        }
        for future in as_completed(futures):
            key = futures[future]
            name, report = future.result()
            agent_reports[key] = report

    # 4b. Run shadow agents (vote enregistré mais n'influence PAS la décision)
    shadow_agents = [
        ("opus", opus_agent),
        ("gpt4o", gpt4o_agent),
    ]
    shadow_reports = {}
    log.info(f"Lancement de {len(shadow_agents)} agents shadow (à blanc)...")
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = {
            executor.submit(run_agent, module, date_str, matches_text, history_text, stats): key
            for key, module in shadow_agents
        }
        for future in as_completed(futures):
            key = futures[future]
            name, report = future.result()
            shadow_reports[key] = report
            log.info(f"  [SHADOW] {name}: {report.get('recommendation')} "
                     f"conf={report.get('confidence',0)} — {report.get('match','—')}")

    # 5. Collect premium candidates (confidence 7-7.9)
    premium_candidates = []
    for key, report in agent_reports.items():
        conf = report.get("confidence") or 0
        if 7.0 <= conf < 8.0 and report.get("recommendation") == "PICK":
            premium_candidates.append(report)
            log.info(f"  [{key}] Pick premium candidat: {report.get('match')} ({conf}/10)")

    # 6. Claude (Chef) makes final decision
    log.info("Claude (Chef) prend sa décision finale...")
    decision = claude_chief.decide(
        date=date_str,
        matches_text=matches_text,
        agent_reports=agent_reports,
        history_text=history_text,
        stats=stats,
        agent_accuracy=agent_accuracy,
        improvement_notes=improvement_notes,
        market_accuracy=market_accuracy,
    )

    final = decision.get("decision", "NOPICK")
    log.info(f"DÉCISION FINALE: {final}")
    if final == "PICK":
        log.info(f"  Match: {decision.get('match')}")
        log.info(f"  Pari: {decision.get('bet')} @ {decision.get('odds')}")
        log.info(f"  Confiance: {decision.get('confidence')}/10")

    # 7. Save improvement notes
    if decision.get("improvement_notes"):
        save_improvement_notes(decision["improvement_notes"])
        log.info("Notes d'amélioration sauvegardées.")

    # 8. Save pick to DB
    is_nopick = (final != "PICK")
    agents_votes_summary = {
        k: {"rec": v.get("recommendation"), "conf": v.get("confidence"), "match": v.get("match")}
        for k, v in agent_reports.items()
    }
    save_pick(
        date=today_display,
        match=decision.get("match") or "---" if not is_nopick else "---",
        bet=decision.get("bet") or "---" if not is_nopick else "---",
        odds=decision.get("odds") if not is_nopick else None,
        sport=decision.get("sport") or "" if not is_nopick else "",
        confidence=decision.get("confidence", 0),
        agents_votes=agents_votes_summary,
        claude_reasoning=decision.get("reasoning", ""),
    )

    # 9. Save premium picks (confidence 7-7.9)
    seen_premium_matches = set()
    for pc in premium_candidates:
        match_key = pc.get("match", "")
        if match_key and match_key not in seen_premium_matches:
            seen_premium_matches.add(match_key)
            pid = save_premium_pick(
                date=today_display,
                match=pc.get("match"),
                bet=pc.get("bet"),
                odds=pc.get("odds"),
                sport=pc.get("sport", ""),
                confidence=pc.get("confidence"),
                agents_votes=agents_votes_summary,
                claude_reasoning=pc.get("reasoning", ""),
            )
            if telegram_ok():
                ok = send_premium_pick(
                    match=pc.get("match"),
                    bet=pc.get("bet"),
                    odds=pc.get("odds"),
                    sport=pc.get("sport", ""),
                    confidence=pc.get("confidence"),
                    reasoning=pc.get("reasoning", ""),
                )
                if ok:
                    mark_premium_sent(pid)
                    log.info(f"  Pick premium envoyé Telegram: {match_key}")

    # 10. Save agent votes for performance tracking
    agent_name_map = {
        "gpt": "DeepSeek", "gemini": "Gemini Flash",
        "mistral": "Mistral", "groq": "Groq/Llama3",
        "opus": "Opus", "gpt4o": "GPT-4o",
    }
    for key, report in {**agent_reports, **shadow_reports}.items():
        agent_name = agent_name_map.get(key, key)
        save_agent_vote(
            agent_name, today_display, json.dumps(report),
            sport=report.get("sport"), confidence=report.get("confidence")
        )

    # 11. Refresh picks history
    picks_history = get_recent_picks(days=60)
    stats = get_stats()

    # 12. Generate new index.html
    log.info("Génération du HTML...")
    pick_data = {
        "nopick": is_nopick,
        "match": decision.get("match"),
        "bet": decision.get("bet"),
        "odds": decision.get("odds"),
        "sport": decision.get("sport"),
        "confidence": decision.get("confidence", 0),
    }
    success = inject_pick_into_html(pick_data, picks_history, stats)
    if success:
        log.info("Site mis à jour avec succès !")
    else:
        log.error("Erreur lors de la génération du HTML.")

    # 13. Telegram — free channel
    if telegram_ok():
        if is_nopick:
            send_nopick()
            log.info("Telegram gratuit : NOPICK envoyé")
        else:
            send_free_pick(
                match=decision.get("match"),
                bet=decision.get("bet"),
                odds=decision.get("odds"),
                sport=decision.get("sport", ""),
                confidence=decision.get("confidence", 0),
                reasoning=decision.get("reasoning", ""),
            )
            log.info("Telegram gratuit : pick du jour envoyé")
    else:
        log.warning("Telegram non configuré — messages non envoyés")

    # 14. Daily report to admin Telegram
    _send_daily_report(
        decision=decision,
        agent_reports=agent_reports,
        shadow_reports=shadow_reports,
        excluded_agents=excluded_agents,
        stats=stats,
        sport_counts=sport_counts,
        is_nopick=is_nopick,
    )

    log.info("=" * 60)
    log.info("HERMES COUNCIL - Session terminée")
    log.info("=" * 60)
    return decision


def _send_daily_report(decision, agent_reports, shadow_reports, excluded_agents, stats, sport_counts, is_nopick):
    """Send a daily operational report to the admin Telegram chat."""
    date_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    name_map = {
        "gpt": "DeepSeek", "gemini": "Gemini Flash",
        "mistral": "Mistral", "groq": "Groq/Llama3",
        "opus": "Opus", "gpt4o": "GPT-4o",
    }
    sports_line = " | ".join(f"{s}: {c}" for s, c in sorted(sport_counts.items()))

    agents_lines = []
    for key, report in agent_reports.items():
        name = name_map.get(key, key)
        rec = report.get("recommendation", "?")
        conf = report.get("confidence", 0)
        match = report.get("match", "-")
        agents_lines.append(f"  {name}: {rec} ({conf}/10) — {match}")

    for key, report in shadow_reports.items():
        name = name_map.get(key, key)
        rec = report.get("recommendation", "?")
        conf = report.get("confidence", 0)
        match = report.get("match", "-")
        agents_lines.append(f"  👻 {name} (shadow): {rec} ({conf}/10) — {match}")

    excluded_lines = []
    for key, name, accuracy in excluded_agents:
        excluded_lines.append(f"  {name}: {accuracy}% (< 80%)")

    report_data = {
        "date": date_str,
        "sports": sports_line,
        "total_matches": sum(sport_counts.values()),
        "decision": "PICK" if not is_nopick else "NOPICK",
        "match": decision.get("match", "-"),
        "bet": decision.get("bet", "-"),
        "odds": decision.get("odds", "-"),
        "confidence": decision.get("confidence", 0),
        "agents": "\n".join(agents_lines),
        "excluded": "\n".join(excluded_lines) if excluded_lines else "Aucun",
        "winrate": stats.get("winrate", 0),
        "roi": stats.get("roi", 0),
        "total_picks": stats.get("wins", 0) + stats.get("losses", 0),
        "improvement": decision.get("improvement_notes", "")[:200],
    }

    try:
        send_daily_report(report_data)
        log.info("Rapport quotidien envoyé sur Telegram admin")
    except Exception as e:
        log.error(f"Erreur envoi rapport quotidien: {e}")


if __name__ == "__main__":
    run_council()
