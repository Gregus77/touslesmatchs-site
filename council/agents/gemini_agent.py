import os
import json
import google.generativeai as genai
from prompts.agent_prompt import AGENT_SYSTEM_PROMPT, AGENT_USER_PROMPT_TEMPLATE

NAME = "Gemini Flash"
_model = None


def _get_model():
    global _model
    if _model is None:
        genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
        _model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=AGENT_SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.3,
            ),
        )
    return _model


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
        response = _get_model().generate_content(prompt)
        return json.loads(response.text)
    except Exception as e:
        print(f"[{NAME}] Error: {e}")
        return {"recommendation": "NOPICK", "confidence": 0, "reasoning": f"Erreur: {e}"}
