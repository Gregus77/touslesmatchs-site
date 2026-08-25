#!/bin/bash
cd /opt/touslesmatchs || exit 0
echo "=== SECURITE BRANCHE ==="
echo "Branche actuelle : $(git rev-parse --abbrev-ref HEAD)"
for B in claude/consensus-engine-architecture-sy3gqg claude/tiktok-arjel-automation-hgp1tv; do
  if git show-ref --verify --quiet "refs/heads/$B"; then
    N=$(git rev-list --count "$B" ^fix-live-ns 2>/dev/null)
    if [ "$N" = "0" ]; then echo "  $B : rien d unique, tout est dans fix-live-ns"
    else echo "  $B : $N COMMIT(S) UNIQUE(S) — a recuperer"; fi
  fi
done
cat > /tmp/v.js <<'JSEOF'
const http = require('http');
http.get('http://127.0.0.1:3001/live-matches', r => {
  let b=''; r.on('data',d=>b+=d);
  r.on('end', () => {
    let j; try { j = JSON.parse(b); } catch(e) { console.log('reponse illisible'); return; }
    const ms = j.matches || [];
    const cot = ms.filter(m => m.source === 'api-sports');
    console.log('Matchs en direct : ' + ms.length + '  dont cotables (API-Sports) : ' + cot.length
      + (ms.length ? '  = ' + Math.round(cot.length/ms.length*100) + '%' : ''));
    if (ms.length && ms.length < 4) console.log('  (echantillon trop faible pour conclure, remesurer en soiree)');
  });
}).on('error', e => console.log('API injoignable : ' + e.message));
JSEOF
docker cp /tmp/v.js touslesmatchs-api:/app/v.js >/dev/null 2>&1
echo ""; echo "=== MATCHS EN DIRECT ==="
docker exec touslesmatchs-api node /app/v.js
cat > /tmp/d.js <<'JSEOF'
const Database = require('better-sqlite3');
const db = new Database('/data/tlm.db', { readonly: true });
const r = db.prepare(`SELECT COALESCE(real_odd_source,'(aucune)') s, COUNT(*) n FROM concile_analyses
                      WHERE analysed_at >= datetime('now','-6 hour') GROUP BY s ORDER BY n DESC`).all();
console.log(r.length ? '' : '  aucune analyse sur les 6 dernieres heures');
r.forEach(x => console.log('  ' + x.s + ' : ' + x.n));
const d = db.prepare(`SELECT COALESCE(diffusion_block,'(diffuse ou non trace)') b, COUNT(*) n FROM concile_analyses
                      WHERE analysed_at >= datetime('now','-6 hour') GROUP BY b ORDER BY n DESC`).all();
if (d.length) { console.log('\n  Motifs de blocage :'); d.forEach(x => console.log('    ' + x.b + ' : ' + x.n)); }
const s = db.prepare(`SELECT SUM(sig_sent_standard) st, SUM(sig_sent_premium) pr, SUM(sig_sent_elite) el, SUM(sig_sent_free) fr
                      FROM concile_analyses WHERE date(analysed_at) = date('now')`).get();
console.log('\n  Signaux envoyes aujourd hui : Standard ' + (s.st||0) + ' | Premium ' + (s.pr||0) + ' | Elite ' + (s.el||0) + ' | Gratuit ' + (s.fr||0));
db.close();
JSEOF
docker cp /tmp/d.js touslesmatchs-api:/app/d.js >/dev/null 2>&1
echo ""; echo "=== SOURCE DES COTES (6 dernieres heures) ==="
docker exec touslesmatchs-api node /app/d.js
echo ""; echo "=== DERNIERES COTES CALCULEES ==="
docker logs touslesmatchs-api --since 60m 2>&1 | grep "\[concile\] Cote" | tail -8
