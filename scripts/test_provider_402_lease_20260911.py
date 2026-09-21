#!/usr/bin/env python3
"""Validation hors réseau du bail de revalidation d'un solde 402."""
import sqlite3
import tempfile
from pathlib import Path

with tempfile.TemporaryDirectory() as tmp:
    db = sqlite3.connect(Path(tmp) / "health.db")
    db.execute("""CREATE TABLE provider_health (
      host TEXT PRIMARY KEY,last_status INTEGER,last_error TEXT,
      disabled_until TEXT,updated_at TEXT)""")
    db.execute("""INSERT INTO provider_health VALUES
      ('api.deepseek.com',402,'Insufficient Balance',datetime('now','-1 second'),datetime('now','-7 hours'))""")

    claim = db.execute("""UPDATE provider_health SET disabled_until=datetime('now','+6 hours')
      WHERE host=? AND last_status=402 AND disabled_until<=datetime('now')""", ('api.deepseek.com',))
    assert claim.rowcount == 1, "la première sonde après temporisation doit être accordée"
    second = db.execute("""UPDATE provider_health SET disabled_until=datetime('now','+6 hours')
      WHERE host=? AND last_status=402 AND disabled_until<=datetime('now')""", ('api.deepseek.com',))
    assert second.rowcount == 0, "une seconde sonde dans la même fenêtre doit être bloquée"
    db.execute("DELETE FROM provider_health WHERE host=? AND last_status=402", ('api.deepseek.com',))
    assert db.execute("SELECT COUNT(*) FROM provider_health").fetchone()[0] == 0, "un succès après recharge doit réarmer le fournisseur"

print("OK: une sonde 402 par fenêtre de 6 h, puis réarmement sur succès; aucun réseau")
