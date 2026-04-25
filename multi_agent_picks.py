import asyncio
import aiohttp
import os

# --- Configuration des API (à mettre dans des variables d’environnement) ---
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")
DEEPSEEK_KEY = os.getenv("DEEPSEEK_API_KEY")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

# --- Prompts communs ---
SYSTEM_PROMPT = """Tu es un expert en paris sportifs. À partir des critères suivants : [liste les 30 critères], donne UN SEUL choix de pari (ex: Victoire Équipe A, Over 2.5 buts, etc.). Réponds uniquement par le libellé du choix, rien d’autre."""

# --- Fonction pour appeler une API avec retry et timeout ---
async def call_api(session, url, headers, payload, name, retries=2):
    for attempt in range(retries + 1):
        try:
            async with session.post(url, headers=headers, json=payload, timeout=30) as resp:
                if resp.status == 429:
                    await asyncio.sleep(2 ** attempt)
                    continue
                data = await resp.json()
                # Extraction adaptée à chaque API (à ajuster)
                if name == "claude":
                    return data.get("content")[0].get("text")
                elif name == "deepseek":
                    return data["choices"][0]["message"]["content"]
                elif name == "gemini":
                    return data["candidates"][0]["content"]["parts"][0]["text"]
                else:
                    return "ERREUR"
        except Exception as e:
            if attempt == retries:
                return f"ERREUR: {e}"
            await asyncio.sleep(1)

async def main():
    # Construire les payloads selon la doc de chaque API
    payload_claude = {
        "model": "claude-3-opus-20240229",
        "max_tokens": 100,
        "messages": [{"role": "user", "content": SYSTEM_PROMPT}]
    }
    headers_claude = {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }

    payload_deepseek = {
        "model": "deepseek-chat",
        "messages": [{"role": "system", "content": SYSTEM_PROMPT},
                     {"role": "user", "content": "Donne ton choix"}],
        "max_tokens": 50
    }
    headers_deepseek = {
        "Authorization": f"Bearer {DEEPSEEK_KEY}",
        "Content-Type": "application/json"
    }

    payload_gemini = {
        "contents": [{"parts": [{"text": SYSTEM_PROMPT}]}]
    }
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_KEY}"

    async with aiohttp.ClientSession() as session:
        tasks = [
            call_api(session, "https://api.anthropic.com/v1/messages", headers_claude, payload_claude, "claude"),
            call_api(session, "https://api.deepseek.com/v1/chat/completions", headers_deepseek, payload_deepseek, "deepseek"),
            call_api(session, gemini_url, {}, payload_gemini, "gemini")
        ]
        results = await asyncio.gather(*tasks)

    votes = [res for res in results if not res.startswith("ERREUR")]
    if not votes:
        return "Aucun choix valide remonté."

    # Vote majoritaire simple
    from collections import Counter
    choice_counts = Counter(votes)
    final_choice = choice_counts.most_common(1)[0][0]
    return final_choice

if __name__ == "__main__":
    print(asyncio.run(main()))
