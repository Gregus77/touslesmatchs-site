#!/usr/bin/env python3
"""Hermes Guardian: read-only production supervisor.

Hermes observes production, reports incidents and delivery gaps, and sends the
owner report. It never changes sporting rules, decides a sporting signal, blocks
an otherwise valid sporting signal, or sends client signals.
"""
import datetime
import fcntl
import json
import os
import pathlib
import re
import sqlite3
import subprocess
import sys
import time
import urllib.parse
import urllib.request

from zoneinfo import ZoneInfo

ROOT = pathlib.Path(os.environ.get('TLM_ROOT', '/opt/touslesmatchs'))
DATA = ROOT / 'data'

CURRENT_GOAL05_POLICY = {
    'strategy': 'favorite_team_over_0_5',
    'structure': 'top5_vs_bottom5',
    'from_minute': 30,
    'to_minute': 85,
    'favorite_must_not_have_scored': True,
    'min_real_fresh_odd': 1.60,
    'min_votes': 4,
    'seats': 5,
}


def config():
    out = {}
    for line in (ROOT / '.env').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            out[key.strip()] = value.strip().strip('"\'')
    return out


def truthy(value):
    return str(value or '').strip().lower() in {'1', 'true', 'yes', 'on', 'enabled'}


def clean(value):
    return re.sub(
        r'(sk-[A-Za-z0-9_-]+|\d{8,}:[A-Za-z0-9_-]+)',
        '[secret masqué]',
        str(value),
    )[:3900]


def api(path):
    with urllib.request.urlopen('http://127.0.0.1:3001' + path, timeout=8) as response:
        return json.load(response)


def query_rows(db, sql):
    return [dict(row) for row in db.execute(sql)]


def table_exists(tables, name):
    return name in tables


