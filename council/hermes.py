"""
Hermes Council Orchestrator
Coordonne le conseil de 5 IAs pour générer le pick sportif quotidien.
Exécuté automatiquement à 11h59 chaque jour via le scheduler.
"""
import os
import sys
import json
import asyncio
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv("/app/.env")

# Add council dir to path
sys.path.insert(0, "/app/council")

from tools.history_db import (
    init_db, save_pick, get_recent_picks, get_stats,
    get_agent_accuracy, save_agent_vote
)
from tools.sports_api import get_todays_matches, format_matches_for_prompt
from tools.html_generator import inject_pick_into_html
from agents import gpt_agent, gemini_agent, mistral_agent, groq_agent, claude_chief

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


def run_council():
    """Main orchestration function."""
    log.info("=" * 60)
    log.info("HERMES COUNCIL - Démarrage de la session quotidienne")
    log.info("=" * 60)

    init_db()
    date_str = datetime.now().strftime("%d/%m/%Y")
    today_display = datetime.now().strftime("%d/%m")

    # 1. Fetch today's matches
    log.info("Récupération des matchs du jour...")
    matches = get_todays_matches()
    matches_text = format_matches_for_prompt(matches)
    log.info(f"  {len(matches)} matchs trouvés")

    # 2. Load context
    picks_history = get_recent_picks(days=60)
    history_text = format_history_text(picks_history)
    stats = get_stats()
    agent_accuracy = get_agent_accuracy()
    improvement_notes = load_improvement_notes()

    log.info(f"Contexte: {stats['wins']}W/{stats['losses']}L ({stats['winrate']}% winrate)")

    # 3. Run 4 sub-agents in parallel
    log.info("Lancement du conseil des agents...")
    agents = [
        ("gpt", gpt_agent),
        ("gemini", gemini_agent),
        ("mistral", mistral_agent),
        ("groq", groq_agent),
    ]
    agent_reports = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(run_agent, module, date_str, matches_text, history_text, stats): key
            for key, module in agents
        }
        for future in as_completed(futures):
            key = futures[future]
            name, report = future.result()
            agent_reports[key] = report

    # 4. Claude (Chef) makes final decision
    log.info("Claude (Chef) prend sa décision finale...")
    decision = claude_chief.decide(
        date=date_str,
        matches_text=matches_text,
        agent_reports=agent_reports,
        history_text=history_text,
        stats=stats,
        agent_accuracy=agent_accuracy,
        improvement_notes=improvement_notes,
    )

    final = decision.get("decision", "NOPICK")
    log.info(f"DÉCISION FINALE: {final}")
    if final == "PICK":
        log.info(f"  Match: {decision.get('match')}")
        log.info(f"  Pari: {decision.get('bet')} @ {decision.get('odds')}")
        log.info(f"  Confiance: {decision.get('confidence')}/10")

    # 5. Save notes d'amélioration
    if decision.get("improvement_notes"):
        save_improvement_notes(decision["improvement_notes"])
        log.info("Notes d'amélioration sauvegardées.")

    # 6. Save pick to DB
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

    # 7. Save agent votes for performance tracking
    for key, report in agent_reports.items():
        agent_name = {"gpt": "GPT-4o Mini", "gemini": "Gemini Flash",
                      "mistral": "Mistral", "groq": "Groq/Llama3"}.get(key, key)
        save_agent_vote(agent_name, today_display, json.dumps(report))

    # 8. Refresh picks history (now includes today)
    picks_history = get_recent_picks(days=60)
    stats = get_stats()

    # 9. Generate new index.html
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

    log.info("=" * 60)
    log.info("HERMES COUNCIL - Session terminée")
    log.info("=" * 60)
    return decision


if __name__ == "__main__":
    run_council()
