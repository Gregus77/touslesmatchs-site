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
    # GPT-5 est un modèle de raisonnement : les tokens de réflexion sont comptés
    # dans max_completion_tokens. Sans limiter la réflexion, il peut tout
    # consommer en raisonnement et renvoyer un contenu VIDE. On demande donc un
    # effort de raisonnement faible (analyse rapide) + un budget large pour le
    # JSON. reasoning_effort n'existe que sur les modèles de raisonnement : si le
    # modèle configuré ne le supporte pas, on réessaie sans ce paramètre.
    base_kwargs = dict(
        model=MODEL,
        messages=[
            {"role": "system", "content": AGENT_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        max_completion_tokens=4000,
    )
    try:
        try:
            response = _get_client().chat.completions.create(reasoning_effort="low", **base_kwargs)
        except Exception:
            # Modèle sans reasoning_effort (ex. non-raisonnement) → fallback
            response = _get_client().chat.completions.create(**base_kwargs)
        raw = response.choices[0].message.content
        if not raw or not raw.strip():
            return {"recommendation": "NOPICK", "confidence": 0, "reasoning": "Réponse vide du modèle"}
        return json.loads(raw)
    except Exception as e:
        print(f"[{NAME}] Error: {e}")
        return {"recommendation": "NOPICK", "confidence": 0, "reasoning": f"Erreur: {e}"}
