import importlib.util
import os
import sqlite3
import tempfile
import time
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("tlm_autodirector.py")
SPEC = importlib.util.spec_from_file_location("tlm_autodirector", MODULE_PATH)
director = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(director)


class DirectorTests(unittest.TestCase):
    def test_redacts_supported_secret_formats(self):
        value = (
            "xkeysib-abcdefghijklmnopqrstuvwxyz sk-proj-abcdefghijklmnopqrstuvwxyz "
            "123456789:AbCdEfGhIjKlMnOpQrStUvWxYz whsec_abcdefghijklmnopqrstuvwxyz "
            "Authorization: Bearer abcdefghijklmnopqrstuvwxyz chat_id=-123456789"
        )
        cleaned = director.redact(value)
        self.assertNotIn("xkeysib-abc", cleaned)
        self.assertNotIn("sk-proj-abc", cleaned)
        self.assertNotIn("123456789:", cleaned)
        self.assertNotIn("whsec_abc", cleaned)
        self.assertNotIn("Bearer abc", cleaned)
        self.assertNotIn("chat_id=-123", cleaned)

    def test_report_cadence_changes_with_incident_fingerprint(self):
        state = {"last_report_at": time.time(), "last_report_fingerprint": "old"}
        self.assertTrue(director.should_report(state, "new", True, False))
        self.assertFalse(director.should_report(state, "old", True, False))
        self.assertTrue(director.should_report(state, "old", True, True))

    def test_source_rule_conflict_is_detected_without_edit(self):
        with tempfile.TemporaryDirectory() as temp:
            scripts = Path(temp) / "scripts"
            scripts.mkdir()
            source = scripts / "api_server.js"
            original = (
                "const RECOVERY_MIN_CONVERGENT_INDICATORS = 3;\n"
                "const ok = combinedAligned && recentTrendAligned && venueAligned && liveAligned;\n"
            )
            source.write_text(original, encoding="utf-8")
            previous = director.PROJECT_DIR
            director.PROJECT_DIR = Path(temp)
            issues = []
            try:
                director.inspect_source(issues)
            finally:
                director.PROJECT_DIR = previous
            self.assertEqual(source.read_text(encoding="utf-8"), original)
            self.assertEqual(issues[0]["code"], "recovery_rule_conflict")

    def test_database_evidence_is_read_only_and_counted(self):
        with tempfile.TemporaryDirectory() as temp:
            database = Path(temp) / "tlm.db"
            db = sqlite3.connect(database)
            db.executescript("""
                CREATE TABLE concile_analyses (
                  analysed_at TEXT, diffusion_block TEXT
                );
                CREATE TABLE telegram_signal_deliveries (
                  created_at TEXT, ok INTEGER, telegram_message_id INTEGER
                );
                CREATE TABLE agent_calls (
                  created_at TEXT, issue TEXT, vote_produit INTEGER
                );
                INSERT INTO concile_analyses VALUES (datetime('now'), 'cote absente');
                INSERT INTO telegram_signal_deliveries VALUES (datetime('now'), 1, 42);
                INSERT INTO agent_calls VALUES (datetime('now'), 'ok', 1);
            """)
            db.commit()
            db.close()
            previous = director.DB_PATH
            director.DB_PATH = database
            issues = []
            try:
                stats = director.inspect_database(issues)
            finally:
                director.DB_PATH = previous
            self.assertEqual(stats["integrity"], "ok")
            self.assertEqual(stats["analyses_24h"], 1)
            self.assertEqual(stats["telegram_24h"], 1)
            self.assertEqual(stats["agent_calls_24h"], 1)
            self.assertFalse(issues)


if __name__ == "__main__":
    unittest.main()
