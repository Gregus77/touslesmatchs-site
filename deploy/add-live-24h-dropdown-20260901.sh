#!/usr/bin/env bash
set -Eeuo pipefail

TLM_ROOT="/opt/touslesmatchs"
TLM_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TLM_BACKUP="/opt/backups/tlm-upcoming24-dropdown-${TLM_STAMP}"
TLM_DEPLOY_OK=0

cd "$TLM_ROOT"
for TLM_FILE in public/index.html public/sw.js; do
  test -f "$TLM_FILE" || { echo "FAILED: fichier absent: $TLM_FILE" >&2; exit 1; }
done

mkdir -p "$TLM_BACKUP"
chmod 700 "$TLM_BACKUP"
tar -czf "$TLM_BACKUP/files-before.tar.gz" -C "$TLM_ROOT" public/index.html public/sw.js
git status --short --branch > "$TLM_BACKUP/git-status-before.txt"
git rev-parse HEAD > "$TLM_BACKUP/git-head-before.txt"

tlm_rollback() {
  local TLM_RC=$?
  if [ "$TLM_RC" -ne 0 ] && [ "$TLM_DEPLOY_OK" -ne 1 ]; then
    echo "[rollback] echec detecte, restauration des fichiers sauvegardes" >&2
    tar -xzf "$TLM_BACKUP/files-before.tar.gz" -C "$TLM_ROOT"
    docker compose up -d --build site >/dev/null 2>&1 || true
    echo "FAILED: correction annulee; sauvegarde=$TLM_BACKUP" >&2
  fi
  exit "$TLM_RC"
}
trap tlm_rollback EXIT

python3 - <<'PY'
from pathlib import Path
import re

ROOT = Path('/opt/touslesmatchs')
INDEX = ROOT / 'public/index.html'
SW = ROOT / 'public/sw.js'
MARKER = 'TLM_UPCOMING24_GROUPS_20260901'

