#!/usr/bin/env python3
"""Répare uniquement l'intégrité des cinq votes du Concile en production.

Le script accepte une source déjà partiellement corrigée et refuse d'écrire si
les invariants finaux ne sont pas démontrables. Il ne touche ni au site public,
ni à Brevo, ni à Telegram, ni aux offres.
"""

from datetime import datetime
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
API = Path(os.environ.get("TLM_API_FILE", ROOT / "scripts" / "api_server.js"))
BACKUP_ROOT = Path(os.environ.get("TLM_BACKUP_ROOT", "/opt/backups"))


def replace_literal(text, old, new):
    return text.replace(old, new)


def replace_one_regex(text, pattern, replacement, label, flags=0):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: motif unique introuvable")
    return updated


def official_agent_block(text):
    start = text.find("  const agentNames = [")
    end = text.find("  const CHIEF_INDEX", start)
    if start < 0 or end < 0:
        raise RuntimeError("bloc agentNames introuvable")
    block = text[start:end]
    pattern = (
        r'    \{\n'
        r'      name: "(?:Cohere-Command|Qwen-3\.7-Max)",\n'
        r'.*?'
        r'    \},\n'
        r'(?=    \{\n      name: "OpenRouter-Kimi",)'
    )
    qwen = '''    {
      name: "Qwen-3.7-Max",
      model: resolveModel(process.env.OR_QWEN_MODEL || "qwen/qwen3.7-max"),
      icon: "🌟",
      useOpenRouter,
      openRouterModelKey: "qwen",
    },
'''
    patched = replace_one_regex(block, pattern, qwen, "siège officiel Qwen", re.S)
    return text[:start] + patched + text[end:]


def main():
    if not API.is_file():
        raise RuntimeError(f"source API absente: {API}")

    original = API.read_text(encoding="utf-8")
    api = original

    # Roster officiel : exactement cinq IA, le Chief reste hors scrutin.
    api = replace_one_regex(
        api,
        r'const CONCILE_AGENT_NAMES = \[[^\n]+\];',
        'const CONCILE_AGENT_NAMES = ["Perplexity-Web", "DeepSeek-V3", "Mistral-Large", "Qwen-3.7-Max", "OpenRouter-Kimi"];',
        "roster du Concile",
    )
    api = replace_literal(api, "  const useCohere     = !!COHERE_API_KEY;\n", "")
    api = official_agent_block(api)

    # Retire l'ancien chemin spécial Cohere. Qwen passe exclusivement dans le
    # chemin useOpenRouter avec openRouterModelKey=qwen.
    api = re.sub(
        r'      if \(agCfg\.name === "(?:Cohere-Command|Qwen-3\.7-Max)" && OPENROUTER_API_KEY\n'
        r'.*?\n      \}\n',
        "",
        api,
        count=1,
        flags=re.S,
    )

    # Normalise les identités utilisées par les audits et les pondérations.
    api = replace_literal(api, '  "cohere/command-r-plus": "Cohere-Command",',
                          '  "qwen/qwen3.7-max": "Qwen-3.7-Max",')
    api = replace_literal(api, '  "Cohere-Command": "cohere/command-r-plus",',
                          '  "Qwen-3.7-Max": "qwen/qwen3.7-max",')

    # Conserve un vote O/U explicitement donné dans `bet` lorsque
    # `marches.buts` est absent ou mal formé.
    old_vote_capture = '''      const rawBet = parsed.bet || availableBets[0];
      if (parsed.marches && typeof parsed.marches === "object") {
        agentMarketList.push({ name: agCfg.name, marches: parsed.marches });
      }
'''
    new_vote_capture = '''      const rawBet = parsed.bet || availableBets[0];
      // Vote O/U explicite conserve meme si l'objet marches.buts est incomplet.
      const parsedMarkets = parsed.marches && typeof parsed.marches === "object"
        ? parsed.marches : {};
      const parsedOu25 = parsedMarkets?.buts;
      const parsedOu25Side = String(parsedOu25?.p || "").toLowerCase();
      const parsedOu25Confidence = Number(parsedOu25?.c);
      const hasUsableOu25Market = (parsedOu25Side === "o2.5" || parsedOu25Side === "u2.5")
        && Number.isFinite(parsedOu25Confidence);
      let marketsForVote = parsedMarkets;
      if (!hasUsableOu25Market && isOu25Bet(rawBet)) {
        const explicitConfidence = Number(parsed.confidence);
        marketsForVote = {
          ...parsedMarkets,
          buts: {
            p: /^over/i.test(String(rawBet).trim()) ? "o2.5" : "u2.5",
            c: Number.isFinite(explicitConfidence)
              ? Math.min(95, Math.max(40, explicitConfidence)) : 55,
          },
        };
      }
      if (Object.keys(marketsForVote).length) {
        agentMarketList.push({ name: agCfg.name, marches: marketsForVote });
      }
'''
    if old_vote_capture in api:
        api = api.replace(old_vote_capture, new_vote_capture, 1)
    elif "const hasUsableOu25Market" not in api:
        raise RuntimeError("capture des votes O/U introuvable")

    # Annule le hotfix qui acceptait quatre sièges actifs. La règle est : cinq
    # IA ont voté, puis au moins quatre sont alignées.
    api = replace_literal(
        api,
        "const enoughOu25SeatsPresent = Number(voteInfo.vote_active || 0) >= CLIENT_OU25_MIN_VOTES;",
        "const fiveOu25SeatsPresent = Number(voteInfo.vote_active || 0) === 5;",
    )
    api = replace_literal(api, "enoughOu25SeatsPresent", "fiveOu25SeatsPresent")
    api = replace_literal(
        api,
        "sieges O/U 2,5 insuffisants: ${Number(voteInfo.vote_active || 0)}/5 (<4)",
        "sieges O/U 2,5 incomplets: ${Number(voteInfo.vote_active || 0)}/5",
    )

    required = [
        '"Qwen-3.7-Max", "OpenRouter-Kimi"',
        'name: "Qwen-3.7-Max"',
        'openRouterModelKey: "qwen"',
        "const hasUsableOu25Market",
        "const fiveOu25SeatsPresent = Number(voteInfo.vote_active || 0) === 5;",
        "recommended: complete && voteCount >= CLIENT_OU25_MIN_VOTES",
    ]
    missing = [item for item in required if item not in api]
    forbidden = [
        "const enoughOu25SeatsPresent",
        'name: "Qwen-3.7-Max",\n      model: useCohere',
        'agCfg.name === "Qwen-3.7-Max" && OPENROUTER_API_KEY\n          && analysisEngine.allowOfficialOpenRouterFallback',
    ]
    present_forbidden = [item for item in forbidden if item in api]
    if missing or present_forbidden:
        raise RuntimeError(f"validation refusée; absents={missing}; interdits={present_forbidden}")

    if api == original:
        print("OK: intégrité des votes déjà conforme; aucun fichier modifié")
        return 0

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = BACKUP_ROOT / f"tlm-vote-integrity-{stamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    shutil.copy2(API, backup_dir / "api_server.js")
    API.write_text(api, encoding="utf-8")

    check = subprocess.run(["node", "--check", str(API)], text=True, capture_output=True)
    if check.returncode:
        shutil.copy2(backup_dir / "api_server.js", API)
        raise RuntimeError(f"node --check en échec; restauration effectuée: {check.stderr.strip()}")

    print(f"OK: source API réparée; sauvegarde={backup_dir / 'api_server.js'}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"BLOQUÉ: {exc}", file=sys.stderr)
        sys.exit(1)
