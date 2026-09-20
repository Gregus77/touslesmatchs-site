'use strict';
const {OFFER,verifyPurchase}=require('./premium_month_pass');
const {createHash}=require('node:crypto');

// A dedicated pass adapter. Do not route legacy subscriptions through it.
// No emails, invitations, secrets, HTTP routes or legacy account writes here.
// Its ledger is authoritative; consumers must check expiry on every access.
function createPremiumStripeAdapter({stripe,ledger,config,signingSecret,clock=()=>new Date().toISOString(),isHistoricalCustomer}){
  if(!signingSecret||!config?.priceId||!config.productId||typeof config.livemode!=='boolean'
    ||typeof isHistoricalCustomer!=='function')throw new Error('Premium adapter configuration incomplete');
  const pinned=Object.freeze({...config,allowArchived:true});
  async function createCheckout({email,requestId,language='fr',referral=null}={}){
    if(pinned.salesEnabled!==true)throw new Error('Premium sales not enabled');
    const address=String(email||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)||!/^[-A-Za-z0-9_]{16,128}$/.test(requestId||''))throw new Error('Invalid checkout request');
    if(referral!==null&&!/^[A-Z0-9_-]{6,64}$/.test(referral))throw new Error('Invalid referral');
    const origin=new URL(pinned.origin);
    if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('Invalid application origin');
    const price=await stripe.prices.retrieve(pinned.priceId,{expand:['product']});
    if(price.id!==pinned.priceId||price.active!==true||price.type!=='one_time'||price.recurring!=null
      ||price.livemode!==pinned.livemode||price.currency!=='eur'||price.unit_amount!==1490
      ||price.product?.id!==pinned.productId||price.product.active!==true)throw new Error('Premium price unavailable');
    const lang=['fr','ru','en'].includes(language)?language:'fr';
    const digest=createHash('sha256').update(JSON.stringify([address,requestId,pinned.priceId,lang,referral])).digest();
    const result=await stripe.checkout.sessions.create({mode:'payment',line_items:[{price:pinned.priceId,quantity:1}],
      customer_email:address,locale:lang,
      success_url:origin.origin+'/dashboard?premium=processing',cancel_url:origin.origin+'/#plans',
      integration_identifier:'tlm_month_pass_'+Array.from(digest.subarray(0,8),x=>String.fromCharCode(97+x%26)).join(''),
      metadata:{tlm_offer:OFFER,tlm_language:lang,...(referral?{tlm_referral:referral}:{})}},
      {idempotencyKey:'tlm-pass-'+digest.toString('hex')});
    const url=new URL(result.url);
    if(result.livemode!==pinned.livemode||!result.id?.startsWith('cs_')||url.protocol!=='https:'
      ||url.hostname!=='checkout.stripe.com'||url.username||url.password)throw new Error('Invalid Stripe Checkout response');
    return {id:result.id,url:url.href};
  }
  // Fulfillment honors an already-paid purchase even if its exact pinned price
  // is archived afterwards. Creation of a NEW checkout must require active=true.
  async function readPurchase(id){
    if(typeof id!=='string'||!/^cs_[A-Za-z0-9_]+$/.test(id))throw new Error('Invalid checkout identity');
    const session=await stripe.checkout.sessions.retrieve(id,{expand:['line_items']});
    if(session.id!==id||session.livemode!==pinned.livemode)throw new Error('Checkout identity mismatch');
    if(session.metadata?.tlm_offer!==OFFER)return null;
    if(session.payment_status==='unpaid')return {pending:true};
    const price=await stripe.prices.retrieve(pinned.priceId,{expand:['product']});
    const purchase=verifyPurchase(session,price,pinned);
    return {purchase,session};
  }
  async function handle(rawBody,signature){
    if(!Buffer.isBuffer(rawBody)||typeof signature!=='string')throw new Error('Raw signed webhook required');
    const event=stripe.webhooks.constructEvent(rawBody,signature,signingSecret);
    if(!event.id||event.livemode!==pinned.livemode)throw new Error('Stripe event mode mismatch');
    const object=event.data?.object;
    if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
      const value=await readPurchase(object?.id);
      if(!value)return {status:'ignored'};
      if(value.pending)return {status:'pending'};
      // Must query historical paid accounts, not just this new ledger. Unknown
      // history must throw/retry, never turn a former customer into a new referral.
      const historical=await isHistoricalCustomer(value.purchase.email);
      if(typeof historical!=='boolean')throw new Error('Customer history unavailable');
      if(historical)ledger.setHistoricalCustomer(value.purchase.email);
      const result=ledger.applyPurchase(value.purchase,{at:clock(),referral:value.session.metadata?.tlm_referral||null});
      return {status:'granted',...result};
    }
    if(event.type==='charge.refunded'){
      if(typeof object?.id!=='string'||!/^ch_[A-Za-z0-9_]+$/.test(object.id))throw new Error('Invalid refund identity');
      const charge=await stripe.charges.retrieve(object.id);
      if(charge.id!==object.id||charge.livemode!==pinned.livemode||charge.paid!==true
        ||charge.currency!=='eur'||charge.amount!==1490||typeof charge.payment_intent!=='string'
        ||!Number.isSafeInteger(charge.amount_refunded)||charge.amount_refunded<=0||charge.amount_refunded>1490)
        throw new Error('Unverified refund');
      // Resolve scope from Stripe, not from the supplied event or arbitrary
      // payment-intent metadata. Works even when refund arrives before checkout.
      const sessions=await stripe.checkout.sessions.list({payment_intent:charge.payment_intent,limit:2});
      if(sessions.has_more||sessions.data?.length!==1)throw new Error('Ambiguous refunded checkout');
      const value=await readPurchase(sessions.data[0].id);
      if(!value)return {status:'ignored'};
      if(value.pending||value.purchase.paymentIntent!==charge.payment_intent)throw new Error('Refund checkout mismatch');
      return {status:'refund',...ledger.refund(charge.payment_intent,{at:clock(),amountRefunded:charge.amount_refunded})};
    }
    return {status:'ignored'};
  }
  return {handle,createCheckout};
}
module.exports={createPremiumStripeAdapter};
