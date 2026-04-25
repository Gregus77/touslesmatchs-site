import os
import json
import requests
from datetime import datetime

GEMINI_API_KEY    = os.environ.get("GEMINI_API_KEY")
DEEPSEEK_API_KEY  = os.environ.get("DEEPSEEK_API_KEY")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

# ─────────────────────────────────────────────
# RÈGLES ABSOLUES
# ─────────────────────────────────────────────
RULES = """
RÈGLES ABSOLUES — À VÉRIFIER POUR CHAQUE PICK :

=== NHL HOCKEY ===
- Equipe à DOMICILE uniquement
- Score minimum 8.5/10
- Cote >= 1.50
- Vainqueur OT inclus
- Liste noire : Ottawa, Montreal, Toronto Raptors
- Back-to-back -> rejeté (-8%)
- Equipe dos au mur -> bonus +5% (motivation maximale)

=== NBA BASKETBALL ===
- PLAYOFFS UNIQUEMENT (jamais saison régulière sauf exception ci-dessous)
- Exception saison régulière : top 3 vs bottom 3 du classement avec écart >15 victoires
- Equipe à DOMICILE uniquement
- Match "dos au mur" (élimination) = bonus +10% de fiabilité
- Cote >= 1.40 (moins de variance qu'au hockey)
- Score minimum 8.5/10
- Liste noire : tout match sans enjeu (équipe déjà qualifiée + adversaire éliminé)
- Attention load management : vérifier si stars jouent bien

=== TENNIS ===
- GRAND CHELEM UNIQUEMENT (Roland Garros, Wimbledon, US Open, Australian Open)
- Jamais petits tournois, jamais ATP 250/500 avant un Grand Chelem
- Top 20 mondial uniquement comme favori
- Vérifier : pas de Grand Chelem dans les 10 jours suivants pour le favori
- Score minimum 8.5/10
- Cote >= 1.30 (tennis plus prévisible)
- Favoris en forme sur la surface du tournoi
- Match "dos au mur" (élimination) = bonus +8%

=== FOOTBALL (Ligue 1, PL, Liga, Bundesliga, Serie A) ===
- Equipe à DOMICILE uniquement
- Score minimum 8.5/10
- Cote >= 1.50
- Liste noire : Europa League aller, matchs sans enjeu en fin de saison
- Match de qualification / "dos au mur" = bonus +5%

=== BASEBALL MLB ===
- Equipe à DOMICILE uniquement
- Pitcher titulaire confirmé obligatoire
- Score minimum 8.5/10
- Cote >= 1.50

SCORING /10 :
Forme récente 30% - Blessures/absences 20% - Domicile 15% - H2H 15% - Fatigue/back2back 10% - Défense adverse 10%
BONUS : Dos au mur/élimination +5 à +10% selon sport
MALUS : Back-to-back -8%, Blessure star -10%, Match sans enjeu = REJETÉ automatiquement
"""

# ─────────────────────────────────────────────
# RÉCUPÉRATION DES MATCHS — TOUS SPORTS
# ─────────────────────────────────────────────
def get_nhl_matches():
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
                lines.append(f"[NHL] {away['team']['displayName']} @ {home['team']['displayName']}")
        return lines
    except Exception as ex:
        print(f"NHL fetch error: {ex}")
        return []

def get_nba_matches():
    try:
        r = requests.get("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard", timeout=10)
        events = r.json().get("events", [])
        lines = []
        for e in events:
            c = e.get("competitions", [{}])[0]
            # Détecter si c'est un match de playoffs
            season_type = e.get("season", {}).get("type", 0)
            notes = c.get("notes", [])
            is_playoff = season_type == 3 or any("playoff" in str(n).lower() or "series" in str(n).lower() for n in notes)
            series_summary = ""
            for n in notes:
                if isinstance(n, dict) and n.get("headline"):
                    series_summary = f" [{n['headline']}]"
            teams = c.get("competitors", [])
            if len(teams) == 2:
                home = next((t for t in teams if t["homeAway"] == "home"), teams[0])
                away = next((t for t in teams if t["homeAway"] == "away"), teams[1])
                tag = "NBA-PLAYOFFS" if is_playoff else "NBA-REGULAR"
                lines.append(f"[{tag}]{series_summary} {away['team']['displayName']} @ {home['team']['displayName']}")
        return lines
    except Exception as ex:
        print(f"NBA fetch error: {ex}")
        return []

def get_tennis_matches():
    try:
        r = requests.get("https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard", timeout=10)
        events = r.json().get("events", [])
        lines = []
        grand_slams = ["roland garros", "wimbledon", "us open", "australian open", "french open"]
        for e in events:
            tournament = e.get("name", "").lower()
            is_grand_slam = any(gs in tournament for gs in grand_slams)
            if not is_grand_slam:
                continue
            c = e.get("competitions", [{}])[0]
            teams = c.get("competitors", [])
            if len(teams) == 2:
                p1 = teams[0].get("athlete", {}).get("displayName", teams[0].get("displayName", "?"))
                p2 = teams[1].get("athlete", {}).get("displayName", teams[1].get("displayName", "?"))
                lines.append(f"[TENNIS-GRANDSLAM] {p1} vs {p2} ({e.get('name','')})")
        return lines
    except Exception as ex:
        print(f"Tennis fetch error: {ex}")
        return []