def report(db, env, live=None, disk=None):
    db.row_factory = sqlite3.Row
    tables = {
        row[0]
        for row in db.execute("select name from sqlite_master where type='table'")
    }

    out = {
        'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'incidents': [],
        'goal05': {
            **CURRENT_GOAL05_POLICY,
            'enabled': truthy(env.get('GOAL05_ENABLED')),
            'push_enabled': truthy(env.get('GOAL05_PUSH_ENABLED')),
            'push_interval_min': env.get('GOAL05_PUSH_INTERVAL_MIN') or '5',
        },
    }

    if not out['goal05']['enabled']:
        out['incidents'].append({'type': 'goal05_runtime_disabled'})
    if not out['goal05']['push_enabled']:
        out['incidents'].append({'type': 'goal05_push_disabled'})

    out['football'] = {}
    if table_exists(tables, 'pipeline_observations'):
        out['football'] = dict(db.execute(
            "select count(*) detected, sum(eligible) eligible, "
            "sum(current_eligible AND datetime(last_seen)>datetime('now','-15 minutes')) live_eligible, "
            "min(first_seen) since "
            "from pipeline_observations "
            "where day=date('now') and sport='Football'"
        ).fetchone())

    out['analyses'] = (
        query_rows(
            db,
            "select count(*) n from concile_analyses where date(analysed_at)=date('now')",
        )[0]['n']
        if table_exists(tables, 'concile_analyses')
        else 0
    )

    out['votes'] = {str(index): 0 for index in range(6)}
    if table_exists(tables, 'official_vote_snapshots'):
        for row in query_rows(
            db,
            "select votes_json from official_vote_snapshots where date(created_at)=date('now')",
        ):
            try:
                votes = json.loads(row['votes_json'])
            except Exception:
                votes = []
            count = sum(vote.get('status') == 'voted' for vote in votes if isinstance(vote, dict))
            out['votes'][str(min(5, count))] += 1

    out['attempts'] = (
        query_rows(
            db,
            "select outcome,stage,reason_category,count(*) n "
            "from football_analysis_attempts where date(started_at)=date('now') "
            "group by outcome,stage,reason_category",
        )
        if table_exists(tables, 'football_analysis_attempts')
        else []
    )

    out['jev'] = (
        query_rows(
            db,
            "select final_decision,count(*) n from jev_decisions "
            "where date(created_at)=date('now') group by final_decision",
        )
        if table_exists(tables, 'jev_decisions')
        else []
    )

    out['official'] = (
        query_rows(
            db,
            "select count(*) n from official_signal_registry where date(created_at)=date('now')",
        )[0]['n']
        if table_exists(tables, 'official_signal_registry')
        else 0
    )

    out['telegram'] = (
        query_rows(
            db,
            "select channel,count(*) receipts,count(distinct official_signal_snapshot_id) signals "
            "from telegram_signal_deliveries "
            "where date(created_at)=date('now') and ok=1 "
            "and typeof(telegram_message_id)='integer' and telegram_message_id>0 "
            "group by channel",
        )
        if table_exists(tables, 'telegram_signal_deliveries')
        else []
    )

    out['results'] = (
        query_rows(
            db,
            "select outcome,count(*) n from official_signal_results "
            "where date(resolved_at)=date('now') group by outcome",
        )
        if table_exists(tables, 'official_signal_results')
        else []
    )

    if table_exists(tables, 'jev_decisions') and table_exists(tables, 'official_signal_registry'):
        missing_registry = query_rows(
            db,
            "select snapshot_id from jev_decisions j "
            "where final_decision='SEND' "
            "and datetime(created_at)>datetime('now','-1 day') "
            "and datetime(created_at)<datetime('now','-3 minutes') "
            "and not exists("
            "select 1 from official_signal_registry r "
            "where r.official_signal_snapshot_id=j.snapshot_id)",
        )
        if missing_registry:
            out['incidents'].append({
                'type': 'decision_send_without_registry',
                'count': len(missing_registry),
            })

    if table_exists(tables, 'official_signal_registry') and table_exists(tables, 'telegram_signal_deliveries'):
        missing_delivery = query_rows(
            db,
            "select r.official_signal_snapshot_id from official_signal_registry r "
            "where datetime(r.created_at)>datetime('now','-1 day') "
            "and datetime(r.created_at)<datetime('now','-3 minutes') "
            "and not exists("
            "select 1 from telegram_signal_deliveries d "
            "where d.official_signal_snapshot_id=r.official_signal_snapshot_id "
            "and d.ok=1 and typeof(d.telegram_message_id)='integer' "
            "and d.telegram_message_id>0 and d.channel='premium')",
        )
        if missing_delivery:
            out['incidents'].append({
                'type': 'official_without_premium_receipt',
                'count': len(missing_delivery),
            })

        orphan = query_rows(
            db,
            "select count(*) n from telegram_signal_deliveries d "
            "where date(d.created_at)=date('now') and d.ok=1 "
            "and typeof(d.telegram_message_id)='integer' and d.telegram_message_id>0 "
            "and not exists("
            "select 1 from official_signal_registry r "
            "where r.official_signal_snapshot_id=d.official_signal_snapshot_id)",
        )[0]['n']
        if orphan:
            out['incidents'].append({
                'type': 'receipt_without_registry',
                'count': orphan,
            })

    out['shadow'] = (
        query_rows(
            db,
            "select sport,count(*) detected,"
            "sum(date(analysed_at)=date('now')) analysed_today,"
            "sum(selection in ('home','away')) predictions,"
            "sum(result='win') won,sum(result='loss') lost,"
            "sum(status='predicted') pending,sum(profit_10) theoretical_profit "
            "from multisport_shadow group by sport",
        )
        if table_exists(tables, 'multisport_shadow')
        else None
    )

    out['budget'] = (
        query_rows(
            db,
            "select day,sum(charged_eur) charged_eur,"
            "sum(case when charged_eur IS NULL then reserved_eur else 0 end) reserved_eur,"
            "count(*) calls from openrouter_global_calls "
            "where day=date('now') group by day",
        )
        if table_exists(tables, 'openrouter_global_calls')
        else []
    )

    out['provider_blocks'] = (
        query_rows(
            db,
            "select host,last_status,disabled_until from provider_health "
            "where datetime(disabled_until)>datetime('now')",
        )
        if table_exists(tables, 'provider_health')
        else []
    )

    if live is not None:
        out['live_count'] = len(live.get('matches', []))

    if disk is not None:
        out['disk_percent'] = disk
        if disk >= 80:
            out['incidents'].append({'type': 'disk_high', 'percent': disk})

    return out


