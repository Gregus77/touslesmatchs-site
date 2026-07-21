import os
from agents.or_common import analyze_via_openrouter

NAME = "DeepSeek"
MODEL = (os.environ.get("OR_DEEPSEEK_MODEL") or "").strip() or "deepseek/deepseek-chat"


def analyze(date, matches_text, history_text, stats):
    return analyze_via_openrouter(NAME, MODEL, date, matches_text, history_text, stats)
