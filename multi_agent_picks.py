import os
import json
import requests
from datetime import datetime

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")

def build_prompt(matches):
    return f"""You are a sports betting analyst. Matches today: {matches}
SCORING /10: Recent form 30% Injuries 20% Home/Away 15% H2H 15% Fatigue 10% Defense 10%
RULES: Min score 8.5/10. Min odds 1.50. NHL Winner including OT only.
BLACKLIST: Ottawa Montreal Toronto-Raptors NBA-moneyline Europa-League-away
Reply ONLY in JSON no markdown: {{"pick":"name","market":"type","odds":1.65,"score_10":8.7,"valid":true,"reasons":["r1","r2"]}}"""

def get_matches():
    try:
        r = requests.get("https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard", timeout=10)
        events = r.json().get("events", [])
        lines = []
        for e in events:
            c = e.get("competitions", [{}])[0]
            teams = c.get("competitors", [])
            if len(teams) == 2:
                home = next((t for t in teams if t["homeAway"]=="home"), teams[0])
                away = next((t for t in teams if t["homeAway"]=="away"), teams[1])
                lines.append(f"{away['team']['displayName']} @ {home['team']['displayName']}")
        return "\n".join(lines) if lines else "No matches found"
    except Exception as ex:
        return f"Error: {ex}"

def call_gemini(prompt):
    try:
        url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2}
        }
        r = requests.post(url, json=body, timeout=30)
        data = r.json()
        print(f"Gemini raw response: {data}")
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        text = text.strip()
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])
    except Exception as ex:
        print(f"Gemini error: {ex}")
        return {"valid": False, "error": str(ex)}

def agent_gemini(prompt):
    result = call_gemini(prompt)
    result["agent"] = "Gemini"
    print(f"Gemini: {result.get('pick')} score={result.get('score_10')}")
    return result

def agent_deepseek(prompt):
    try:
        headers = {"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"}
        payload = {"model": "deepseek-chat", "messages": [{"role": "user", "content": prompt}], "temperature": 0.3}
        r = requests.post("https://api.deepseek.com/chat/completions", headers=headers, json=payload, timeout=30)
        text = r.json()["choices"][0]["message"]["content"]
        text = text.strip()
        start = text.find("{")
        end = text.rfind("}") + 1
        result = json.loads(text[start:end])
        result["agent"] = "DeepSeek"
        print(f"DeepSeek: {result.get('pick')} score={result.get('score_10')}")
        return result
    except Exception as ex:
        print(f"DeepSeek error: {ex}")
        return {"agent": "DeepSeek", "valid": False, "error": str(ex)}

def arbitre_gemini(g, d, matches):
    try:
        url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
        prompt = f"""Tu es l arbitre final d un conseil de 2 IAs paris sportifs.
Matchs: {matches}
Rapport Gemini: {json.dumps(g, ensure_ascii=False)}
Rapport DeepSeek: {json.dumps(d, ensure_ascii=False)}
Regles: score >= 8.5 cote >= 1.50 NHL OT inclus Liste noire: Ottawa Montreal Toronto-Raptors
Si consensus: donne pick final + mise 5 pourcent bankroll. Sinon: PAS DE PICK CE SOIR.
Reponds en francais pour TousLesMatchs.com"""
        body = {"contents": [{"parts": [{"text": prompt}]}]}
        r = requests.post(url, json=body, timeout=30)
        data = r.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as ex:
        return f"Arbitre error: {ex}"

def main():
    print("TousLesMatchs - Multi-Agent Pipeline")
    print(datetime.now().strftime("%d/%m/%Y %H:%M"))
    matches = get_matches()
    print(f"Matches:\n{matches}\n")
    prompt = build_prompt(matches)
    g = agent_gemini(prompt)
    d = agent_deepseek(prompt)
    verdict = arbitre_gemini(g, d, matches)
    print("\nFINAL VERDICT:")
    print(verdict)
    with open("pick_du_jour.json", "w", encoding="utf-8") as f:
        json.dump({"date": datetime.now().strftime("%Y-%m-%d"), "gemini": g, "deepseek": d, "verdict": verdict}, f, ensure_ascii=False, indent=2)
    print("\nSaved: pick_du_jour.json")

if __name__ == "__main__":
    main()
