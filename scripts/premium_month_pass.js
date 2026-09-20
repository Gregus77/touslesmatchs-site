'use strict';
// Domain core only. Not a webhook endpoint: callers MUST verify the Stripe
// signature, retrieve the checkout and price on the server, then verifyPurchase.
// No external effects, credentials, automatic renewals or legacy account writes.
const OFFER = 'premium_calendar_month_v1';
const verified = new WeakSet();
function instant(value) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error('Invalid timestamp');
  return new Date(ms).toISOString();
}
function email(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Invalid customer email');
  return normalized;
}
function addCalendarMonth(value) {
  const d = new Date(instant(value)), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, end));
  return d.toISOString();
}
function verifyPurchase(session, price, config) {
  const items = session?.line_items;
  if (!config || typeof config.livemode !== 'boolean' || !config.priceId || !config.productId
    || !price || price.id !== config.priceId || (price.active !== true && config.allowArchived !== true) || price.type !== 'one_time'
    || price.recurring != null || price.currency !== 'eur' || price.unit_amount !== 1490
    || price.livemode !== config.livemode || price.product?.id !== config.productId || (price.product.active !== true && config.allowArchived !== true)
    || session?.mode !== 'payment' || session.status !== 'complete' || session.payment_status !== 'paid'
    || session.livemode !== config.livemode || session.amount_total !== 1490 || session.currency !== 'eur'
    || session.metadata?.tlm_offer !== OFFER || !/^cs_/.test(session.id || '')
    || typeof session.payment_intent !== 'string' || !/^pi_/.test(session.payment_intent)
    || !items || items.has_more || items.data?.length !== 1 || items.data[0].quantity !== 1
    || items.data[0].price?.id !== config.priceId) throw new Error('Unverified Premium purchase');
  const purchase = Object.freeze({sessionId:session.id, paymentIntent:session.payment_intent,
    email:email(session.customer_details?.email || session.customer_email), amount:1490, currency:'eur', offer:OFFER});
  verified.add(purchase); return purchase;
}
function createLedger(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS premium_pass_payments (
    session_id TEXT PRIMARY KEY, payment_intent TEXT NOT NULL UNIQUE, email TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK(amount=1490), paid_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS premium_pass_customers (email TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS premium_pass_referrals (code TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS premium_pass_grants (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, email TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('paid','referral')), granted_at TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS premium_pass_grants_email ON premium_pass_grants(email,granted_at);
    CREATE TABLE IF NOT EXISTS premium_pass_refunds (
      payment_intent TEXT PRIMARY KEY, amount_refunded INTEGER NOT NULL, observed_at TEXT NOT NULL);`);
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result=fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function entitlement(address, at = new Date().toISOString()) {
    const now=instant(at), grants=db.prepare(`SELECT granted_at FROM premium_pass_grants
      WHERE email=? AND revoked=0 ORDER BY granted_at,id`).all(email(address));
    let expiresAt=null;
    for (const grant of grants) expiresAt=addCalendarMonth(expiresAt && expiresAt>grant.granted_at ? expiresAt:grant.granted_at);
    return {active:!!expiresAt && expiresAt>now,expiresAt,grantCount:grants.length};
  }
  function applyPurchase(purchase, {at=new Date().toISOString(),referral=null}={}) {
    if (!verified.has(purchase)) throw new Error('Purchase must be server-verified');
    const paidAt=instant(at);
    return transaction(()=>{
      const existing=db.prepare('SELECT email FROM premium_pass_payments WHERE session_id=?').get(purchase.sessionId);
      if(existing) return {duplicate:true,...entitlement(existing.email,paidAt)};
      const refunded=db.prepare('SELECT amount_refunded FROM premium_pass_refunds WHERE payment_intent=?').get(purchase.paymentIntent);
      const revoked=refunded?.amount_refunded>=1490 ? 1:0;
      const known=!!db.prepare('SELECT email FROM premium_pass_customers WHERE email=?').get(purchase.email);
      db.prepare('INSERT INTO premium_pass_payments VALUES (?,?,?,?,?)').run(purchase.sessionId,purchase.paymentIntent,purchase.email,1490,paidAt);
      db.prepare('INSERT OR IGNORE INTO premium_pass_customers VALUES (?)').run(purchase.email);
      db.prepare('INSERT INTO premium_pass_grants VALUES (?,?,?,?,?,?)').run('paid:'+purchase.sessionId,purchase.sessionId,purchase.email,'paid',paidAt,revoked);
      const owner=referral && db.prepare('SELECT email FROM premium_pass_referrals WHERE code=?').get(referral);
      if (!known && owner && owner.email !== purchase.email) {
        db.prepare('INSERT INTO premium_pass_grants VALUES (?,?,?,?,?,?)').run('referral:'+purchase.sessionId,purchase.sessionId,owner.email,'referral',paidAt,revoked);
      }
      return {duplicate:false,refunded:!!revoked,...entitlement(purchase.email,paidAt)};
    });
  }
  function refund(paymentIntent,{at=new Date().toISOString(),amountRefunded}={}) {
    if (!/^pi_/.test(paymentIntent || '') || !Number.isSafeInteger(amountRefunded) || amountRefunded<=0) throw new Error('Invalid refund');
    const observedAt=instant(at);
    return transaction(()=>{
      db.prepare(`INSERT INTO premium_pass_refunds VALUES (?,?,?) ON CONFLICT(payment_intent) DO UPDATE SET
        amount_refunded=max(amount_refunded,excluded.amount_refunded),observed_at=excluded.observed_at`).run(paymentIntent,amountRefunded,observedAt);
      const record=db.prepare('SELECT amount_refunded FROM premium_pass_refunds WHERE payment_intent=?').get(paymentIntent);
      if(record.amount_refunded>=1490) db.prepare(`UPDATE premium_pass_grants SET revoked=1 WHERE session_id IN
        (SELECT session_id FROM premium_pass_payments WHERE payment_intent=?)`).run(paymentIntent);
      return {revoked:record.amount_refunded>=1490,needsReview:record.amount_refunded<1490};
    });
  }
  return {applyPurchase,entitlement,refund,
    registerReferral(code,address) {
      if(!/^[A-Z0-9_-]{6,64}$/.test(code)) throw new Error('Invalid referral code');
      db.prepare('INSERT INTO premium_pass_referrals VALUES (?,?)').run(code,email(address));
    },
    setHistoricalCustomer(address) {db.prepare('INSERT OR IGNORE INTO premium_pass_customers VALUES (?)').run(email(address));}
  };
}
function summarizeSignals(rows) {
  const totals={wins:0,losses:0,pending:0,excluded:0,stakedCents:0,returnCents:0,netCents:0},seen=new Set();
  for(const row of rows) {
    if(!row.id) throw new Error('Immutable signal identity required');
    if(seen.has(row.id)) continue; seen.add(row.id);
    if(!['win','loss'].includes(row.outcome)) { totals.pending++; continue; }
    totals[row.outcome==='win'?'wins':'losses']++;
    const odd=Number(row.odd);
    if(row.odd==null || !Number.isFinite(odd) || odd<=1) {totals.excluded++;continue;}
    totals.stakedCents+=1000;
    if(row.outcome==='win') totals.returnCents+=Math.round(1000*odd);
  }
  totals.netCents=totals.returnCents-totals.stakedCents; return totals;
}
module.exports={OFFER,addCalendarMonth,verifyPurchase,createLedger,summarizeSignals};
