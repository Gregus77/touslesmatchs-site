import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))
from tools import telegram_bot


class _Response:
    status_code = 200

    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


class TelegramReliabilityTests(unittest.TestCase):
    def setUp(self):
        telegram_bot.BOT_TOKEN = "mock-token"
        telegram_bot.API_URL = "https://api.telegram.org/botmock-token"
        telegram_bot.ADMIN_CHAT_ID = "admin-only"
        telegram_bot.FREE_CHANNEL_ID = "client-free"
        telegram_bot.PREMIUM_CHANNEL_ID = "client-premium"
        telegram_bot.COUNCIL_PUBLIC_TELEGRAM = False
        telegram_bot.LAST_DELIVERY_PROOF = None

    def test_admin_report_escapes_special_and_multilingual_text(self):
        calls = []

        def send(_url, json, timeout):
            calls.append(json)
            return _Response({"ok": True, "result": {"message_id": 100 + len(calls)}})

        report = {
            "date": "14/09/2026 <audit>",
            "total_matches": 4,
            "sports": "Football & хоккей",
            "decision": "NOPICK",
            "agents": "IA <Alpha> & βeta — 日本語",
            "excluded": "Agent X: 54% (< 55%)",
            "winrate": 70,
            "roi": 4.2,
            "total_picks": 20,
            "improvement": "Aucun <script> & contrôle multilingue",
        }
        with patch.object(telegram_bot.requests, "post", side_effect=send):
            self.assertTrue(telegram_bot.send_daily_report(report))
        self.assertEqual(len(calls), 1)
        rendered = calls[0]["text"]
        self.assertIn("&lt;audit&gt;", rendered)
        self.assertIn("&lt; 55%", rendered)
        self.assertNotIn("<script>", rendered)
        telegram_bot._validate_html(rendered)

    def test_long_html_is_split_and_every_chunk_has_delivery_proof(self):
        payloads = []

        def send(_url, json, timeout):
            payloads.append(json)
            return _Response({"ok": True, "result": {"message_id": len(payloads)}})

        text = "\n".join(f"<b>Ligne {i}</b> — données &amp; contrôle" for i in range(500))
        with patch.object(telegram_bot.requests, "post", side_effect=send):
            self.assertTrue(telegram_bot._send_message("admin-only", text))
        self.assertGreater(len(payloads), 1)
        self.assertEqual(
            telegram_bot.LAST_DELIVERY_PROOF,
            {"message_ids": tuple(range(1, len(payloads) + 1))},
        )
        for payload in payloads:
            self.assertLessEqual(len(payload["text"]), telegram_bot.TELEGRAM_MAX_LENGTH)
            telegram_bot._validate_html(payload["text"])

    def test_single_long_tagged_line_is_split_with_balanced_tags(self):
        chunks = telegram_bot._split_html_message("<b>" + ("équipe &amp; contrôle " * 500) + "</b>")
        self.assertGreater(len(chunks), 1)
        for chunk in chunks:
            self.assertLessEqual(len(chunk), telegram_bot.TELEGRAM_MAX_LENGTH)
            self.assertTrue(chunk.startswith("<b>"))
            self.assertTrue(chunk.endswith("</b>"))
            telegram_bot._validate_html(chunk)

    def test_unsupported_tag_is_rejected_before_transport(self):
        with patch.object(telegram_bot.requests, "post") as send:
            self.assertFalse(telegram_bot._send_message("admin-only", "<script>bad</script>"))
            send.assert_not_called()

    def test_ok_without_integer_message_id_is_not_delivered(self):
        with patch.object(telegram_bot.requests, "post", return_value=_Response({"ok": True})):
            self.assertFalse(telegram_bot._send_message("admin-only", "<b>TEST</b>"))
        self.assertIsNone(telegram_bot.LAST_DELIVERY_PROOF)

    def test_public_test_is_blocked(self):
        with patch.object(telegram_bot.requests, "post") as send:
            self.assertFalse(telegram_bot._send_message("client-free", "TEST TECHNIQUE"))
            send.assert_not_called()


if __name__ == "__main__":
    unittest.main()
