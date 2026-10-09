import json, os, pathlib, subprocess, tempfile, unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
class DiagnosticTests(unittest.TestCase):
    def test_disabled_publish_reports_reason_without_creating_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            cfg=pathlib.Path(tmp)/'config.json'
            state=pathlib.Path(tmp)/'state'
            cfg.write_text(json.dumps({'enabled':False,'stateDir':str(state)}))
            env={**os.environ,'DRY_RUN':'0'}
            result=subprocess.run(['python3',str(ROOT/'scripts/social/pipeline.py'),'once','--publish','--config',str(cfg)],capture_output=True,text=True,env=env)
            self.assertEqual(result.returncode,1)
            self.assertEqual(json.loads(result.stdout)['reason'],'publication_disabled')
            self.assertFalse(state.exists())
    def test_unknown_exception_never_exposes_secret(self):
        with tempfile.TemporaryDirectory() as tmp:
            cfg=pathlib.Path(tmp)/'config.json'
            cfg.write_text(json.dumps({'enabled':True,'stateDir':str(pathlib.Path(tmp)/'state'),'sourceFile':'/fake/secret-token-do-not-print'}))
            result=subprocess.run(['python3',str(ROOT/'scripts/social/pipeline.py'),'once','--config',str(cfg),'--output',str(pathlib.Path(tmp)/'test')],capture_output=True,text=True)
            self.assertEqual(result.returncode,1)
            self.assertNotIn('secret-token',result.stdout+result.stderr)
            self.assertNotIn('reason',json.loads(result.stdout))
    def test_launcher_preserves_dry_run_before_any_publication(self):
        env={**os.environ,'DRY_RUN':'1','NODE_PATH':'/opt/touslesmatchs/node_modules'}
        result=subprocess.run(['node',str(ROOT/'scripts/social/run_once.cjs'),'once','--publish'],capture_output=True,text=True,env=env)
        self.assertEqual(result.returncode,1)
        self.assertEqual(json.loads(result.stdout)['reason'],'dry_run_publish_forbidden')
