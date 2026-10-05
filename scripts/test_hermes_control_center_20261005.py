#!/usr/bin/env python3
import pathlib
import sqlite3
import tempfile
import unittest

from tlm_guardian import report
from tlm_owner_remote import (
    authorized,
    bootstrap_whoami,
    handle,
    handle_text,
    mission_risk,
)


class HermesControlCenterTests(unittest.TestCase):
    def setUp(self):
        self.env = {
            'TELEGRAM_ADMIN_USER_ID': '11',
            'TELEGRAM_ADMIN_CHAT_ID': '22',
        }
        self.message = {
            'from': {'id': 11, 'is_bot': False},
            'chat': {'id': 22},
            'text': '/disk',
            'message_id': 7,
        }
        self.state = {
            'disk_percent': 72,
            'football': {'detected': 3, 'eligible': 1},
            'analyses': 2,
            'votes': {'0': 0, '1': 0, '2': 0, '3': 0, '4': 1, '5': 0},
            'incidents': [],
            'goal05': {'enabled': True, 'push_enabled': True},
        }

    def test_strict_owner_authorization(self):
        self.assertTrue(authorized(self.message, self.env))
        self.assertFalse(authorized({**self.message, 'from': {'id': 12}}, self.env))
        self.assertFalse(authorized({**self.message, 'chat': {'id': 23}}, self.env))
        self.assertFalse(authorized({**self.message, 'sender_chat': {'id': 22}}, self.env))

    def test_read_only_natural_language(self):
        with tempfile.TemporaryDirectory() as directory:
            answer = handle_text(
                'Quel est le statut de la production ?',
                self.message,
                self.env,
                self.state,
                pathlib.Path(directory),
            )
            self.assertIn('rapport propriétaire', answer)
            self.assertEqual(list(pathlib.Path(directory).iterdir()), [])

    def test_natural_mission_is_routed_to_sandboxed_codex(self):
        with tempfile.TemporaryDirectory() as directory:
            inbox = pathlib.Path(directory)
            answer = handle_text(
                'Répare le VPS sans toucher aux règles sportives',
                self.message,
                self.env,
                self.state,
                inbox,
            )
            self.assertIn('Codex', answer)
            files = list(inbox.iterdir())
            self.assertEqual(len(files), 1)
            payload = __import__('json').loads(files[0].read_text())
            self.assertTrue(payload['automatic_execution'])
            self.assertEqual(payload['status'], 'pending_execution')
            self.assertEqual(payload['runner_version'], 1)

    def test_sensitive_mission_requires_confirmation(self):
        self.assertEqual(mission_risk('Fais un virement bancaire'), 'confirmation_required')
        self.assertEqual(mission_risk('change les règles sportives'), 'confirmation_required')
        self.assertEqual(mission_risk('redémarre API'), 'review_required')

    def test_unknown_slash_command_is_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            answer = handle(
                {**self.message, 'text': '/exec rm -rf /'},
                self.env,
                self.state,
                pathlib.Path(directory),
            )
            self.assertIn('refusée', answer)
            self.assertEqual(list(pathlib.Path(directory).iterdir()), [])

    def test_whoami_bootstrap_only_when_owner_id_missing(self):
        message = {**self.message, 'text': '/whoami'}
        env = {'TELEGRAM_ADMIN_CHAT_ID': '22'}
        self.assertTrue(bootstrap_whoami(message, env))
        self.assertFalse(bootstrap_whoami({**message, 'chat': {'id': 23}}, env))
        self.assertFalse(bootstrap_whoami(message, self.env))

    def test_guardian_uses_goal05_policy_not_old_ou25_quorum(self):
        db = sqlite3.connect(':memory:')
        state = report(
            db,
            {'GOAL05_ENABLED': '1', 'GOAL05_PUSH_ENABLED': '1'},
            live={'matches': []},
            disk=50,
        )
        self.assertEqual(state['goal05']['min_votes'], 4)
        self.assertEqual(state['goal05']['from_minute'], 30)
        self.assertEqual(state['goal05']['to_minute'], 85)
        self.assertEqual(state['goal05']['min_real_fresh_odd'], 1.60)
        self.assertNotIn('protected_quorum_changed', [x.get('type') for x in state['incidents']])

    def test_guardian_alerts_if_goal05_runtime_disabled(self):
        db = sqlite3.connect(':memory:')
        state = report(db, {}, live={'matches': []}, disk=50)
        incidents = {x.get('type') for x in state['incidents']}
        self.assertIn('goal05_runtime_disabled', incidents)
        self.assertIn('goal05_push_disabled', incidents)


if __name__ == '__main__':
    unittest.main()
