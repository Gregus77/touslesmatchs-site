import importlib.util,pathlib,unittest
p=pathlib.Path(__file__).with_name('ai_shadow_evidence.py');spec=importlib.util.spec_from_file_location('audit',p);audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
class AuditTests(unittest.TestCase):
 def test_known_btts_is_not_predictive(self):
  self.assertTrue(audit.determined('BTTS Oui',1,1));self.assertTrue(audit.determined('BTTS Non',1,1));self.assertFalse(audit.determined('BTTS Oui',1,0))
 def test_known_totals_are_not_predictive(self):
  for line,goals in [(0.5,1),(1.5,2),(2.5,3),(3.5,4)]:
   self.assertTrue(audit.determined(f'Over {line} buts',goals,0));self.assertTrue(audit.determined(f'Under {line} buts',goals,0));self.assertFalse(audit.determined(f'Over {line} buts',0,0))
 def test_missing_score_is_not_zero(self):
  self.assertIsNone(audit.determined('BTTS Oui',None,None));self.assertIsNone(audit.result('Under 2.5 buts',None,None))
 def test_settlement(self):
  for h in range(5):
   for a in range(5):
    self.assertEqual(audit.result('BTTS Oui',h,a),'win' if h>0 and a>0 else 'loss')
    self.assertEqual(audit.result('BTTS Non',h,a),'loss' if h>0 and a>0 else 'win')
    for line in [0.5,1.5,2.5,3.5]:
     self.assertEqual(audit.result(f'Over {line} buts',h,a),'win' if h+a>line else 'loss')
 def test_snapshot_identity(self):
  self.assertEqual(audit.state_key('123_2026-09-11_15_1-0'),('123_2026-09-11',15,1,0))
 def test_roi_no_synthetic_odds(self):
  row=dict(created_at='2026-09-11',source_id=1,outcome='win',verified_predictive=True,odd=None,selection='BTTS Oui',known=False,time_proven=True,outcome_mismatch=False)
  self.assertIsNone(audit.summarize([row])['roi_pct']);row['odd']=1.5;self.assertEqual(audit.summarize([row])['roi_pct'],50)
 def test_short_samples_not_last20_claim(self):
  row=dict(created_at='2026-09-11',source_id=1,outcome='win',verified_predictive=False,odd=None,selection='BTTS Oui',known=True,time_proven=True,outcome_mismatch=False)
  result=audit.summarize([row]);self.assertEqual(result['last20_n'],1);self.assertEqual(result['verified_predictive'],0)
 def test_repeated_snapshots_do_not_inflate_roi_or_recent_sample(self):
  row=dict(created_at='2026-09-11T12:00:00',source_id=1,event='fixture_day',actor='seat',model='model',market='ou25',outcome='win',verified_predictive=True,odd=1.5,selection='Under 2.5 buts',known=False,time_proven=True,outcome_mismatch=False)
  later=dict(row,created_at='2026-09-11T12:15:00',source_id=2,odd=1.9)
  result=audit.summarize([later,row])
  self.assertEqual(result['stored_resolved'],2)
  self.assertEqual(result['predictive_last20_n'],1)
  self.assertEqual(result['priced_n'],1)
  self.assertEqual(result['profit_units'],0.5)
if __name__=='__main__':unittest.main()
