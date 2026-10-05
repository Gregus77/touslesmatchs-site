#!/usr/bin/env python3
import unittest

from tlm_owner_mission_runner import eligible, mission_prompt, protected_change


class OwnerMissionRunnerTests(unittest.TestCase):
    def test_only_new_safe_pending_execution_runs(self):
        base = {
            'runner_version': 1,
            'automatic_execution': True,
            'status': 'pending_execution',
            'risk': 'review_required',
        }
        self.assertTrue(eligible(base))
        self.assertFalse(eligible({**base, 'runner_version': 0}))
        self.assertFalse(eligible({**base, 'automatic_execution': False}))
        self.assertFalse(eligible({**base, 'status': 'pending_review'}))
        self.assertFalse(eligible({**base, 'risk': 'confirmation_required'}))

    def test_protected_paths_are_blocked(self):
        self.assertTrue(protected_change(['.env']))
        self.assertTrue(protected_change(['data/tlm.db']))
        self.assertTrue(protected_change(['secrets/key.txt']))
        self.assertFalse(protected_change(['public/index.html']))
        self.assertFalse(protected_change(['scripts/api_server.js']))

    def test_prompt_keeps_production_and_secrets_out(self):
        prompt = mission_prompt({'task': 'Corrige le texte de la page accueil'})
        self.assertIn('Ne modifie jamais directement /opt/touslesmatchs', prompt)
        self.assertIn("Ne lis, n'affiche et ne modifie aucun secret", prompt)
        self.assertIn('Ne déploie pas directement la production', prompt)


if __name__ == '__main__':
    unittest.main()
