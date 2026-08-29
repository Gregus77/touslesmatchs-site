#!/usr/bin/env python3
"""Ajoute uniquement Betclic à la zone partenaires de l'accueil."""

from datetime import datetime
import os
from pathlib import Path
import shutil
import sys


ROOT = Path(__file__).resolve().parents[1]
PAGE = Path(os.environ.get("TLM_HOME_FILE", ROOT / "public" / "index.html"))
BACKUP_ROOT = Path(os.environ.get("TLM_BACKUP_ROOT", "/opt/backups"))
BETCLIC_URL = "https://go.onelink.me/2887093520/6c3132b8?af_sub5=GREGA3GZ"


def main():
    if not PAGE.is_file():
        raise RuntimeError(f"page absente: {PAGE}")
    original = PAGE.read_text(encoding="utf-8")
    html = original

    pmu = '        <a href="https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728" target="_blank" rel="noopener sponsored" class="partner-btn pb-pmu">PMU</a>'
    betclic = f'        <a href="{BETCLIC_URL}" target="_blank" rel="noopener sponsored" class="partner-btn pb-betclic">Betclic</a>'

    if betclic not in html:
        if html.count(pmu) != 1:
            raise RuntimeError("bouton PMU unique introuvable dans la zone partenaires")
        html = html.replace(pmu, pmu + "\n" + betclic, 1)

    required = [
        'class="partner-btn pb-winamax">Winamax</a>',
        'class="partner-btn pb-unibet">Unibet</a>',
        'class="partner-btn pb-pmu">PMU</a>',
        f'href="{BETCLIC_URL}"',
        'rel="noopener sponsored" class="partner-btn pb-betclic">Betclic</a>',
    ]
    missing = [item for item in required if item not in html]
    if missing:
        raise RuntimeError(f"validation refusée; éléments absents: {missing}")

    if html == original:
        print("OK: bouton Betclic déjà présent; aucun fichier modifié")
        return 0

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = BACKUP_ROOT / f"tlm-home-betclic-{stamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    shutil.copy2(PAGE, backup_dir / "index.html")
    PAGE.write_text(html, encoding="utf-8")
    print(f"OK: bouton Betclic ajouté; sauvegarde={backup_dir / 'index.html'}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"BLOQUÉ: {exc}", file=sys.stderr)
        sys.exit(1)
