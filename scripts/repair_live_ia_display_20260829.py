#!/usr/bin/env python3
"""Répare le JavaScript Live IA sans toucher au flux ni aux données sportives."""

from datetime import datetime
import os
from pathlib import Path
import shutil
import sys


ROOT = Path(__file__).resolve().parents[1]
PAGE = Path(os.environ.get("TLM_LIVE_IA_FILE", ROOT / "public" / "live-ia.html"))
BACKUP_ROOT = Path(os.environ.get("TLM_BACKUP_ROOT", "/opt/backups"))


def main():
    if not PAGE.is_file():
        raise RuntimeError(f"page absente: {PAGE}")
    original = PAGE.read_text(encoding="utf-8")
    html = original

    # Le hotfix de tri avait été injecté dans une balise <script src=...>.
    # Avec un attribut src, le navigateur ignore le JavaScript inline : les
    # fonctions tlmTimeFirstSort/tlmTimeSection restaient donc indéfinies.
    broken = '''  <script src="/js/tlm-wow-theme.js?v=20260805" defer>

/* TLM_TIME_FIRST_ORDER_V1'''
    fixed = '''  <script src="/js/tlm-wow-theme.js?v=20260805" defer></script>
  <script>
/* TLM_TIME_FIRST_ORDER_V1'''
    if broken in html:
        html = html.replace(broken, fixed, 1)
    elif "TLM_TIME_FIRST_ORDER_V1" in html:
        correct = '<script src="/js/tlm-wow-theme.js?v=20260805" defer></script>\n  <script>\n/* TLM_TIME_FIRST_ORDER_V1'
        if correct not in html:
            raise RuntimeError("bloc de tri présent mais structure de scripts inconnue")

    # Le conteneur #loading est supprimé lorsque renderMatches remplace le
    # contenu. Ne jamais provoquer une deuxième erreur en essayant de le cacher.
    old_loader = '''    document.getElementById("loading").style.display = "none";
  }).catch(function() {
    document.getElementById("loading").style.display = "none";
    showEmpty();'''
    safe_loader = '''    var loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";
  }).catch(function(error) {
    console.error("[Live IA] affichage des matchs impossible:", error);
    var loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";
    showEmpty();'''
    if old_loader in html:
        html = html.replace(old_loader, safe_loader, 1)
    elif "[Live IA] affichage des matchs impossible:" not in html:
        raise RuntimeError("gestion du chargement Live IA introuvable")

    required = [
        'defer></script>\n  <script>\n/* TLM_TIME_FIRST_ORDER_V1',
        "function tlmTimeSection(m)",
        "function tlmTimeFirstSort(a,b)",
        "filtered.sort(tlmTimeFirstSort)",
        "if (loading) loading.style.display",
    ]
    missing = [item for item in required if item not in html]
    if missing:
        raise RuntimeError(f"validation refusée; éléments absents: {missing}")

    if html == original:
        print("OK: page Live IA déjà conforme; aucun fichier modifié")
        return 0

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = BACKUP_ROOT / f"tlm-live-ia-display-{stamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    shutil.copy2(PAGE, backup_dir / "live-ia.html")
    PAGE.write_text(html, encoding="utf-8")
    print(f"OK: page Live IA réparée; sauvegarde={backup_dir / 'live-ia.html'}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"BLOQUÉ: {exc}", file=sys.stderr)
        sys.exit(1)
