import os
import json
from google import genai
from google.genai import types
from prompts.agent_prompt import AGENT_SYSTEM_PROMPT, AGENT_USER_PROMPT_TEMPLATE

NAME = "Gemini Flash"
_client = None


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
    return _client


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
        response = _get_client().models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=AGENT_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"[{NAME}] Error: {e}")
        return {"recommendation": "NOPICK", "confidence": 0, "reasoning": f"Erreur: {e}"}
