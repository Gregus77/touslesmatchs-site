#!/usr/bin/env bash
set -Eeuo pipefail

TLM_ROOT="/opt/touslesmatchs"
TLM_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TLM_BACKUP="/opt/backups/tlm-live24-dropdown-${TLM_STAMP}"
TLM_DEPLOY_OK=0

cd "$TLM_ROOT"
for TLM_FILE in public/live-ia.html public/sw.js; do
  test -f "$TLM_FILE" || { echo "FAILED: fichier absent: $TLM_FILE" >&2; exit 1; }
done

mkdir -p "$TLM_BACKUP"
chmod 700 "$TLM_BACKUP"
tar -czf "$TLM_BACKUP/files-before.tar.gz" -C "$TLM_ROOT" public/live-ia.html public/sw.js
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
LIVE = ROOT / 'public/live-ia.html'
SW = ROOT / 'public/sw.js'
MARKER = 'TLM_LIVE24_COLLAPSIBLE_20260901'

s = LIVE.read_text(encoding='utf-8')
if MARKER not in s:
    css_anchor = '.match-card.finished:hover{opacity:.9}'
    css_insert = css_anchor + r'''

/* TLM_LIVE24_COLLAPSIBLE_20260901: les matchs a venir restent lisibles sur mobile et desktop. */
.match-folds{margin:4px 0 18px}
.match-fold{background:linear-gradient(145deg,rgba(34,211,238,.06),rgba(99,102,241,.05));border:1px solid rgba(34,211,238,.18);border-radius:16px;margin-bottom:12px;overflow:hidden}
.match-fold summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;cursor:pointer;font-size:14px;font-weight:850;color:var(--text);user-select:none}
.match-fold summary::-webkit-details-marker{display:none}
.match-fold summary::after{content:"⌄";display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9px;background:rgba(34,211,238,.1);color:var(--cyan);font-size:18px;transition:transform .2s}
.match-fold[open] summary::after{transform:rotate(180deg)}
.match-fold[open] summary{border-bottom:1px solid rgba(34,211,238,.14)}
.match-fold-title{display:flex;align-items:center;gap:9px;min-width:0}
.match-fold-title span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.match-fold-count{margin-left:auto;color:var(--cyan);font-size:12px;font-weight:800;white-space:nowrap}
.match-fold-body{padding:12px}
.match-fold-body .match-card:last-child{margin-bottom:0}
.mc-minute.scheduled-time{color:var(--cyan);background:rgba(34,211,238,.08)}
@media(max-width:560px){.match-fold summary{padding:13px 14px}.match-fold-body{padding:8px}.match-fold-count{font-size:11px}}'''
    if css_anchor not in s:
        raise SystemExit('FAILED: ancre CSS des cartes introuvable')
    s = s.replace(css_anchor, css_insert, 1)

    fn_start = s.find('function renderMatches() {')
    fn_end = s.find('\n// ── Analysis ──', fn_start)
    if fn_start < 0 or fn_end < 0:
        raise SystemExit('FAILED: fonction renderMatches introuvable')
    fn = s[fn_start:fn_end]
    loop_anchor = '  var html = "";\n  filtered.forEach(function(m) {'
    loop_start = fn.find(loop_anchor)
    loop_end_marker = '\n  });\n\n  wrap.innerHTML = html;'
    loop_end = fn.find(loop_end_marker, loop_start)
    if loop_start < 0 or loop_end < 0:
        raise SystemExit('FAILED: boucle de rendu introuvable')

    body_start = loop_start + len(loop_anchor)
    loop_body = fn[body_start:loop_end]
    append_count = len(re.findall(r'\bhtml \+=', loop_body))
    if append_count < 15:
        raise SystemExit(f'FAILED: structure de carte inattendue ({append_count} ajouts)')
    loop_body = re.sub(r'\bhtml \+=', 'cardHtml +=', loop_body)

    loop_prefix = r'''  var html = "";
  var futureHtml = "";
  var upcomingGroups = {};
  var nowMs = Date.now();

  function matchKickoffMs(m) {
    var raw = m.utcDate || m.kickoff || m.start_time || m.startTime || m.scheduled_at || m.date;
    if (!raw && m.fixture && m.fixture.date) raw = m.fixture.date;
    var parsed = raw ? Date.parse(raw) : NaN;
    return isNaN(parsed) ? 0 : parsed;
  }
  function matchDayKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function matchDayLabel(ms) {
    var d = new Date(ms);
    var today = new Date(nowMs);
    var tomorrow = new Date(nowMs);
    tomorrow.setDate(today.getDate() + 1);
    var sameDay = function(a, b) {
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    };
    if (sameDay(d, today)) return "Aujourd’hui";
    if (sameDay(d, tomorrow)) return "Demain";
    var label = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  filtered.forEach(function(m) {
    var cardHtml = "";'''

    classification = r'''
    var isScheduled = !isLive && !isDone;
    var kickoffMs = matchKickoffMs(m);
    if (isScheduled && kickoffMs >= nowMs - 5 * 60 * 1000 && kickoffMs <= nowMs + 24 * 60 * 60 * 1000) {
      var groupKey = matchDayKey(kickoffMs);
      if (!upcomingGroups[groupKey]) {
        upcomingGroups[groupKey] = { label: matchDayLabel(kickoffMs), firstKickoff: kickoffMs, cards: [] };
      }
      upcomingGroups[groupKey].firstKickoff = Math.min(upcomingGroups[groupKey].firstKickoff, kickoffMs);
      upcomingGroups[groupKey].cards.push(cardHtml);
    } else if (isScheduled) {
      // Ne jamais masquer un match si sa date est absente ou au-delà de la fenêtre.
      futureHtml += cardHtml;
    } else {
      html += cardHtml;
    }'''

    after_loop = r'''
  });

  var groupKeys = Object.keys(upcomingGroups).sort(function(a, b) {
    return upcomingGroups[a].firstKickoff - upcomingGroups[b].firstKickoff;
  });
  if (groupKeys.length) {
    html += '<section class="match-folds" aria-label="Matchs dans les prochaines 24 heures">';
    groupKeys.forEach(function(key) {
      var group = upcomingGroups[key];
      var count = group.cards.length;
      html += '<details class="match-fold">';
      html += '<summary><span class="match-fold-title"><span aria-hidden="true">🗓️</span><span>' + escHtml(group.label) + '</span></span><span class="match-fold-count">' + count + ' match' + (count > 1 ? 's' : '') + '</span></summary>';
      html += '<div class="match-fold-body">' + group.cards.join("") + '</div>';
      html += '</details>';
    });
    html += '</section>';
  }
  html += futureHtml;

  wrap.innerHTML = html;'''

    fn = fn[:loop_start] + loop_prefix + loop_body + classification + after_loop + fn[loop_end + len(loop_end_marker):]
    minute_old = '''    } else if (isDone) {
      minuteHtml = '<div class="mc-minute done">FT</div>';
    }'''
    minute_new = '''    } else if (isDone) {
      minuteHtml = '<div class="mc-minute done">FT</div>';
    } else {
      var scheduledMs = matchKickoffMs(m);
      if (scheduledMs) {
        minuteHtml = '<div class="mc-minute scheduled-time">' + new Date(scheduledMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + '</div>';
      }
    }'''
    if minute_old not in fn:
        raise SystemExit('FAILED: ancre horaire des matchs introuvable')
    fn = fn.replace(minute_old, minute_new, 1)
    s = s[:fn_start] + fn + s[fn_end:]
    LIVE.write_text(s, encoding='utf-8')

