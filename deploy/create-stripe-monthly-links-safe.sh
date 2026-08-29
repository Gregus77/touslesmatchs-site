#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs

echo "Création Stripe SAFE — aucune modification du site, .env ou Docker"

docker compose exec -T api node <<'NODE'
const secret=process.env.STRIPE_SECRET_KEY||'';
if(!secret){console.error('STRIPE_SECRET_KEY absent');process.exit(2)}
const plans=[
 {key:'standard',product:'prod_UwPQVs3xjnz6II',amount:490},
 {key:'premium', product:'prod_UwPXjLbjV847eR',amount:1490},
];
const base='https://api.stripe.com/v1';
const auth='Basic '+Buffer.from(secret+':').toString('base64');
async function req(method,path,params){
 const opts={method,headers:{Authorization:auth}};
 if(params){opts.headers['Content-Type']='application/x-www-form-urlencoded';opts.body=new URLSearchParams(params).toString()}
 const r=await fetch(base+path,opts); const d=await r.json();
 if(!r.ok) throw new Error((d.error&&d.error.message)||`Stripe HTTP ${r.status}`);
 return d;
}
async function getOrCreatePrice(p){
 const list=await req('GET',`/prices?product=${encodeURIComponent(p.product)}&active=true&limit=100`);
 const found=(list.data||[]).find(x=>x.currency==='eur'&&x.unit_amount===p.amount&&x.type==='recurring'&&x.recurring?.interval==='month');
 if(found) return found;
 return req('POST','/prices',{
   product:p.product,currency:'eur',unit_amount:String(p.amount),
   'recurring[interval]':'month','recurring[interval_count]':'1',
   'metadata[tlm_plan]':p.key,'metadata[tlm_safe_migration]':'20260830'
 });
}
async function createLink(p,price){
 return req('POST','/payment_links',{
   'line_items[0][price]':price.id,'line_items[0][quantity]':'1',
   'after_completion[type]':'redirect',
   'after_completion[redirect][url]':'https://www.touslesmatchs.com/merci.html?session_id={CHECKOUT_SESSION_ID}',
   'metadata[tlm_plan]':p.key,'metadata[tlm_safe_migration]':'20260830'
 });
}
(async()=>{
 for(const p of plans){
   const price=await getOrCreatePrice(p);
   const link=await createLink(p,price);
   console.log(`${p.key.toUpperCase()}_PRICE=${price.id}`);
   console.log(`${p.key.toUpperCase()}_LINK_ID=${link.id}`);
   console.log(`${p.key.toUpperCase()}_URL=${link.url}`);
   console.log(`${p.key.toUpperCase()}_TYPE=${price.type} / ${price.recurring?.interval||'-'} / ${(price.unit_amount/100).toFixed(2)} EUR`);
 }
 console.log('OK — anciens liens inchangés, site inchangé');
})().catch(e=>{console.error('ERREUR:',e.message);process.exit(1)});
NODE
