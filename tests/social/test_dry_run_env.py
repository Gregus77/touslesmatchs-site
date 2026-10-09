import os,subprocess,sys,unittest
from pathlib import Path
class DryRunEnvironmentTests(unittest.TestCase):
 def test_environment_blocks_publish_before_any_configuration_or_transport(self):
  root=Path(__file__).resolve().parents[2]
  r=subprocess.run([sys.executable,str(root/'scripts/social/pipeline.py'),'once','--publish','--config','/nonexistent-dry-run-test.json'],env={**os.environ,'DRY_RUN':'1'},capture_output=True,text=True)
  self.assertEqual(r.returncode,1)
  self.assertIn('ValueError',r.stdout)
  self.assertNotIn('FileNotFoundError',r.stdout)
