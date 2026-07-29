"""
Test à sec du filtre Concile — vérifie quelles IA seraient exclues au
prochain run, SANS lancer les agents ni publier sur Telegram.

Usage sur le VPS :
    docker exec touslesmatchs-council python /app/council/test_filter.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tools.history_db import init_db, get_agent_accuracy
from agents import gpt_agent, gemini_agent, mistral_agent, groq_agent, opus_agent, gpt4o_agent
from hermes import filter_agents_by_accuracy, MIN_AGENT_ACCURACY


def main():
    init_db()
    agent_accuracy = get_agent_accuracy()

    print("=" * 60)
    print(f"TEST FILTRE CONCILE — Seuil : {MIN_AGENT_ACCURACY}%")
    print("=" * 60)
    print()
    print("Données de précision disponibles :")
    for name, data in sorted(agent_accuracy.items()):
        total = data.get("total", 0)
        acc = data.get("accuracy", 0)
        print(f"  {name:20s} : {acc:5.1f}% sur {total:4d} pronos résolus")
    print()

    all_agents = [
        ("gpt", gpt_agent),
        ("gemini", gemini_agent),
        ("mistral", mistral_agent),
        ("groq", groq_agent),
    ]

    print("Résultat du filtre officiel :")
    print("-" * 60)
    qualified, excluded = filter_agents_by_accuracy(all_agents, agent_accuracy)
    print()

    print("=" * 60)
    print(f"✅ QUALIFIÉS ({len(qualified)}) :")
    for key, _ in qualified:
        print(f"   → {key}")
    print()
    print(f"❌ EXCLUS ({len(excluded)}) :")
    for key, name, acc in excluded:
        print(f"   → {key} ({name}) — {acc}%")
    print("=" * 60)


if __name__ == "__main__":
    main()
