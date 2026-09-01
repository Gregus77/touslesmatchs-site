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
MARKER = 'TLM_UPCOMING24_RUNTIME_20260901'

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

    runtime = r'''<script id="tlm-upcoming24-runtime">
/* TLM_UPCOMING24_RUNTIME_20260901 */
(function(){
  var openGroups={};
  var busy=false;
  function groupRows(){
    var box=document.getElementById('upcoming-rows');
    if(!box||busy)return;
    var items=Array.prototype.filter.call(box.children,function(el){return el.classList&&el.classList.contains('upcoming-item');});
    if(!items.length)return;
    busy=true;
    try{
      var groups={};
      items.forEach(function(item){
        var meta=item.querySelector('.upcoming-comp');
        var parts=String(meta&&meta.textContent||'').split('·').map(function(x){return x.trim();}).filter(Boolean);
        var league=parts[0]||'Football';
        var country=parts.length>=3?parts[1]:'Autres pays';
        var key=country+'|'+league;
        if(!groups[key])groups[key]={country:country,league:league,items:[]};
        groups[key].items.push(item);
      });
      var wrap=document.createElement('div');
      wrap.className='upcoming-groups';
      Object.keys(groups).sort(function(a,b){return a.localeCompare(b,'fr');}).forEach(function(key,index){
        var g=groups[key];
        var details=document.createElement('details');
        details.className='upcoming-group';
        details.dataset.group=key;
        details.open=openGroups[key]===true||(!(key in openGroups)&&index===0);
        details.addEventListener('toggle',function(){openGroups[key]=details.open;});
        var summary=document.createElement('summary');
        var flag=document.createElement('span');
        flag.setAttribute('aria-hidden','true');
        flag.textContent=(window.COUNTRY_FLAGS&&window.COUNTRY_FLAGS[g.country])||'🏳️';
        var title=document.createElement('span');
        title.className='upcoming-group-title';
        title.textContent=g.country+' · '+g.league;
        var count=document.createElement('span');
        count.className='upcoming-group-count';
        count.textContent=g.items.length+' match'+(g.items.length>1?'s':'');
        summary.appendChild(flag);summary.appendChild(title);summary.appendChild(count);
        var list=document.createElement('div');
        list.className='upcoming-group-list';
        g.items.forEach(function(item){list.appendChild(item);});
        details.appendChild(summary);details.appendChild(list);wrap.appendChild(details);
      });
      box.replaceChildren(wrap);
    }finally{busy=false;}
  }
  function start(){
    var box=document.getElementById('upcoming-rows');
    if(!box)return;
    new MutationObserver(function(){setTimeout(groupRows,0);}).observe(box,{childList:true});
    groupRows();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
</script>
'''
    body_anchor = '</body>'
    if body_anchor not in s:
        raise SystemExit('FAILED: balise de fin de page introuvable')
    s = s.replace(body_anchor, runtime + body_anchor, 1)
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
for needle in (MARKER, 'upcoming-group-count', 'MutationObserver', 'tlm-upcoming24-runtime'):
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

echo "[verify] attente du redemarrage HTTPS"
for TLM_TRY in $(seq 1 45); do
  if curl -fsS --max-time 8 "https://www.touslesmatchs.com/?v=${TLM_STAMP}" > /tmp/tlm-upcoming24-page.html 2>/dev/null; then
    break
  fi
  sleep 2
done
test -s /tmp/tlm-upcoming24-page.html || { echo "FAILED: accueil public indisponible apres 90 secondes" >&2; exit 1; }

for TLM_TRY in $(seq 1 15); do
  if curl -fsS --max-time 8 "https://www.touslesmatchs.com/sw.js?v=${TLM_STAMP}" > /tmp/tlm-upcoming24-sw.js 2>/dev/null \
    && curl -fsS --max-time 8 "https://www.touslesmatchs.com/api/health?t=${TLM_STAMP}" > /tmp/tlm-upcoming24-health.json 2>/dev/null; then
    break
  fi
  sleep 2
done
test -s /tmp/tlm-upcoming24-sw.js || { echo "FAILED: service worker public indisponible" >&2; exit 1; }
test -s /tmp/tlm-upcoming24-health.json || { echo "FAILED: API publique indisponible" >&2; exit 1; }

grep -q 'TLM_UPCOMING24_RUNTIME_20260901' /tmp/tlm-upcoming24-page.html
grep -q 'tlm-upcoming24-runtime' /tmp/tlm-upcoming24-page.html
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