def get_all_matches():
    all_matches = []
    all_matches.extend(get_nhl_matches())
    all_matches.extend(get_nba_matches())
    all_matches.extend(get_tennis_matches())
    if not all_matches:
        return "Aucun match trouvé ce soir."
    return "\n".join(all_matches)

# ─────────────────────────────────────────────
# APPELS API
# ─────────────────────────────────────────────
def call_claude(prompt):
    try:
        headers = {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        body = {
            "model": "claude-opus-4-5",
            "max_tokens": 1200,
            "messages": [{"role": "user", "content": prompt}]
        }
        r = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=body, timeout=30)
        return r.json()["content"][0]["text"]
    except Exception as ex:
        print(f"Claude error: {ex}")
        return None

def call_gemini(prompt):
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        body = {"contents": [{"parts": [{"text": prompt}]}]}
        r = requests.post(url, json=body, timeout=30)
        data = r.json()
        if "candidates" not in data:
            print(f"Gemini raw response: {data}")
            return None
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as ex:
        print(f"Gemini error: {ex}")
        return None

def call_deepseek(prompt):
    try:
        headers = {"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"}
        payload = {"model": "deepseek-chat", "messages": [{"role": "user", "content": prompt}], "temperature": 0.3}
        r = requests.post("https://api.deepseek.com/chat/completions", headers=headers, json=payload, timeout=30)
        return r.json()["choices"][0]["message"]["content"]
    except Exception as ex:
        print(f"DeepSeek error: {ex}")
        return None

# ─────────────────────────────────────────────
# ÉTAPE 1 : CLAUDE CHOISIT
# ─────────────────────────────────────────────
def agent_claude_pick(matches):
    prompt = f"""Tu es un analyste sportif expert en paris sportifs. Voici tous les matchs disponibles ce soir :

{matches}

{RULES}

INSTRUCTIONS :
1. Analyse CHAQUE match selon son sport et ses règles spécifiques
2. Pour NBA : vérifie bien si c'est playoffs ou regular season et applique les bonnes règles
3. Pour Tennis : accepte UNIQUEMENT si Grand Chelem
4. Pour NHL : domicile uniquement
5. Repère les matchs "dos au mur" (élimination) → bonus de fiabilité
6. Propose UN SEUL pick, le meilleur toutes catégories confondues
7. Si aucun match ne passe 8.5/10 → NO_PICK

Réponds UNIQUEMENT en JSON :
{{"pick":"nom equipe ou joueur","sport":"NHL/NBA/TENNIS","market":"Moneyline ou Winner","odds":1.65,"score_10":8.7,"valid":true,"dos_au_mur":false,"reasons":["raison1","raison2","raison3"]}}
ou
{{"valid":false,"reason":"explication precise"}}"""

    result = call_claude(prompt)
    if not result:
        return {"valid": False, "reason": "Claude API error", "agent": "Claude"}
    try:
        start = result.find("{")
        end = result.rfind("}") + 1
        data = json.loads(result[start:end])
        data["agent"] = "Claude"
        if data.get("valid"):
            sport = data.get("sport", "?")
            dos_mur = " [DOS AU MUR]" if data.get("dos_au_mur") else ""
            print(f"Claude pick: [{sport}]{dos_mur} {data.get('pick')} score={data.get('score_10')}")
        else:
            print(f"Claude: NO PICK - {data.get('reason')}")
        return data
    except Exception as ex:
        print(f"Claude parse error: {ex}")
        return {"valid": False, "reason": "parse error", "agent": "Claude"}

# ─────────────────────────────────────────────
# ÉTAPE 2 : DEEPSEEK VALIDE
# ─────────────────────────────────────────────
def agent_deepseek_validate(claude_pick, matches):
    prompt = f"""Tu es un validateur de paris sportifs. Claude a proposé ce pick :
{json.dumps(claude_pick, ensure_ascii=False)}

Matchs disponibles : {matches}

{RULES}

Ton rôle : dire OUI ou NON uniquement. Vérifie :
- Les règles du sport concerné sont-elles respectées ?
- Le score 8.5/10 minimum est-il justifié ?
- S'il s'agit de NBA : est-ce bien un match de playoffs ou exception valide ?
- S'il s'agit de Tennis : est-ce bien un Grand Chelem ?
- Y a-t-il un risque de match sans enjeu ou tanking ?

Réponds UNIQUEMENT en JSON :
{{"validated":true,"score_10":8.7,"comment":"raison courte"}}
ou
{{"validated":false,"score_10":7.2,"comment":"raison du refus"}}"""

    result = call_deepseek(prompt)
    if not result:
        return {"validated": False, "comment": "DeepSeek unavailable"}
    try:
        start = result.find("{")
        end = result.rfind("}") + 1
        data = json.loads(result[start:end])
        status = "OUI" if data.get("validated") else "NON"
        print(f"DeepSeek: {status} - {data.get('comment','')}")
        return data
    except:
        return {"validated": False, "comment": "parse error"}

