import os
import json
import requests
from datetime import datetime

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")

def get_matches():
    try:
        r = requests.get("https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard", timeout=10)
        events = r.json().get("events", [])
        lines = []
        for e in events:
            c = e.get("competitions", [{}])[0]
            teams = c.get("competitors", [])
            if len(teams) == 2:
                home = next((t for t in teams if t["homeAway"] == "home"), teams[0])
                away = next((t for t in teams if t["homeAway"] == "away"), teams[1])
                lines.append(f"{away['team']['displayName']} @ {home['team']['displayName']}")
        return "\n".join(lines) if lines else "No matches found"
    except Exception as ex:
        return f"Error: {ex}"

def call_gemini(text):
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        body = {"contents": [{"parts": [{"text": text}]}]}
        r = requests.post(url, json=body, timeout=30)
        data = r.json()
        if "candidates" not in data:
            print(f"Gemini raw response: {data}")
            return None
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as ex:
        print(f"Gemini error: {ex}")
        return None

def agent_gemini(matches):
    prompt = f"""You are a sports betting analyst. Today's matches: {matches}
SCORING /10: Recent form 30% Injuries 20% Home/Away 15% Head-to-head 15% Fatigue 10% Defense 10%
RULES: Minimum score 8.5/10. Minimum odds 1.50. NHL winner, OT included.
BLACKLIST: Ottawa Montreal Toronto Raptors NBA Moneyline Europa League away
Reply ONLY in JSON: {{"pick":"name","market":"type","odds":1.65,"score_10":8.7,"valid":true,"reasons":["r1","r2"]}}"""
    result = call_gemini(prompt)
    if result:
        try:
            start = result.find("{")
            end = result.rfind("}") + 1
            data = json.loads(result[start:end])
            data["agent"] = "Gemini"
            print(f"Gemini: {data.get('pick')} score={data.get('score_10')}")
            return data
        except:
            pass
    print("Gemini: failed")
    return {"agent": "Gemini", "valid": False, "error": "parse error"}

def agent_deepseek(matches):
    try:
        prompt = f"""You are a sports betting analyst. Today's matches: {matches}
SCORING /10: Recent form 30% Injuries 20% Home/Away 15% Head-to-head 15% Fatigue 10% Defense 10%
RULES: Minimum score 8.5/10. Minimum odds 1.50. NHL winner, OT included.
BLACKLIST: Ottawa Montreal Toronto Raptors NBA Moneyline Europa League away
Reply ONLY in JSON: {{"pick":"name","market":"type","odds":1.65,"score_10":8.7,"valid":true,"reasons":["r1","r2"]}}"""
        headers = {"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"}
        payload = {"model": "deepseek-chat", "messages": [{"role": "user", "content": prompt}], "temperature": 0.3}
        r = requests.post("https://api.deepseek.com/chat/completions", headers=headers, json=payload, timeout=30)
        text = r.json()["choices"][0]["message"]["content"]
        start = text.find("{")
        end = text.rfind("}") + 1
        data = json.loads(text[start:end])
        data["agent"] = "DeepSeek"
        print(f"DeepSeek: {data.get('pick')} score={data.get('score_10')}")
        return data
    except Exception as ex:
        print(f"DeepSeek error: {ex}")
        return {"agent": "DeepSeek", "valid": False, "error": str(ex)}

def arbitre(g, d, matches):
    prompt = f"""You are the final referee of a 2-AI sports betting council.
Matches: {matches}
Gemini report: {json.dumps(g, ensure_ascii=False)}
DeepSeek report: {json.dumps(d, ensure_ascii=False)}
Absolute rules: score >= 8.5, odds >= 1.50, NHL OT included. Blacklist: Ottawa Montreal Toronto-Raptors
If both agents validate same pick: CONFIRM + bet 5% bankroll.
If only 1 validates: examine and decide.
If none passes 8.5: NO PICK TONIGHT.
Reply in English for publication on TousLesMatchs.com"""
    result = call_gemini(prompt)
    if result:
        return result
    return "Arbitre indisponible - DeepSeek seul : " + str(d)

def main():
    print("TousLesMatchs - Multi-Agent Pipeline")
    print(datetime.now().strftime("%d/%m/%Y %H:%M"))
    matches = get_matches()
    print(f"Matches:\n{matches}\n")
    g = agent_gemini(matches)
    d = agent_deepseek(matches)
    verdict = arbitre(g, d, matches)
    print("\nFINAL VERDICT:")
    print(verdict)
    with open("pick_du_jour.json", "w", encoding="utf-8") as f:
        json.dump({"date": datetime.now().strftime("%Y-%m-%d"), "gemini": g, "deepseek": d, "verdict": verdict}, f, ensure_ascii=False, indent=2)
    print("\nSaved: pick_du_jour.json")

if __name__ == "__main__":
    main()
