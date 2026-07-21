import os
from agents.or_common import analyze_via_openrouter

NAME = "Groq/Llama3"
MODEL = (os.environ.get("OR_GROQ_MODEL") or "").strip() or "meta-llama/llama-3.3-70b-instruct"


def analyze(date, matches_text, history_text, stats):
    return analyze_via_openrouter(NAME, MODEL, date, matches_text, history_text, stats)
