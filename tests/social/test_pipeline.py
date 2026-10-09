import copy, importlib.util, pathlib, tempfile, unittest, sqlite3
from datetime import datetime, timezone
P=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('pipeline',P/'scripts/social/pipeline.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
NOW=datetime(2030,1,1,12,tzinfo=timezone.utc).timestamp()
def fixture():
    return dict(fixtureId='999001',home='TEST Alpha',away='TEST Beta',targetTeam='TEST Alpha',targetSide='home',targetRank=1,opponentRank=12,total=12,country='France',countryCode='FR',competition='TEST League',kickoff='2030-01-01T15:00:00Z',verifiedAt='2030-01-01T11:59:00Z',whitelist=True,source='canonical_scanner',test=True)
class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.s=m.Store(pathlib.Path(self.tmp.name)/'state.db')
    def tearDown(self):self.s.db.close();self.tmp.cleanup()
    def test_surveillance_needs_no_odds(self):
        f=m.candidate(fixture(),NOW);self.assertEqual(f['targetTeam'],'TEST Alpha');self.assertNotIn('odd',f)
    def test_missing_and_wrong_types_rejected(self):
        for k,v in [('targetRank',None),('total',True),('whitelist',1),('targetRank','1'),('targetSide','unknown'),('countryCode',''),('fixtureId','../x')]:
            f=fixture();f[k]=v
            with self.subTest(k=k),self.assertRaises(ValueError):m.candidate(f,NOW)
    def test_late_or_stale_rejected(self):
        for now in [NOW+10800,NOW+14401,NOW-120]:
            with self.assertRaises(ValueError):m.candidate(fixture(),now)
    def test_not_top_bottom(self):
        f=fixture();f['opponentRank']=6
        with self.assertRaises(ValueError):m.candidate(f,NOW)
    def test_pair_requires_before(self):
        with self.assertRaises(ValueError):m.after(fixture(),{'status':'FT','home':1,'away':0,'source':'api-sports','fixtureId':'999001','verifiedAt':'2030-01-01T17:00:00Z'},None,NOW+18000)
    def test_observation_both_signs_no_stats(self):
        for goals,expected in [(0,'negative'),(1,'positive')]:
            f=fixture();r={'status':'FT','home':goals,'away':0,'source':'api-sports','fixtureId':'999001','verifiedAt':'2030-01-01T17:00:00Z'}
            a=m.after(f,r,{'createdAt':NOW,'facts':f},NOW+18000)
            self.assertEqual(a['classification'],'observation_'+expected)
            self.assertFalse(any(k in a for k in ['profit','winrate','odd','votes']))
    def test_unfinished_null_score_and_wrong_fixture_rejected(self):
        for patch in [{'status':'LIVE'},{'home':None},{'fixtureId':'other'},{'home':True}]:
            r=dict(status='FT',home=1,away=0,source='api-sports',fixtureId='999001',verifiedAt='2030-01-01T17:00:00Z');r.update(patch)
            with self.assertRaises(ValueError):m.after(fixture(),r,{'createdAt':NOW,'facts':fixture()},NOW+18000)
    def test_fr_en_same_facts_and_layout(self):
        f=fixture();a=m.content(f,'before','fr',True);b=m.content(f,'before','en',True)
        self.assertEqual(a['facts'],b['facts']);self.assertEqual(a['layout'],b['layout'])
        self.assertIn('TEST NE PAS DIFFUSER',a['caption']);self.assertIn('16:00',b['caption']);self.assertNotIn('WIN',a['caption'])
    def test_idempotence_and_uncertainty_persist(self):
        key='999001:before:fr:telegram_free'
        self.assertTrue(self.s.claim(key));self.assertFalse(self.s.claim(key))
        self.s.finish(key,'uncertain',{});self.assertFalse(self.s.claim(key))
        other=m.Store(pathlib.Path(self.tmp.name)/'state.db');self.assertFalse(other.claim(key));other.db.close()
    def test_success_requires_proof(self):
        for d in [{'ok':True},{'ok':True,'result':{'message_id':True}},{'ok':False,'result':{'message_id':1}}]:
            self.assertEqual(m.receipt('telegram_free',d)[0],'uncertain')
        self.assertEqual(m.receipt('telegram_free',{'ok':True,'result':{'message_id':23}}),('published',{'message_id':23}))
        self.assertEqual(m.receipt('instagram',{'status':'PENDING','id':1})[0],'pending')
        self.assertEqual(m.receipt('instagram',{'status':'PUBLISHED','id':1})[0],'uncertain')
    def test_reservation_budget_and_breaker(self):
        self.assertTrue(self.s.reserve_image('x','2030-01-01',100,100))
        self.assertFalse(self.s.reserve_image('x','2030-01-01',100,100))
        self.assertFalse(self.s.reserve_image('y','2030-01-01',100,100))
        self.s.breaker(429);self.assertFalse(self.s.reserve_image('z','2030-01-02',100,100))
    def test_dry_run_never_calls_transport(self):
        calls=[]
        c=m.content(fixture(),'before','fr',True)
        self.assertEqual(m.deliver(self.s,c,'telegram_free',lambda: calls.append(1),NOW,dry_run=True),'dry_run')
        self.assertEqual(calls,[])
    def test_timeout_does_not_retry_other_channel_works(self):
        c=m.content(fixture(),'before','en',False)
        def fail():raise TimeoutError()
        self.assertEqual(m.deliver(self.s,c,'telegram_free',fail,NOW),'uncertain')
        self.assertEqual(m.deliver(self.s,c,'telegram_free',lambda:self.fail('retry'),NOW),'already_claimed')
        self.assertEqual(m.deliver(self.s,c,'telegram_premium',lambda:{'ok':True,'result':{'message_id':9}},NOW),'published')
    def test_expiry_at_actual_send(self):
        c=m.content(fixture(),'before','fr',False)
        self.assertEqual(m.deliver(self.s,c,'telegram_free',lambda:self.fail('late send'),NOW+10800),'expired')
    def test_seed_does_not_send_fr(self):
        m.seed_october9(self.s)
        self.assertFalse(self.s.claim('1549031:before:fr:telegram_free'))
        self.assertTrue(self.s.claim('1549031:before:en:telegram_free'))
    def test_test_cards_cannot_send(self):
        c=m.content(fixture(),'before','en',True)
        with self.assertRaises(ValueError):m.deliver(self.s,c,'telegram_free',lambda:None,NOW)
if __name__=='__main__':unittest.main()

class IntegrationTests(unittest.TestCase):
    def test_offline_full_cycle_and_http(self):
        import http.server, threading, urllib.request, functools, json
        with tempfile.TemporaryDirectory() as tmp:
            s=m.Store(pathlib.Path(tmp)/'state.db');cfg={'countryCodes':{'France':'FR'}}
            f=fixture();source={'schema':1,'matches':{'999001':f}}
            # Network transport replaced with an assertion: any accidental send fails the test.
            old=m.request;m.request=lambda *a,**k: self.fail('network in dry run')
            try:
                a=m.process(source,s,cfg,pathlib.Path(tmp),NOW,True,True)
                f['result']={'fixtureId':'999001','source':'api-sports','status':'FT','home':0,'away':1,'verifiedAt':'2030-01-01T17:00:00Z'}
                b=m.process(source,s,cfg,pathlib.Path(tmp),NOW+18000,True,True)
            finally:m.request=old
            self.assertEqual(a['blocked']+b['blocked'],[])
            self.assertEqual(s.db.execute('SELECT count(*) FROM cards').fetchone()[0],4)
            self.assertEqual(s.db.execute('SELECT count(*) FROM delivery').fetchone()[0],0)
            for phase in ['before','after']:
                for lang in ['fr','en']:self.assertTrue((pathlib.Path(tmp)/f'999001-{phase}-{lang}.png').read_bytes().startswith(m.PNG))
            class Quiet(http.server.SimpleHTTPRequestHandler):
                def log_message(self,*args):pass
            server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(pathlib.Path(tmp)/'web')))
            t=threading.Thread(target=server.serve_forever);t.start()
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{server.server_port}/social/current/fr.html') as r:
                    page=r.read().decode();self.assertEqual(r.status,200);self.assertIn('Observation négative',page);self.assertIn('TEST NE PAS DIFFUSER',page)
            finally:server.shutdown();t.join();server.server_close();s.db.close()
    def test_openai_403_persistent_circuit(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            s=m.Store(pathlib.Path(tmp)/'state.db');calls=[]
            def deny(*a,**k):calls.append(1);raise m.HttpFailure(403)
            cfg={'imageMode':'openai_required','imageModel':'TEST-model','imageReservationCents':100,'imageDailyCapCents':200}
            with patch.dict(m.os.environ,{'OPENAI_API_KEY':'TEST-NOT-A-SECRET'}),patch.object(m,'request',deny):
                with self.assertRaises(ValueError):m.background(s,m.content(fixture(),'before','fr'),cfg,pathlib.Path(tmp))
                with self.assertRaises(ValueError):m.background(s,m.content({**fixture(),'fixtureId':'999002'},'before','fr'),cfg,pathlib.Path(tmp))
            self.assertEqual(calls,[1]);s.db.close()
    def test_metricool_pending_not_published(self):
        r=m.metricool_receipt({'data':{'id':99,'providers':[{'network':'instagram','status':'PENDING'}]}},'instagram')
        self.assertEqual(m.receipt('instagram',r),('pending',{'id':99}))
    def test_flag_pixels(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as tmp:
            p=pathlib.Path(tmp)/'flag.png';m.render_card(m.content(fixture(),'before','fr',True),p)
            im=Image.open(p)
            self.assertEqual(im.getpixel((935,60)),(0,35,149))

class OfficialEvidenceTests(unittest.TestCase):
    def test_result_requires_early_real_delivery_and_preserves_database(self):
        import json,hashlib
        with tempfile.TemporaryDirectory() as tmp:
            path=pathlib.Path(tmp)/'official.db';db=sqlite3.connect(path)
            db.executescript('''CREATE TABLE goal05_signal_registry(signal_key TEXT,fixture_id TEXT,team TEXT,minute INTEGER,odd REAL,votes INTEGER,criteria_json TEXT,created_at TEXT,score_home INTEGER,score_away INTEGER);
            CREATE TABLE goal05_signal_results(signal_key TEXT,outcome TEXT,final_score_home INTEGER,final_score_away INTEGER,resolved_at TEXT);
            CREATE TABLE telegram_signal_deliveries(match_key TEXT,ok INTEGER,telegram_message_id INTEGER,created_at TEXT);''')
            c={k:True for k in ['eligible','play','historicalVerified','formVerified','opponentConcedes','liveStatsVerified','motivationVerified','qualityVerified','oddFreshVerified','aiConsensusVerified']}
            c.update(policyVersion='goal05_v2_20261006',color='green',rating=8,coveragePct=75,oddFetchedAt='2030-01-01T15:39:00Z')
            db.execute('INSERT INTO goal05_signal_registry VALUES(?,?,?,?,?,?,?,?,?,?)',('test','999001','TEST Alpha',40,1.6,4,json.dumps(c),'2030-01-01T15:40:00Z',0,0))
            db.execute('INSERT INTO goal05_signal_results VALUES(?,?,?,?,?)',('test','loss',0,1,'2030-01-01T17:00:00Z'));db.commit()
            f={**fixture(),'result':{'home':0,'away':1}}
            self.assertIsNone(m.official_result(path,f))
            db.execute('INSERT INTO telegram_signal_deliveries VALUES(?,?,?,?)',('test',1,123,'2030-01-01 15:40:01'));db.commit()
            before=hashlib.sha256(path.read_bytes()).digest()
            self.assertEqual(m.official_result(path,f)['classification'],'LOSS')
            self.assertEqual(hashlib.sha256(path.read_bytes()).digest(),before)
            db.execute("UPDATE telegram_signal_deliveries SET created_at='2030-01-01 17:00:01'");db.commit()
            self.assertIsNone(m.official_result(path,f));db.close()
    def test_production_rejects_test_source(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            s=m.Store(pathlib.Path(tmp)/'state.db')
            with patch.object(m,'runtime_routes',return_value={'targets':[],'buttons':[]}):
                r=m.process({'schema':1,'matches':{'999001':fixture()}},s,{'webroot':tmp},pathlib.Path(tmp),NOW,dry_run=False)
            self.assertEqual(len(r['blocked']),1);self.assertEqual(s.db.execute('SELECT count(*) FROM cards').fetchone()[0],0);s.db.close()

class RaceAndImageTests(unittest.TestCase):
    def test_two_workers_only_one_claim(self):
        import threading
        with tempfile.TemporaryDirectory() as tmp:
            path=pathlib.Path(tmp)/'state.db';m.Store(path).db.close()
            barrier=threading.Barrier(2);results=[]
            def run():
                store=m.Store(path);barrier.wait();results.append(store.claim('999:before:fr:telegram_free'));store.db.close()
            workers=[threading.Thread(target=run) for _ in range(2)]
            for w in workers:w.start()
            for w in workers:w.join()
            self.assertEqual(sorted(results),[False,True])
    def test_image_png_prompt_provenance_reused_between_languages(self):
        import io,json,base64
        from PIL import Image
        from unittest.mock import patch
        b=io.BytesIO();Image.new('RGB',(2,2)).save(b,format='PNG')
        with tempfile.TemporaryDirectory() as tmp:
            s=m.Store(pathlib.Path(tmp)/'state.db');cfg={'imageMode':'openai_required','imageModel':'TEST-model','imageReservationCents':100,'imageDailyCapCents':100};calls=[]
            def transport(url,body,headers):
                calls.append(json.loads(body));return {'created':123,'data':[{'b64_json':base64.b64encode(b.getvalue()).decode()}],'usage':{'TEST':True}}
            with patch.dict(m.os.environ,{'OPENAI_API_KEY':'TEST-NOT-A-SECRET'}),patch.object(m,'request',transport):
                a=m.background(s,m.content(fixture(),'before','fr'),cfg,pathlib.Path(tmp))
                bpath=m.background(s,m.content(fixture(),'before','en'),cfg,pathlib.Path(tmp))
            self.assertEqual(a,bpath);self.assertEqual(len(calls),1);self.assertEqual(calls[0]['output_format'],'png')
            self.assertTrue(list(pathlib.Path(tmp).glob('*-prompt.json')));self.assertTrue(list(pathlib.Path(tmp).glob('*-response.json')));s.db.close()

class LatePublicationTests(unittest.TestCase):
    def test_site_cannot_first_publish_before_after_kickoff(self):
        with tempfile.TemporaryDirectory() as tmp:
            s=m.Store(pathlib.Path(tmp)/'state.db')
            f={**fixture(),'kickoff':'2000-01-01T12:00:00Z'}
            s.save_card(m.content(f,'before','fr'),0)
            m.site(s,pathlib.Path(tmp)/'web')
            page=(pathlib.Path(tmp)/'web/social/current/fr.html').read_text()
            self.assertNotIn('TEST Alpha',page);s.db.close()
    def test_after_requires_before_on_same_destination(self):
        with tempfile.TemporaryDirectory() as tmp:
            s=m.Store(pathlib.Path(tmp)/'state.db')
            f={**fixture(),'result':{'home':0,'away':1},'classification':'observation_negative'}
            c=m.content(f,'after','fr')
            self.assertEqual(m.deliver(s,c,'telegram_free',lambda:self.fail('unpaired'),NOW),'before_unpublished');s.db.close()
