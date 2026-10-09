#!/usr/bin/env python3
"""Targeted, guarded deployment. Preserve current image and roll back on failure."""
import base64, gzip, hashlib, json, os, shutil, sqlite3, subprocess, tempfile, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path('/opt/touslesmatchs')
EXPECTED='8ba054e75f5e509e716cf6a0ca24a24d5ab1cf40d11f304e17f7052e78b21689'
END='2026-11-08T00:00:00+01:00'
def run(args,**kwargs):
    merge=kwargs.pop("merge",False)
    p=subprocess.run(args,capture_output=True,**kwargs)
    if p.returncode:raise RuntimeError('command_failed:'+args[0]+':'+str(p.returncode))
    return p.stdout+p.stderr if merge else p.stdout

def main(source_b64,test_b64):
    source=gzip.decompress(base64.b64decode(source_b64));digest=hashlib.sha256(source).hexdigest()
    db=sqlite3.connect((ROOT/'data/tlm_telegram_probe.sqlite').as_uri()+'?mode=ro',uri=True)
    rows=db.execute("SELECT key,state,message_id FROM probes WHERE key LIKE 'tlm-telegram-test-20261009:%'").fetchall();db.close()
    assert len(rows)==3 and all(r[1]=='delivered' and r[2]>0 for r in rows),'three_TEST_receipts_required'
    active=json.loads(run(['docker','inspect','touslesmatchs-api']))[0]
    assert active['State']['Running'],'api_not_running'
    runtime=run(['docker','exec','touslesmatchs-api','cat','/app/telegram_client.js'])
    module=ROOT/'scripts/telegram_client.js'
    assert hashlib.sha256(module.read_bytes()).hexdigest() in [EXPECTED,digest],'working_module_changed'
    assert hashlib.sha256(runtime).hexdigest() in [EXPECTED,digest],'runtime_module_changed'
    started=datetime.now(timezone.utc)
    stamp=started.strftime('%Y%m%dT%H%M%SZ')
    backup=Path('/opt/backups')/('telegram-campaign-'+stamp);backup.mkdir(mode=0o700)
    envpath=ROOT/'.env';shutil.copy2(envpath,backup/'.env');os.chmod(backup/'.env',0o600)
    shutil.copy2(module,backup/'telegram_client.js')
    oldenv=dict(x.split('=',1) for x in active['Config']['Env'] if '=' in x)
    originalimage=active['Image']
    rollback=backup/'rollback.compose.json';rollback.write_text(json.dumps({'services':{'api':{'image':originalimage,'environment':oldenv}}}));os.chmod(rollback,0o600)
    changed=False
    stage="candidate_test"
    try:
        with tempfile.TemporaryDirectory(prefix='tlm-telegram-build-') as tmp:
            tmp=Path(tmp);(tmp/'telegram_client.js').write_bytes(source)
            (tmp/'test.js').write_bytes(gzip.decompress(base64.b64decode(test_b64)))
            shutil.copy2(ROOT/'scripts/bookmakers.config.js',tmp/'bookmakers.config.js')
            run(['node',str(tmp/'test.js')])
            (tmp/'Dockerfile').write_text('FROM '+originalimage+'\nCOPY telegram_client.js /app/telegram_client.js\n')
            image='tlm-api-telegram-campaign:'+stamp.lower()
            stage='image_build'
            run(['docker','build','--network=none','-t',image,str(tmp)])
        stage='configuration'
        values={'GOAL05_ENABLED':'1','GOAL05_PUSH_ENABLED':'1','TLM_LAUNCH_ALL_ACCESS':'1','TLM_FREE_OFFER_CONFIRMED':'1','TLM_FREE_OFFER_ENDS_AT':END}
        lines=envpath.read_text().splitlines();lines=[x for x in lines if x.partition('=')[0].strip() not in values]
        lines += [k+'='+v for k,v in values.items()]
        envpath.write_text('\n'.join(lines)+'\n');os.chmod(envpath,0o600)
        module.write_bytes(source)
        deployroot=Path('/opt/tlm-telegram-runtime');deployroot.mkdir(mode=0o700,exist_ok=True)
        override=deployroot/'campaign.compose.json';override.write_text(json.dumps({'services':{'api':{'image':image,'environment':{**oldenv,**values}}}}));os.chmod(override,0o600)
        compose=['docker','compose','-f',str(ROOT/'docker-compose.yml'),'-f',str(override)]
        changed=True
        run(compose+['config','--quiet'],cwd=ROOT)
        stage='api_recreate'
        run(compose+['up','-d','--no-build','--no-deps','--force-recreate','api'],cwd=ROOT)
        stage="health_validation"
        success=False
        for _ in range(18):
            try:
                env=json.loads(run(['docker','exec','touslesmatchs-api','node','-e','console.log(JSON.stringify(Object.fromEntries('+json.dumps(list(values))+'.map(k=>[k,process.env[k]]))))']))
                actual=run(['docker','exec','touslesmatchs-api','cat','/app/telegram_client.js'])
                with urllib.request.urlopen('https://www.touslesmatchs.com/api/health',timeout=10) as r:health=json.load(r)
                if env==values and hashlib.sha256(actual).hexdigest()==digest and health.get('ok') and health.get('integrations',{}).get('telegram',{}).get('ok'):
                    success=True;break
            except Exception:pass
            time.sleep(3)
        assert success,'post_deploy_health_or_hash_failed'
        stage="observer_validation"
        observer=False
        for _ in range(12):
            logs=run(['docker','logs','touslesmatchs-api','--since',started.isoformat()],merge=True)
            if b'[goal05] Observateur actif:' in logs and b'push=true' in logs:observer=True;break
            time.sleep(3)
        assert observer,'goal05_observer_not_confirmed'
        proof={'deployed_at':stamp,'module_sha256':digest,'campaign_end':END,'goal05_observer_active':True,'test_message_ids':{r[0].split(':')[-1]:r[2] for r in rows},'image':image,'backup':str(backup),'automatic_topup_performed':False}
        (deployroot/'checkpoint.json').write_text(json.dumps(proof));print('TELEGRAM_CAMPAIGN_DEPLOYED '+json.dumps(proof))
    except Exception as error:
        shutil.copy2(backup/'.env',envpath);shutil.copy2(backup/'telegram_client.js',module)
        if changed:run(['docker','compose','-f',str(ROOT/'docker-compose.yml'),'-f',str(rollback),'up','-d','--no-build','--no-deps','--force-recreate','api'],cwd=ROOT)
        raise RuntimeError('activation_failed_original_configuration_restored:'+stage+':'+str(error)[:120]) from None
