import os
from agents.or_common import analyze_via_openrouter

NAME = "Opus"
MODEL = (os.environ.get("OR_OPUS_MODEL") or "").strip() or "anthropic/claude-3.5-haiku"


def analyze(date, matches_text, history_text, stats):
    return analyze_via_openrouter(NAME, MODEL, date, matches_text, history_text, stats)
