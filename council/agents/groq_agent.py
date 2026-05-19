import os
import json
from groq import Groq
from prompts.agent_prompt import AGENT_SYSTEM_PROMPT, AGENT_USER_PROMPT_TEMPLATE

NAME = "Groq/Llama3"
client = None


def _get_client():
    global client
    if client is None:
        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    return client


def analyze(date, matches_text, history_text, stats):
    prompt = AGENT_USER_PROMPT_TEMPLATE.format(
        date=date,
        matches=matches_text,
        history=history_text,
        winrate=stats.get("winrate", 0),
        roi=stats.get("roi", 0),
        wins=stats.get("wins", 0),
        losses=stats.get("losses", 0),
    )
    try:
        response = _get_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": AGENT_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=500,
        )
        raw = response.choices[0].message.content
        return json.loads(raw)
    except Exception as e:
        print(f"[{NAME}] Error: {e}")
        return {"recommendation": "NOPICK", "confidence": 0, "reasoning": f"Erreur: {e}"}
