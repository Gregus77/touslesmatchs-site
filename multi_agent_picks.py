
import os
import json
import requests
from datetime import datetime

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

def build_prompt(matches):
    return f"""Tu es un analyste sportif expert en paris à valeur positive.
Matchs du jour : {matches}
SCORING /10 : Forme 30% · Blessures 20% · Domicile 15% · H2H 15% · Fatigue 10% · Défense 10%
RÈGLES : Score min 8.5/10 · Cote >= 1.50 · NHL Vainqueur OT inclus uniquement
LISTE NOIRE : Ottawa · Montréal · Toronto Raptors · NBA moneyline · Europa League aller
Réponds UNIQUEMENT en JSON : {{"pick":"nom","marche":"type","cote":1.65,"score_10":8.7,"valide":true,"raisons":["r1","r2"]}}"""

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
        return "\n".join(lines) if lines else "Aucun match trouve"
    except Exception as ex:
        return f"Erreur: {ex}"

def agent_gemini(prompt):
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        r = requests.post(url, json={"contents":[{"parts":[{"text":prompt}]}]}, timeout=30)
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        text = text.strip().replace("```json","").replace("```","").strip()
        result = json.loads(text)
        result["agent"] = "Gemini"
        print(f"Gemini: {result.get('pick')} score={result.get('score_10')}")
        return result
    except Exception as ex:
        print(f"Erreur Gemini: {ex}")
        return {"agent":"Gemini","valide":False,"erreur":str(ex)}

def agent_deepseek(prompt):
    try:
        headers = {"Authorization":f"Bearer {DEEPSEEK_API_KEY}","Content-Type":"application/json"}
        payload = {"model":"deepseek-chat","messages":[{"role":"user","content":prompt}],"temperature":0.3}
        r = requests.post("https://api.deepseek.com/chat/completions", headers=headers, json=payload, timeout=30)
        text = r.json()["choices"][0]["message"]["content"]
        text = text.strip().replace("```json","").replace("```","").strip()
        result = json.loads(text)
        result["agent"] = "DeepSeek"
        print(f"DeepSeek: {result.get('pick')} score={result.get('score_10')}")
        return result
    except Exception as ex:
        print(f"Erreur DeepSeek: {ex}")
        return {"agent":"DeepSeek","valide":False,"erreur":str(ex)}

def arbitre_gemini(g, d, matches):
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        prompt = f"""Tu es l'arbitre final d'un conseil de 2 IAs specialisees paris sportifs.
Matchs du jour : {matches}
Rapport Agent1 Gemini : {json.dumps(g, ensure_ascii=False)}
Rapport Agent2 DeepSeek : {json.dumps(d, ensure_ascii=False)}
REGLES ABSOLUES : score >= 8.5 · cote >= 1.50 · NHL Vainqueur OT inclus · Liste noire : Ottawa Montreal Toronto-Raptors NBA-moneyline
Si les 2 agents valident le meme pick → confirme pick final + mise 5% bankroll.
Si desaccord ou score < 8.5 → PAS DE PICK CE SOIR - Discipline avant tout.
Reponds en francais, format clair pour publication TousLesMatchs.com."""
        payload = {"contents":[{"parts":[{"text":prompt}]}]}
        r = requests.post(url, json=payload, timeout=30)
        verdict = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        print(f"Arbitre Gemini: verdict rendu")
        return verdict
    except Exception as ex:
        print(f"Erreur arbitre: {ex}")
        return f"Erreur arbitre: {ex}"

def main():
    print("TousLesMatchs - Pipeline Multi-Agents")
    print(datetime.now().strftime("%d/%m/%Y %H:%M"))
    matches = get_matches()
    print(f"Matchs:\n{matches}\n")
    prompt = build_prompt(matches)
    g = agent_gemini(prompt)
    d = agent_deepseek(prompt)
    verdict = arbitre_gemini(g, d, matches)
    print("\nVERDICT FINAL:")
    print(verdict)
    with open("pick_du_jour.json","w",encoding="utf-8") as f:
        json.dump({"date":datetime.now().strftime("%Y-%m-%d"),"gemini":g,"deepseek":d,"verdict":verdict}, f, ensure_ascii=False, indent=2)
    print("\nSauvegarde OK: pick_du_jour.json")

if __name__ == "__main__":
    main()
