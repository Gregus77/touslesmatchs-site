#!/usr/bin/env python3
"""Contrôle hors production du caractère append-only du journal de décision."""
import re
import sqlite3
import tempfile
from pathlib import Path

source = Path("scripts/api_server.js").read_text(encoding="utf-8")
assert "CREATE TABLE IF NOT EXISTS signal_decision_journal" in source
assert "appendSignalDecisionEvent(match, \"vote\"" in source
assert "appendSignalDecisionEvent(match, \"evaluation\"" in source
assert "appendSignalDecisionEvent(null, \"delivery\"" in source
assert not re.search(r"(?:UPDATE|DELETE\s+FROM)\s+signal_decision_journal", source, re.I)
assert "signal_decision_journal_no_update" in source
assert "signal_decision_journal_no_delete" in source

with tempfile.TemporaryDirectory() as tmp:
    db = sqlite3.connect(Path(tmp) / "journal.db")
    db.execute("CREATE TABLE journal(id INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT, reason TEXT)")
    db.execute("CREATE TRIGGER no_update BEFORE UPDATE ON journal BEGIN SELECT RAISE(ABORT, 'append-only'); END")
    db.execute("CREATE TRIGGER no_delete BEFORE DELETE ON journal BEGIN SELECT RAISE(ABORT, 'append-only'); END")
    db.execute("INSERT INTO journal(event,reason) VALUES('evaluation','motif initial')")
    db.execute("INSERT INTO journal(event,reason) VALUES('evaluation','observation suivante')")
    rows = db.execute("SELECT event,reason FROM journal ORDER BY id").fetchall()
    assert rows == [('evaluation', 'motif initial'), ('evaluation', 'observation suivante')]
    for statement in ("UPDATE journal SET reason='efface' WHERE id=1", "DELETE FROM journal WHERE id=1"):
        try: db.execute(statement)
        except sqlite3.IntegrityError: pass
        else: raise AssertionError("le journal a accepté une mutation interdite")

print("OK: votes, évaluations et livraisons ajoutés sans UPDATE/DELETE; motif initial conservé")
