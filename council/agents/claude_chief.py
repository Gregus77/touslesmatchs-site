import os
import json
import anthropic
from prompts.chief_prompt import CHIEF_SYSTEM_PROMPT, CHIEF_USER_PROMPT_TEMPLATE

NAME = "Claude (Chef)"
client = None


def _get_client():
    global client
    if client is None:
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return client


def decide(date, matches_text, agent_reports: dict, history_text, stats, agent_accuracy, improvement_notes):
    """
    agent_reports: dict with keys gpt, gemini, mistral, groq
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

    prompt = CHIEF_USER_PROMPT_TEMPLATE.format(
        date=date,
        matches=matches_text,
        gpt_report=fmt(agent_reports.get("gpt", {})),
        gemini_report=fmt(agent_reports.get("gemini", {})),
        mistral_report=fmt(agent_reports.get("mistral", {})),
        groq_report=fmt(agent_reports.get("groq", {})),
        history=history_text,
        agent_accuracy=accuracy_str,
        winrate=stats.get("winrate", 0),
        roi=stats.get("roi", 0),
        wins=stats.get("wins", 0),
        losses=stats.get("losses", 0),
        improvement_notes=improvement_notes or "Aucune note précédente.",
    )

    try:
        message = _get_client().messages.create(
            model="claude-opus-4-7",
            max_tokens=1024,
            system=CHIEF_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text
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