def summary(state):
    football = state.get('football') or {}
    goal = state.get('goal05') or {}
    lines = [
        'TLM — rapport propriétaire',
        'Stratégie +0,5 : '
        + ('ACTIVE' if goal.get('enabled') else 'INACTIVE')
        + ' · push '
        + ('ACTIVE' if goal.get('push_enabled') else 'INACTIF')
        + ' · Top5/Bottom5 · 30–85 · cote >=1,60 · quorum 4/5',
        f"Football détectés {football.get('detected','non mesuré')} / éligibles {football.get('eligible','non mesuré')}",
        f"Analyses {state.get('analyses',0)} · votes "
        + ' '.join(key + '/5:' + str(value) for key, value in (state.get('votes') or {}).items()),
        'Jev ' + json.dumps(state.get('jev'), ensure_ascii=False),
        f"Signaux {state.get('official',0)} · Telegram "
        + json.dumps(state.get('telegram'), ensure_ascii=False),
        'Résultats ' + json.dumps(state.get('results'), ensure_ascii=False),
        'Budget ' + json.dumps(state.get('budget'), ensure_ascii=False),
        'API-Sports ' + json.dumps(state.get('api_sports')),
        'Disque ' + str(state.get('disk_percent', 'inconnu')) + '%',
        'Incidents ' + json.dumps(state.get('incidents'), ensure_ascii=False),
    ]
    return clean('\n'.join(lines))


def send_owner(text, env):
    token = env.get('HERMES_ADMIN_TLM_BOT')
    chat = env.get('TELEGRAM_ADMIN_CHAT_ID')
    if not token or not chat:
        return False
    body = json.dumps({'chat_id': chat, 'text': clean(text)}).encode()
    request = urllib.request.Request(
        'https://api.telegram.org/bot' + token + '/sendMessage',
        data=body,
        headers={'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.load(response)
        message_id = payload.get('result', {}).get('message_id')
        return message_id if payload.get('ok') and type(message_id) is int and message_id > 0 else False
    except Exception:
        return False


def capture():
    env = config()
    db = sqlite3.connect('file:' + str(DATA / 'tlm.db') + '?mode=ro', uri=True)
    try:
        try:
            live = api('/live-matches?cache_only=1')
        except Exception:
            live = None

        stat = os.statvfs(ROOT)
        disk = round(100 * (1 - stat.f_bavail / stat.f_blocks), 1)
        state = report(db, env, live, disk)
    finally:
        db.close()

    try:
        secret = env.get('HERMES_ADMIN_TLM_BOT', '')
        if secret:
            operations = api(
                '/admin/operations-status?secret='
                + urllib.parse.quote(secret, safe='')
            )
            state['api_sports'] = operations.get('api_sports')
            state['jev_enabled'] = operations.get('jev_enabled')
            state['shadow_background_paused'] = operations.get('shadow_background_paused')
            blocked = (state['api_sports'] or {}).get('blocked_until', {})
            if any(timestamp > time.time() * 1000 for timestamp in blocked.values()):
                state['incidents'].append({'type': 'sports_api_rate_limited'})
    except Exception:
        state['api_sports'] = None

    try:
        raw = subprocess.check_output(
            [
                'docker', 'inspect', '--format', '{{.Name}} {{.State.Running}}',
                'touslesmatchs-api',
                'touslesmatchs-site',
                'touslesmatchs-council',
                'touslesmatchs-hermes-admin',
            ],
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=8,
        )
        state['services'] = {
            line.split()[0].lstrip('/'): line.split()[1] == 'true'
            for line in raw.splitlines()
        }
        if not all(state['services'].values()):
            state['incidents'].append({'type': 'service_down'})
    except Exception:
        state['services'] = None

    if live is None:
        state['incidents'].append({'type': 'live_api_unavailable'})

    statefile = DATA / 'hermes_guardian_state.json'
    temporary = DATA / 'hermes_guardian_state.next'
    temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2))
    os.chmod(temporary, 0o600)
    temporary.replace(statefile)
    return state


def main():
    DATA.mkdir(exist_ok=True)
    lock = open(DATA / 'hermes_guardian.lock', 'a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return

    env = config()
    while True:
        try:
            state = capture()
            print(json.dumps({
                'at': state['at'],
                'incidents': state['incidents'],
                'goal05': state['goal05'],
            }), flush=True)

            now = datetime.datetime.now(ZoneInfo('Europe/Paris'))
            receipt = DATA / ('hermes-owner-report-' + now.strftime('%Y-%m-%d') + '.json')
            if (
                '--once' not in sys.argv
                and truthy(env.get('HERMES_TECH_TELEGRAM_ENABLED'))
                and now.hour == 20
                and not receipt.exists()
            ):
                message_id = send_owner(summary(state), env)
                if message_id:
                    receipt.write_text(json.dumps({
                        'sent_at': state['at'],
                        'kind': 'owner_daily_report',
                        'telegram_message_id': message_id,
                    }))
                    os.chmod(receipt, 0o600)
        except Exception as error:
            print(json.dumps({'guardian_error': type(error).__name__}), flush=True)

        if '--once' in sys.argv:
            break
        time.sleep(60)


if __name__ == '__main__':
    main()
