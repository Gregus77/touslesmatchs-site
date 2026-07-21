"""
Helper partagé : tous les agents du Concile appellent OpenRouter via ce module.
Un seul pool de crédits (OPENROUTER_API_KEY), un seul point d'entrée.
Chaque agent fournit son NOM et son MODÈLE ; le format entrée/sortie reste
identique (dict {recommendation, confidence, reasoning}).
"""
import os
import re
import json
from openai import OpenAI
from prompts.agent_prompt import AGENT_SYSTEM_PROMPT, AGENT_USER_PROMPT_TEMPLATE

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=(os.environ.get("OPENROUTER_API_KEY") or "").strip(),
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": "https://www.touslesmatchs.com",
                "X-Title": "TousLesMatchs Concile",
            },
        )
    return _client


def _chat(model, messages):
    """Appel chat avec response_format JSON ; repli sans si le modèle ne le supporte pas."""
    try:
        return _get_client().chat.completions.create(
            model=model, messages=messages, temperature=0.3, max_tokens=500,
            response_format={"type": "json_object"},
        )
    except Exception:
        return _get_client().chat.completions.create(
            model=model, messages=messages, temperature=0.3, max_tokens=500,
        )


def analyze_via_openrouter(name, model, date, matches_text, history_text, stats):
    """Appelle un modèle via OpenRouter et renvoie le dict de recommandation."""
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
        resp = _chat(model, [
            {"role": "system", "content": AGENT_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ])
        raw = (resp.choices[0].message.content or "").strip()
        # Certains modèles enveloppent le JSON dans des ```
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
        # Extraire l'objet JSON { ... } même si du texte l'entoure
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            raw = match.group(0)
        # Retirer les caractères de contrôle qui cassent json.loads
        raw = re.sub(r"[\x00-\x1f]", " ", raw)
        return json.loads(raw.strip())
    except Exception as e:
        print(f"[{name}] Error: {e}")
        return {"recommendation": "NOPICK", "confidence": 0, "reasoning": f"Erreur: {e}"}
