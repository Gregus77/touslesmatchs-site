import os
from agents.or_common import analyze_via_openrouter

NAME = "Mistral"
MODEL = (os.environ.get("OR_MISTRAL_MODEL") or "").strip() or "mistralai/mistral-large"


def analyze(date, matches_text, history_text, stats):
    return analyze_via_openrouter(NAME, MODEL, date, matches_text, history_text, stats)
