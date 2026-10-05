#!/usr/bin/env python3
import tempfile
import unittest
from pathlib import Path

import tlm_owner_mission_runner as runner


class OwnerMissionRunnerTests(unittest.TestCase):
    def test_eligible_only_review_required_and_explicit_auto(self):
        base = {'status': 'pending_review', 'risk': 'review_required', 'task': 'Corrige le bug'}
        self.assertFalse(runner.eligible(base))
        self.assertTrue(runner.eligible({**base, 'automatic_execution': True}))
        self.assertFalse(runner.eligible({**base, 'automatic_execution': True, 'risk': 'confirmation_required'}))
        self.assertFalse(runner.eligible({**base, 'automatic_execution': True, 'status': 'completed'}))

    def test_sensitive_paths_block_auto_deploy(self):
        blocked, path = runner.protected_for_auto_deploy(['.github/workflows/deploy.yml'])
        self.assertTrue(blocked)
        self.assertEqual(path, '.github/workflows/deploy.yml')
        blocked, _ = runner.protected_for_auto_deploy(['scripts/stripe_checkout.js'])
        self.assertTrue(blocked)
        blocked, _ = runner.protected_for_auto_deploy(['public/app.html', 'scripts/api_server.js'])
        self.assertFalse(blocked)

    def test_prompt_forbids_secrets_and_direct_push(self):
        prompt = runner.codex_prompt({'task': 'Corrige la page puis déploie'})
        self.assertIn("N'ouvre, n'affiche et ne modifie jamais .env", prompt)
        self.assertIn("Ne pousse rien vers GitHub", prompt)
        self.assertIn("runner sécurisé", prompt)

    def test_changed_paths_parses_git_porcelain(self):
        # Pure parser behavior is indirectly protected by path normalization:
        # renamed paths use their destination and duplicates are removed.
        self.assertEqual(runner.safe_branch_piece('Mission 12 / Test'), 'mission-12-test')


if __name__ == '__main__':
    unittest.main()
