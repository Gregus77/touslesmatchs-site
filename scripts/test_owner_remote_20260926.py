import pathlib
import tempfile
import unittest

from tlm_owner_remote import authorized, handle, handle_text, mission_risk, read_intent, should_process_update


class Security(unittest.TestCase):
    def setUp(self):
        self.env = {'TELEGRAM_ADMIN_USER_ID': '11', 'TELEGRAM_ADMIN_CHAT_ID': '22'}
        self.good = {'from': {'id': 11}, 'chat': {'id': 22}, 'text': '/disk', 'message_id': 3}
        self.state = {'disk_percent': 81, 'official': 2, 'results': []}

    def test_restricted(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d)
            self.assertIn('81', handle(self.good, self.env, self.state, p))
            self.assertIsNone(handle({**self.good, 'from': {'id': 12}}, self.env, self.state, p))
            self.assertIsNone(handle({**self.good, 'chat': {'id': 23}}, self.env, self.state, p))
            self.assertFalse(authorized(self.good, {'TELEGRAM_ADMIN_CHAT_ID': '22'}))
            self.assertFalse(authorized({**self.good, 'sender_chat': {'id': 22}}, self.env))
            self.assertIn('refusée', handle({**self.good, 'text': '/exec rm -rf /'}, self.env, self.state, p))
            self.assertEqual(list(p.iterdir()), [])

    def test_mission_persisted_once(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d)
            self.assertIn('Codex', handle({**self.good, 'text': '/mission audit sans modification'}, self.env, self.state, p))
            self.assertEqual(len(list(p.iterdir())), 1)
            handle({**self.good, 'text': '/mission autre'}, self.env, self.state, p)
            self.assertEqual(len(list(p.iterdir())), 1)

    def test_natural_read_intents(self):
        self.assertEqual(read_intent('Est-ce que la production fonctionne ?'), '/status')
        self.assertEqual(read_intent('Combien de signaux ont été envoyés ?'), '/signaux')
        self.assertEqual(read_intent('Quel est le budget OpenRouter ?'), '/budget')

    def test_natural_text_becomes_mission(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d)
            answer = handle_text('Répare le VPS sans rien supprimer', self.good, self.env, self.state, p)
            self.assertIn('Codex', answer)
            files = list(p.iterdir())
            self.assertEqual(len(files), 1)
            payload = __import__('json').loads(files[0].read_text())
            self.assertEqual(payload['status'], 'pending_execution')
            self.assertTrue(payload['automatic_execution'])
            self.assertEqual(payload['runner_version'], 1)


    def test_sensitive_mission_waits_for_confirmation(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d)
            answer = handle_text('Fais un virement bancaire de 100 euros', self.good, self.env, self.state, p)
            self.assertIn('Confirmation obligatoire', answer)
            payload = __import__('json').loads(next(p.iterdir()).read_text())
            self.assertEqual(payload['status'], 'awaiting_confirmation')
            self.assertFalse(payload['automatic_execution'])

    def test_persistent_offset_makes_restart_replay_safe(self):
        self.assertTrue(should_process_update({'date': 1}, True, False, True))
        self.assertTrue(should_process_update({'date': 1}, False, True, True))
        self.assertFalse(should_process_update({'date': 1}, True, False, False))
        self.assertFalse(should_process_update({'date': 1}, False, False, True))

    def test_sensitive_actions_require_confirmation(self):
        self.assertEqual(mission_risk('Fais un virement bancaire de 100 euros'), 'confirmation_required')
        self.assertEqual(mission_risk('Change le mot de passe'), 'confirmation_required')
        self.assertEqual(mission_risk('Change la stratégie sportive'), 'confirmation_required')
        self.assertEqual(mission_risk('Redémarre le service API'), 'review_required')


if __name__ == '__main__':
    unittest.main()
