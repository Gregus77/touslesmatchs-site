import os
from agents.or_common import analyze_via_openrouter

NAME = "Gemini Flash"
MODEL = (os.environ.get("OR_GEMINI_MODEL") or "").strip() or "google/gemini-3.5-flash"


def analyze(date, matches_text, history_text, stats):
    return analyze_via_openrouter(NAME, MODEL, date, matches_text, history_text, stats)