# ─────────────────────────────────────────────
# ÉTAPE 3 : GEMINI VALIDE
# ─────────────────────────────────────────────
def agent_gemini_validate(claude_pick, matches):
    prompt = f"""Tu es un validateur de paris sportifs. Claude a proposé ce pick :
{json.dumps(claude_pick, ensure_ascii=False)}

Matchs disponibles : {matches}

{RULES}

Ton rôle : dire OUI ou NON uniquement. Vérifie :
- Les règles du sport concerné sont-elles respectées ?
- Le score 8.5/10 minimum est-il justifié ?
- S'il s'agit de NBA : est-ce bien un match de playoffs ou exception valide ?
- S'il s'agit de Tennis : est-ce bien un Grand Chelem ?
- Y a-t-il un risque de match sans enjeu ou tanking ?

Réponds UNIQUEMENT en JSON :
{{"validated":true,"score_10":8.7,"comment":"raison courte"}}
ou
{{"validated":false,"score_10":7.2,"comment":"raison du refus"}}"""

    result = call_gemini(prompt)
    if not result:
        print("Gemini: indisponible - ignoré")
        return {"validated": None, "comment": "Gemini unavailable"}
    try:
        start = result.find("{")
        end = result.rfind("}") + 1
        data = json.loads(result[start:end])
        status = "OUI" if data.get("validated") else "NON"
        print(f"Gemini: {status} - {data.get('comment','')}")
        return data
    except:
        return {"validated": None, "comment": "parse error"}

# ─────────────────────────────────────────────
# VERDICT FINAL
# ─────────────────────────────────────────────
def verdict_final(claude_pick, deepseek_val, gemini_val):
    if not claude_pick.get("valid"):
        return "PAS DE PARI CE SOIR - " + claude_pick.get("reason", "Aucun match valide.")

    sport = claude_pick.get("sport", "")
    dos_mur = " [MATCH DOS AU MUR]" if claude_pick.get("dos_au_mur") else ""
    pick_str = (f"[{sport}]{dos_mur} {claude_pick['pick']} - {claude_pick['market']}"
                f" - Cote {claude_pick['odds']} - Score {claude_pick['score_10']}/10 - Mise 5% bankroll")

    ds_ok = deepseek_val.get("validated") == True
    gm_ok = gemini_val.get("validated") == True
    gm_na = gemini_val.get("validated") is None

    if gm_na:
        if ds_ok:
            return f"VALIDE (DeepSeek OUI - Gemini indisponible)\n{pick_str}"
        else:
            return f"PAS DE PARI - DeepSeek a rejeté.\nRaison : {deepseek_val.get('comment')}"
    if ds_ok and gm_ok:
        return f"VALIDE A L'UNANIMITE (DeepSeek OUI - Gemini OUI)\n{pick_str}"
    elif ds_ok and not gm_ok:
        return f"PAS DE PARI - Gemini a rejeté.\nRaison : {gemini_val.get('comment')}"
    elif not ds_ok and gm_ok:
        return f"PAS DE PARI - DeepSeek a rejeté.\nRaison : {deepseek_val.get('comment')}"
    else:
        return f"PAS DE PARI - Rejeté par les deux.\nDeepSeek : {deepseek_val.get('comment')}\nGemini : {gemini_val.get('comment')}"

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    print("=" * 55)
    print("TousLesMatchs - Multi-Agent Pipeline v3")
    print(f"Sports : NHL - NBA (playoffs) - Tennis (Grand Chelem)")
    print(datetime.now().strftime("%d/%m/%Y %H:%M"))
    print("=" * 55)

    matches = get_all_matches()
    print(f"\nMatchs détectés ce soir :\n{matches}\n")

    print("-- ETAPE 1 : Claude choisit --")
    claude_pick = agent_claude_pick(matches)

    if not claude_pick.get("valid"):
        verdict = "PAS DE PARI CE SOIR - " + claude_pick.get("reason", "Aucun match valide.")
        deepseek_val = {}
        gemini_val = {}
    else:
        print("\n-- ETAPE 2 : DeepSeek valide --")
        deepseek_val = agent_deepseek_validate(claude_pick, matches)
        print("\n-- ETAPE 3 : Gemini valide --")
        gemini_val = agent_gemini_validate(claude_pick, matches)
        verdict = verdict_final(claude_pick, deepseek_val, gemini_val)

    print("\n" + "=" * 55)
    print("VERDICT FINAL :")
    print(verdict)
    print("=" * 55)

    with open("pick_du_jour.json", "w", encoding="utf-8") as f:
        json.dump({
            "date": datetime.now().strftime("%Y-%m-%d"),
            "matches_scannes": matches,
            "claude_pick": claude_pick,
            "deepseek_validation": deepseek_val,
            "gemini_validation": gemini_val,
            "verdict": verdict
        }, f, ensure_ascii=False, indent=2)
    print("\nSaved: pick_du_jour.json")

if __name__ == "__main__":
    main()

