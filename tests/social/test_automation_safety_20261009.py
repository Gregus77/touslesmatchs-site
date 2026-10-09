"""Autonomous social workflow must not create unsupported or promotional posts."""
import importlib.util
import json
import pathlib
import tempfile
import unittest
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('social_pipeline',ROOT/'scripts/social/pipeline.py')
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class AutomatedPublicationGuards(unittest.TestCase):
    def test_approved_championships_only(self):
        for country,league in [('Danemark','Superliga'),('Norvège','Eliteserien'),
                               ('Irlande','First Division'),('Espagne','La Liga'),
                               ('Brésil','Serie B'),('South Korea','K League 1')]:
            with self.subTest(country=country):self.assertTrue(m.allowed_competition(country,league))
        for country,league in [('Koweït','Premier League'),('Kuwait','Premier League'),
                               ('Mexique','Liga MX'),('Norvège','2. Division'),
                               ('Denmark','Cup'),('England','Women Premier League')]:
            with self.subTest(country=country):self.assertFalse(m.allowed_competition(country,league))

    def test_deterministic_mode_skips_openai(self):
        f={'fixtureId':'99993','phase':'before','facts':{'fixtureId':'99993'}}
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                m.background(None,f,{'imageMode':'deterministic'},pathlib.Path(tmp))

    def test_public_cards_contain_facts_not_tips(self):
        facts=dict(fixtureId='99993',home='Alpha',away='Beta',targetTeam='Alpha',
                   targetSide='home',targetRank=1,opponentRank=12,total=12,
                   country='Danemark',countryCode='DK',competition='Superliga',
                   kickoff='2030-01-01T18:00:00Z',verifiedAt='2030-01-01T17:00:00Z',
                   whitelist=True,source='canonical_scanner')
        c=m.content(facts,'before','fr',facts_only=True)
        self.assertIn('Classements',c['caption'])
        self.assertNotIn('14,90',c['caption'])
        self.assertNotIn('Cible : +0,5',c['caption'])
        self.assertIsNone(c['cta'])

    def test_live_configuration_does_not_push_automatically_without_approval(self):
        cfg=json.loads((ROOT/'config/social-publication.json').read_text())
        self.assertEqual(cfg['imageMode'],'openai_required')
        self.assertEqual(cfg['publicationMode'],'facts_only')
        self.assertEqual(cfg['imageModel'],'gpt-image-2.5-flare')
        self.assertEqual(cfg['imageDailyCapCents'],0)
        self.assertIs(cfg['telegramEnabled'],False)
        self.assertIs(cfg['metricoolEnabled'],False)
        self.assertTrue(cfg['enabled'])


if __name__=='__main__':
    unittest.main()
