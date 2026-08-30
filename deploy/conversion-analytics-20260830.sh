#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/opt/backups/tlm-conversion-analytics-$STAMP"
FILES=(public/index.html public/dashboard.html public/resultats-quotidiens.html)
mkdir -p "$BACKUP"
for f in "${FILES[@]}"; do mkdir -p "$BACKUP/$(dirname "$f")"; cp -a "$f" "$BACKUP/$f"; done
rollback(){ for f in "${FILES[@]}"; do cp -a "$BACKUP/$f" "$f"; done; docker compose up -d --no-deps --build site >/dev/null 2>&1 || true; }
trap rollback ERR
python3 - <<'PY'
from pathlib import Path

p=Path('public/index.html'); s=p.read_text(encoding='utf-8')
if 'TLM-CONVERSION-FUNNEL-20260830' not in s:
 js=r'''
<!-- TLM-CONVERSION-FUNNEL-20260830 -->
<script>
(function(){
 function tlmEv(name,params){try{if(typeof gtag==='function')gtag('event',name,params||{});}catch(e){}}
 document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('a'); if(!a)return;
  var h=a.getAttribute('href')||'',t=(a.textContent||'').trim().slice(0,80);
  if(h.indexOf('/dashboard')>=0)tlmEv('free_signup_click',{link_text:t});
  if(h==='#pick')tlmEv('free_signal_click',{link_text:t});
  if(h.indexOf('/performances')>=0)tlmEv('proof_history_click',{link_text:t});
  if(a.closest('#plans')&&(t.toLowerCase().indexOf('standard')>=0||t.toLowerCase().indexOf('premium')>=0))tlmEv('plan_select_click',{plan:t.toLowerCase().indexOf('premium')>=0?'premium':'standard'});
 },true);
 function view(id,name){var el=document.getElementById(id);if(!el||!('IntersectionObserver'in window))return;var done=false,io=new IntersectionObserver(function(es){es.forEach(function(x){if(!done&&x.isIntersecting){done=true;tlmEv(name);io.disconnect();}})},{threshold:.35});io.observe(el);}
 view('pick','free_signal_view'); view('plans','pricing_view'); view('email-capture-card','lead_form_view');
 var f=document.getElementById('email-capture-form');if(f)f.addEventListener('submit',function(){tlmEv('lead_submit',{source:'homepage'});});
})();
</script>
'''
 if '</body>' not in s: raise SystemExit('home body introuvable')
 s=s.replace('</body>',js+'\n</body>',1)
p.write_text(s,encoding='utf-8')

p=Path('public/resultats-quotidiens.html'); s=p.read_text(encoding='utf-8')
needle="""    if (d.ok) {\n      msg.textContent = '✅ Merci ! Tu recevras bientôt ton premier récap.';"""
if 'lead_complete' not in s:
 if needle not in s: raise SystemExit('lead success introuvable')
 s=s.replace(needle,"""    if (d.ok) {\n      try { if (typeof gtag === 'function') gtag('event','lead_complete',{source:'resultats_quotidiens'}); } catch (_) {}\n      msg.textContent = '✅ Merci ! Tu recevras bientôt ton premier récap.';""",1)
p.write_text(s,encoding='utf-8')

p=Path('public/dashboard.html'); s=p.read_text(encoding='utf-8')
needle="if (!d.ok) return showErr(d.error || 'Code invalide.');"
if 'account_access_verified' not in s:
 if needle not in s: raise SystemExit('OTP success introuvable')
 s=s.replace(needle,needle+"\n    try { if (typeof gtag === 'function') gtag('event','account_access_verified'); } catch (_) {}",1)
p.write_text(s,encoding='utf-8')
print('OK')
PY

grep -q 'TLM-CONVERSION-FUNNEL-20260830' public/index.html
grep -q 'pricing_view' public/index.html
grep -q 'plan_select_click' public/index.html
grep -q 'lead_complete' public/resultats-quotidiens.html
grep -q 'account_access_verified' public/dashboard.html

docker compose up -d --no-deps --build site
for i in $(seq 1 30); do curl -fsS https://www.touslesmatchs.com/ >/dev/null 2>&1 && break; sleep 1; done
curl -fsS https://www.touslesmatchs.com/ | grep -q 'TLM-CONVERSION-FUNNEL-20260830'
trap - ERR
echo '=== FINAL CONVERSION ANALYTICS ==='
echo 'STATUS=OK'
echo 'EVENTS=free_signup_click free_signal_view pricing_view lead_form_view lead_submit plan_select_click proof_history_click account_access_verified lead_complete'
echo 'STRIPE=INCHANGE'
echo "SAUVEGARDE=$BACKUP"
