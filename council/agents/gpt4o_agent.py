import os
from agents.or_common import analyze_via_openrouter

NAME = "GPT-4o"
MODEL = (os.environ.get("OR_GPT4O_MODEL") or "").strip() or "openai/gpt-4o-mini"


def analyze(date, matches_text, history_text, stats):
    return analyze_via_openrouter(NAME, MODEL, date, matches_text, history_text, stats)
