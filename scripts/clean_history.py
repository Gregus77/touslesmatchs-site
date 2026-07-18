import json
import re
from datetime import datetime

EXCLUDED = [
    re.compile(r'II\b', re.I),
    re.compile(r'U\d{2}', re.I),
    re.compile(r'MLS Next Pro', re.I),
    re.compile(r'r[ée]serve', re.I),
    re.compile(r'[0-9]+\s*$', re.I)
]

# Championnats/pays à exclure (trop imprévisibles, mauvais winrate)
BAD_LEAGUES = [
    re.compile(r'Bulgaria', re.I),
    re.compile(r'Serbia', re.I),
    re.compile(r'Canadian Premier', re.I),
    re.compile(r'Copa Argentina', re.I),
    re.compile(r'Brazil.*Serie B|Serie B.*Brazil', re.I),
    re.compile(r'First League.*Bulgar', re.I),
    re.compile(r'Super Liga.*Serb', re.I),
]

def is_excluded(match_name):
    for pat in EXCLUDED:
        if pat.search(match_name):
            return True
    return False

def is_bad_league(entry):
    """Exclure les championnats problématiques via le champ sport (index 6)."""
    if isinstance(entry, list) and len(entry) > 6:
        sport = str(entry[6])
        return any(p.search(sport) for p in BAD_LEAGUES)
    if isinstance(entry, dict):
        sport = str(entry.get('sport', '') or entry.get('league', ''))
        return any(p.search(sport) for p in BAD_LEAGUES)
    return False

with open('/opt/touslesmatchs/data/picks.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

original_count = len(data['history'])
new_history = []
for entry in data['history']:
    match_name = entry[1] if isinstance(entry, list) else entry.get('match', '')
    if not is_excluded(match_name) and not is_bad_league(entry):
        new_history.append(entry)

def parse_date(date_str):
    for fmt in ['%d/%m/%Y', '%Y-%m-%d']:
        try:
            return datetime.strptime(date_str, fmt)
        except:
            pass
    return datetime.min

new_history.sort(key=lambda x: parse_date(x[0]), reverse=True)

total = len(new_history)
won = sum(1 for e in new_history if e[5].upper() == 'GAGNÉ')
lost = sum(1 for e in new_history if e[5].upper() == 'PERDU')
pending = sum(1 for e in new_history if e[5].upper() == 'EN ATTENTE')
winrate = round(won / (won+lost) * 100) if (won+lost) > 0 else 0

data['history'] = new_history
data['stats'] = {
    'total': total,
    'won': won,
    'lost': lost,
    'pending': pending,
    'winrate': winrate
}

with open('/opt/touslesmatchs/data/picks.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Nettoyage terminé. {original_count} -> {total} picks conservés.")
print(f"Taux de réussite actuel : {winrate}%")