s = INDEX.read_text(encoding='utf-8')
if MARKER not in s:
    css_anchor = '.upcoming-panel{border-top:3px solid #3ec9e8;padding:20px;display:flex;flex-direction:column;gap:10px}'
    css_insert = css_anchor + r'''
/* TLM_UPCOMING24_GROUPS_20260901: accordéons par pays et championnat dans le panneau 24 h. */
.upcoming-groups{display:grid;gap:9px}
.upcoming-group{border:1px solid rgba(62,201,232,.24);border-radius:13px;background:rgba(7,11,32,.48);overflow:hidden}
.upcoming-group summary{list-style:none;display:flex;align-items:center;gap:9px;padding:12px 14px;cursor:pointer;color:#fff;font-size:13px;font-weight:900}
.upcoming-group summary::-webkit-details-marker{display:none}
.upcoming-group summary::after{content:"⌄";width:24px;height:24px;margin-left:2px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(62,201,232,.12);color:#7de8ff;font-size:16px;transition:transform .2s}
.upcoming-group[open] summary{border-bottom:1px solid rgba(62,201,232,.18)}
.upcoming-group[open] summary::after{transform:rotate(180deg)}
.upcoming-group-title{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.upcoming-group-count{margin-left:auto;color:#7de8ff;font-size:11px;font-weight:850;white-space:nowrap}
.upcoming-group-list{padding:9px}
.upcoming-group-list .upcoming-item:last-child{margin-bottom:0}'''
    if css_anchor not in s:
        raise SystemExit('FAILED: ancre CSS du panneau 24 h introuvable')
    s = s.replace(css_anchor, css_insert, 1)

    js_anchor = 'async function loadUpcoming(){'
    js_insert = r'''/* TLM_UPCOMING24_GROUPS_20260901 */
var upcomingOpenGroups={};
function rememberUpcomingGroup(el){
  var key=el&&el.getAttribute('data-group');
  if(key)upcomingOpenGroups[key]=!!el.open;
}
function renderUpcomingGroups(rows){
  if(!rows||!rows.length)return '<div class="empty-note">Aucun autre match qualifié dans les prochaines 24 h.</div>';
  var groups={};
  rows.slice().sort(function(a,b){
    var ta=new Date(a.kickoff).getTime(),tb=new Date(b.kickoff).getTime();
    return (isNaN(ta)?Number.MAX_SAFE_INTEGER:ta)-(isNaN(tb)?Number.MAX_SAFE_INTEGER:tb);
  }).forEach(function(p){
    var comp=splitComp(p.competition||'');
    var country=comp.country||'Autres pays';
    var league=comp.league||p.sport||'Football';
    var key=country+'|'+league;
    if(!groups[key])groups[key]={country:country,league:league,rows:[]};
    groups[key].rows.push(p);
  });
  return '<div class="upcoming-groups">'+Object.keys(groups).sort(function(a,b){return a.localeCompare(b,'fr');}).map(function(key,index){
    var g=groups[key],flag=COUNTRY_FLAGS[g.country]||'',encoded=encodeURIComponent(key);
    var open=upcomingOpenGroups[encoded]===true||(!(encoded in upcomingOpenGroups)&&index===0);
    return '<details class="upcoming-group" data-group="'+encoded+'"'+(open?' open':'')+' ontoggle="rememberUpcomingGroup(this)">'+
      '<summary><span aria-hidden="true">'+(flag||'🏳️')+'</span><span class="upcoming-group-title">'+esc(g.country)+' · '+esc(g.league)+'</span><span class="upcoming-group-count">'+g.rows.length+' match'+(g.rows.length>1?'s':'')+'</span></summary>'+
      '<div class="upcoming-group-list">'+g.rows.map(renderUpcomingItem).join('')+'</div>'+
    '</details>';
  }).join('')+'</div>';
}
async function loadUpcoming(){'''
    if js_anchor not in s:
        raise SystemExit('FAILED: ancre JavaScript du panneau 24 h introuvable')
    s = s.replace(js_anchor, js_insert, 1)

    render_pattern = r"box\.innerHTML\s*=\s*rest\.map\(renderUpcomingItem\)\.join\((['\"])\1\)\s*;"
    s, render_changed = re.subn(render_pattern, 'box.innerHTML=renderUpcomingGroups(rest);', s, count=1)
    if render_changed != 1:
        raise SystemExit('FAILED: rendu de la liste 24 h introuvable')
    INDEX.write_text(s, encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
target = 'const VERSION = "tlm-app-v10-upcoming24-dropdown-20260901";'
if target not in sw:
    sw, changed = re.subn(
        r'(?m)^\s*(?:const|let|var)\s+VERSION\s*=\s*(["\'`])[^"\'`]+\1\s*;',
        target,
        sw,
        count=1,
    )
    if changed != 1:
        raise SystemExit('FAILED: version du service worker introuvable')
    SW.write_text(sw, encoding='utf-8')

proof = INDEX.read_text(encoding='utf-8')
for needle in (MARKER, 'renderUpcomingGroups(rest)', 'upcoming-group-count', 'rememberUpcomingGroup'):
    if needle not in proof:
        raise SystemExit(f'FAILED: preuve source absente: {needle}')
PY

node --check public/sw.js
node - <<'NODE'
const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m, checked = 0;
while ((m = re.exec(html))) {
  const attrs = m[1] || '';
  if (/\bsrc\s*=|application\/ld\+json/i.test(attrs)) continue;
  new Function(m[2]);
  checked++;
}
if (!checked) throw new Error('aucun script inline verifie');
console.log(`PROOF_INLINE_SCRIPTS=${checked}`);
NODE

docker compose config -q
echo "[deploy] reconstruction du site uniquement"
docker compose up -d --build site

curl -fsS --max-time 15 "https://www.touslesmatchs.com/?v=${TLM_STAMP}" > /tmp/tlm-upcoming24-page.html
curl -fsS --max-time 15 "https://www.touslesmatchs.com/sw.js?v=${TLM_STAMP}" > /tmp/tlm-upcoming24-sw.js
curl -fsS --max-time 15 "https://www.touslesmatchs.com/api/health?t=${TLM_STAMP}" > /tmp/tlm-upcoming24-health.json

grep -q 'TLM_UPCOMING24_GROUPS_20260901' /tmp/tlm-upcoming24-page.html
grep -q 'renderUpcomingGroups(rest)' /tmp/tlm-upcoming24-page.html
grep -q 'tlm-app-v10-upcoming24-dropdown-20260901' /tmp/tlm-upcoming24-sw.js
python3 - <<'PY'
import json
from pathlib import Path
d = json.loads(Path('/tmp/tlm-upcoming24-health.json').read_text(encoding='utf-8'))
assert d.get('ok') is True, d
print('PROOF_API=healthy')
PY

TLM_DEPLOY_OK=1
trap - EXIT

echo "OK: menus deroulants des prochaines 24 h installes"
echo "BACKUP=$TLM_BACKUP"
echo "PROOF_SITE=upcoming24_dropdown_present"
echo "PROOF_CACHE=tlm-app-v10-upcoming24-dropdown-20260901"
echo "GIT=non modifie automatiquement; changements locaux preexistants preserves"
