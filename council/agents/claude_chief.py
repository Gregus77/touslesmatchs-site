import os
import json
import requests
from prompts.chief_prompt import CHIEF_SYSTEM_PROMPT, CHIEF_USER_PROMPT_TEMPLATE

NAME = "Claude (Chef)"

# Le Chef appelle Claude via OpenRouter (crédits OpenRouter) si OPENROUTER_API_KEY
# est défini — sinon repli sur l'API Anthropic directe. Ça permet d'utiliser le
# solde OpenRouter au lieu des crédits API Anthropic.
OPENROUTER_KEY = (os.environ.get("OPENROUTER_API_KEY") or "").strip()
# `or` gère le cas où la variable existe mais est vide (docker-compose la met à "")
OPENROUTER_MODEL = (os.environ.get("OPENROUTER_CHIEF_MODEL") or "").strip() or "anthropic/claude-3.7-sonnet"
ANTHROPIC_KEY = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()
ANTHROPIC_MODEL = (os.environ.get("ANTHROPIC_CHIEF_MODEL") or "").strip() or "claude-opus-4-7"


def _call_openrouter(system, prompt):
    resp = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://www.touslesmatchs.com",
            "X-Title": "TousLesMatchs Concile",
        },
        json={
            "model": OPENROUTER_MODEL,
            "max_tokens": 1024,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=90,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


def _call_anthropic(system, prompt):
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    message = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


def decide(date, matches_text, agent_reports: dict, history_text, stats, agent_accuracy, improvement_notes, market_accuracy=None):
    """
    agent_reports: dict with keys gpt, gemini, mistral, groq
    market_accuracy: dict {agent_name: {market: {accuracy, total, correct}}}
    Returns final decision dict.
    """
    def fmt(report):
        if isinstance(report, dict):
            return json.dumps(report, ensure_ascii=False, indent=2)
        return str(report)

    accuracy_str = ""
    for agent, acc in agent_accuracy.items():
        accuracy_str += f"- {agent}: {acc['accuracy']}% ({acc['correct']}/{acc['total']} corrects)\n"
    if not accuracy_str:
        accuracy_str = "Pas encore assez de données historiques."

    market_str = ""
    if market_accuracy:
        for agent, markets in market_accuracy.items():
            lines = []
            for mkt, data in sorted(markets.items()):
                lines.append(f"{mkt}: {data['accuracy']}% ({data['correct']}/{data['total']})")
            market_str += f"- {agent}: {' | '.join(lines)}\n"
    if not market_str:
        market_str = "Pas encore assez de données par marché."

    prompt = CHIEF_USER_PROMPT_TEMPLATE.format(
        date=date,
        matches=matches_text,
        gpt_report=fmt(agent_reports.get("gpt", {})),
        gemini_report=fmt(agent_reports.get("gemini", {})),
        mistral_report=fmt(agent_reports.get("mistral", {})),
        groq_report=fmt(agent_reports.get("groq", {})),
        history=history_text,
        agent_accuracy=accuracy_str,
        market_matrix=market_str,
        winrate=stats.get("winrate", 0),
        roi=stats.get("roi", 0),
        wins=stats.get("wins", 0),
        losses=stats.get("losses", 0),
        improvement_notes=improvement_notes or "Aucune note précédente.",
    )

    try:
        if OPENROUTER_KEY:
            raw = _call_openrouter(CHIEF_SYSTEM_PROMPT, prompt)
            print(f"[{NAME}] via OpenRouter ({OPENROUTER_MODEL})")
        elif ANTHROPIC_KEY:
            raw = _call_anthropic(CHIEF_SYSTEM_PROMPT, prompt)
            print(f"[{NAME}] via Anthropic ({ANTHROPIC_MODEL})")
        else:
            raise RuntimeError("Aucune clé API configurée (OPENROUTER_API_KEY ou ANTHROPIC_API_KEY)")

        # Extract JSON from response
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as e:
        print(f"[{NAME}] Error: {e}")
        return {
            "decision": "NOPICK",
            "confidence": 0,
            "reasoning": f"Erreur technique: {e}",
            "improvement_notes": "",
        }