sw = SW.read_text(encoding='utf-8')
target = 'const VERSION = "tlm-app-v10-live24-folds-20260901";'
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

proof = LIVE.read_text(encoding='utf-8')
for needle in (MARKER, 'Matchs dans les prochaines 24 heures', 'match-fold-count', 'scheduled-time'):
    if needle not in proof:
        raise SystemExit(f'FAILED: preuve source absente: {needle}')
PY

node --check public/sw.js
node - <<'NODE'
const fs = require('fs');
const html = fs.readFileSync('public/live-ia.html', 'utf8');
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

curl -fsS --max-time 15 "https://www.touslesmatchs.com/live-ia?v=${TLM_STAMP}" > /tmp/tlm-live24-page.html
curl -fsS --max-time 15 "https://www.touslesmatchs.com/sw.js?v=${TLM_STAMP}" > /tmp/tlm-live24-sw.js
curl -fsS --max-time 15 "https://www.touslesmatchs.com/api/health?t=${TLM_STAMP}" > /tmp/tlm-live24-health.json

grep -q 'TLM_LIVE24_COLLAPSIBLE_20260901' /tmp/tlm-live24-page.html
grep -q 'Matchs dans les prochaines 24 heures' /tmp/tlm-live24-page.html
grep -q 'tlm-app-v10-live24-folds-20260901' /tmp/tlm-live24-sw.js
python3 - <<'PY'
import json
from pathlib import Path
d = json.loads(Path('/tmp/tlm-live24-health.json').read_text(encoding='utf-8'))
assert d.get('ok') is True, d
print('PROOF_API=healthy')
PY

TLM_DEPLOY_OK=1
trap - EXIT

echo "OK: menus deroulants 24 h installes"
echo "BACKUP=$TLM_BACKUP"
echo "PROOF_SITE=live24_dropdown_present"
echo "PROOF_CACHE=tlm-app-v10-live24-folds-20260901"
echo "GIT=non modifie automatiquement; changements locaux preexistants preserves"
