import os
import json
from openai import OpenAI
from prompts.agent_prompt import AGENT_SYSTEM_PROMPT, AGENT_USER_PROMPT_TEMPLATE

NAME = "GPT-5"
# Modèle configurable : mets l'ID EXACT exposé par ton compte OpenAI dans le
# .env du VPS (OPENAI_MODEL_GPT5=...). Défaut "gpt-5" si non défini.
MODEL = os.environ.get("OPENAI_MODEL_GPT5", "gpt-5")
client = None


def _get_client():
    global client
    if client is None:
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    return client


def analyze(date, matches_text, history_text, stats):
    if not os.environ.get("OPENAI_API_KEY"):
        return {"recommendation": "NOPICK", "confidence": 0, "reasoning": "OPENAI_API_KEY non configuree"}

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
        # GPT-5 (modèle de raisonnement) : utilise max_completion_tokens (pas
        # max_tokens) et n'accepte que la température par défaut. Budget élevé
        # car le raisonnement consomme des tokens avant de produire le JSON.
        response = _get_client().chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": AGENT_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=2000,
        )
        raw = response.choices[0].message.content
        return json.loads(raw)
    except Exception as e:
        print(f"[{NAME}] Error: {e}")
        return {"recommendation": "NOPICK", "confidence": 0, "reasoning": f"Erreur: {e}"}
