import os
from agents.or_common import analyze_via_openrouter

NAME = "GPT-5"
# La clé OpenAI directe en production renvoie 401. Le siège garde le même
# modèle, mais passe par la passerelle OpenRouter interne déjà autorisée : elle
# applique les mêmes plafonds journaliers et la même télémétrie que les autres
# sièges. Un identifiant sans fournisseur est normalisé explicitement.
_configured_model = (os.environ.get("OPENAI_MODEL_GPT5") or "gpt-5").strip()
MODEL = _configured_model if "/" in _configured_model else f"openai/{_configured_model}"


def analyze(date, matches_text, history_text, stats):
    if not os.environ.get("OPENROUTER_API_KEY"):
        return {"recommendation": "NOPICK", "confidence": 0,
                "reasoning": "Fournisseur non configure"}
    return analyze_via_openrouter(NAME, MODEL, date, matches_text, history_text, stats)
