'use strict';
const assert = require('node:assert/strict');
let Database; try { Database = require('better-sqlite3'); } catch { Database = require('node:sqlite').DatabaseSync; }
const { addCalendarMonth, verifyPurchase, createLedger, summarizeSignals } = require('./premium_month_pass');
const config = { priceId:'price_fixture', productId:'prod_fixture', livemode:false };
const price = { id:config.priceId, active:true, type:'one_time', recurring:null, currency:'eur', unit_amount:1490,
  livemode:false, product:{id:config.productId,active:true} };
const checkout = (id='cs_fixture', email='buyer@example.test') => ({ id, mode:'payment',status:'complete',payment_status:'paid',
  livemode:false, amount_total:1490,currency:'eur',payment_intent:'pi_'+id,customer_details:{email},
  line_items:{has_more:false,data:[{quantity:1,price}]}, metadata:{tlm_offer:'premium_calendar_month_v1'} });
const at = '2026-01-31T12:00:00.000Z';
assert.equal(addCalendarMonth(at),'2026-02-28T12:00:00.000Z');
assert.equal(addCalendarMonth('2028-01-31T12:00:00Z'),'2028-02-29T12:00:00.000Z');
assert.equal(addCalendarMonth('2026-12-31T12:00:00Z'),'2027-01-31T12:00:00.000Z');
assert.throws(()=>addCalendarMonth('invalid'));
const valid = (id,email)=>verifyPurchase(checkout(id,email),price,config);
assert.equal(valid().amount,1490);
for (const change of [{mode:'subscription'},{payment_status:'unpaid'},{status:'open'},{amount_total:1489},{currency:'usd'},
  {livemode:true},{payment_intent:null},{line_items:{has_more:true,data:[]}}, {customer_details:{email:''}}]) {
  assert.throws(()=>verifyPurchase({...checkout(),...change},price,config),JSON.stringify(change));
}
for (const change of [{active:false},{recurring:{interval:'month'}},{unit_amount:1990},{product:{id:'wrong',active:true}},
  {product:{id:config.productId,active:false}}]) assert.throws(()=>verifyPurchase(checkout(),{...price,...change},config));
assert.throws(()=>verifyPurchase({...checkout(),line_items:{data:[{quantity:2,price}]}},price,config));
const db = new Database(':memory:'); const ledger=createLedger(db);
ledger.registerReferral('REF_OWNER','owner@example.test');
ledger.setHistoricalCustomer('legacy@example.test');
const grant=ledger.applyPurchase(valid(),{at,referral:'REF_OWNER'});
assert.equal(grant.expiresAt,'2026-02-28T12:00:00.000Z');
assert.equal(ledger.entitlement('owner@example.test',at).expiresAt,grant.expiresAt);
assert.equal(ledger.entitlement('buyer@example.test',at).grantCount,1,'no second free month for buyer');
assert.equal(ledger.applyPurchase(valid(),{at,referral:'REF_OWNER'}).duplicate,true);
assert.equal(ledger.entitlement('owner@example.test',at).grantCount,1);
ledger.applyPurchase(valid('cs_second'),{at,referral:'REF_OWNER'});
assert.equal(ledger.entitlement('buyer@example.test',at).expiresAt,'2026-03-28T12:00:00.000Z');
assert.equal(ledger.entitlement('owner@example.test',at).grantCount,1,'repeat buyer must not reward again');
ledger.applyPurchase(valid('cs_self','owner@example.test'),{at,referral:'REF_OWNER'});
assert.equal(ledger.entitlement('owner@example.test',at).grantCount,2,'self-referral adds only paid grant');
ledger.applyPurchase(valid('cs_legacy','legacy@example.test'),{at,referral:'REF_OWNER'});
assert.equal(ledger.entitlement('owner@example.test',at).grantCount,2,'historical payer is not new');
assert.equal(ledger.entitlement('buyer@example.test','2026-03-28T12:00:00.000Z').active,false);
ledger.refund('pi_cs_fixture', {at:'2026-02-01T00:00:00Z',amountRefunded:1490});
assert.equal(ledger.entitlement('buyer@example.test',at).expiresAt,'2026-02-28T12:00:00.000Z');
assert.equal(ledger.entitlement('owner@example.test',at).grantCount,1,'reward reversed together');
ledger.refund('pi_cs_fixture',{at,amountRefunded:1490});
ledger.refund('pi_cs_early',{at,amountRefunded:1490});
assert.equal(ledger.applyPurchase(valid('cs_early','early@example.test'),{at,referral:'REF_OWNER'}).refunded,true);
assert.equal(ledger.entitlement('early@example.test',at).active,false);
assert.throws(()=>ledger.applyPurchase({...valid('cs_untrusted'),amount:1},{at}),'tampering fails closed');
db.exec("CREATE TRIGGER fail_grant BEFORE INSERT ON premium_pass_grants WHEN NEW.email='fail@example.test' BEGIN SELECT RAISE(ABORT,'fixture crash'); END");
assert.throws(()=>ledger.applyPurchase(valid('cs_fail','fail@example.test'),{at,referral:'REF_OWNER'}));
assert.equal(db.prepare("SELECT count(*) n FROM premium_pass_payments WHERE session_id='cs_fail'").get().n,0,'rollback payment if grant fails');
const totals=summarizeSignals([{id:'a',outcome:'win',odd:2},{id:'b',outcome:'loss',odd:1.8},{id:'c',outcome:'win',odd:null},
  {id:'d',outcome:'loss',odd:null},{id:'e',outcome:'pending',odd:2},{id:'a',outcome:'win',odd:2}]);
assert.deepEqual(totals,{wins:2,losses:2,pending:1,excluded:2,stakedCents:2000,returnCents:2000,netCents:0});
db.close(); console.log('PASS premium month: validation, calendar, idempotence, referral, expiry, refunds, atomic rollback, real odds');
