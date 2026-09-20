'use strict';
const {randomBytes}=require('node:crypto');
// Projects only rows owned by the new pass. Legacy subscriptions/admin rows
// remain byte-for-byte unchanged. Reconciliation is repeatable after a crash.
function createAccessProjection({codesDb,ledger}){
  codesDb.exec('CREATE TABLE IF NOT EXISTS premium_pass_code_links(email TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,last_expiry TEXT,last_active INTEGER)');
  const columns=new Set(codesDb.prepare('PRAGMA table_info(premium_pass_code_links)').all().map(row=>row.name));
  for(const [name,type] of [['last_expiry','TEXT'],['last_active','INTEGER']]){
    if(!columns.has(name))codesDb.exec(`ALTER TABLE premium_pass_code_links ADD COLUMN ${name} ${type}`);
  }
  // Earlier links with no remembered state are quarantined, never guessed.
  function reconcile(email,{at=new Date().toISOString(),language}={}){
    const address=String(email||'').trim().toLowerCase(),now=Date.parse(at);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)||!Number.isFinite(now))throw new Error('Invalid projection identity/time');
    const entitlement=ledger.entitlement(address,new Date(now).toISOString());
    codesDb.exec('BEGIN IMMEDIATE');
    try{
      const link=codesDb.prepare('SELECT code,last_expiry,last_active FROM premium_pass_code_links WHERE email=?').get(address);
      const owned=link&&codesDb.prepare('SELECT code,email,plan,active,expires_at,credits_max FROM codes WHERE code=?').get(link.code);
      if(link&&(!owned||owned.email!==address||owned.plan!=='premium'||owned.credits_max!==10
        ||link.last_active===null||owned.active!==link.last_active||owned.expires_at!==link.last_expiry))throw new Error('Managed pass ownership changed');
      const legacy=codesDb.prepare("SELECT code,plan,expires_at FROM codes WHERE lower(email)=? AND active=1 AND plan!='free'").all(address)
        .filter(row=>row.code!==link?.code);
      // Malformed legacy expiry is not a license to overwrite a protected row.
      const protectedLegacy=legacy.some(row=>!row.expires_at||!Number.isFinite(Date.parse(row.expires_at))||Date.parse(row.expires_at)>now);
      if(protectedLegacy||!entitlement.active){
        if(owned){
          codesDb.prepare('UPDATE codes SET active=0,expires_at=? WHERE code=?').run(entitlement.expiresAt,owned.code);
          codesDb.prepare('UPDATE premium_pass_code_links SET last_active=0,last_expiry=? WHERE email=?').run(entitlement.expiresAt,address);
        }
        codesDb.exec('COMMIT');return {active:protectedLegacy,passActive:entitlement.active,expiresAt:entitlement.expiresAt,preservedLegacy:protectedLegacy};
      }
      const lang=['fr','ru','en'].includes(language)?language:null;
      if(owned){
        codesDb.prepare('UPDATE codes SET active=1,expires_at=?,preferred_language=COALESCE(?,preferred_language) WHERE code=?')
          .run(entitlement.expiresAt,lang,owned.code);
        codesDb.prepare('UPDATE premium_pass_code_links SET last_active=1,last_expiry=? WHERE email=?').run(entitlement.expiresAt,address);
      }else{
        const code=randomBytes(16).toString('hex').toUpperCase();
        // This is the existing MANUAL-analysis budget, not a validated signal
        // limit. Do not silently give unlimited paid model calls to all buyers.
        codesDb.prepare('INSERT INTO codes(code,email,plan,active,expires_at,credits_max,credits_used,credits_date,created_at,preferred_language) VALUES (?,?,?,1,?,10,0,?,?,?)')
          .run(code,address,'premium',entitlement.expiresAt,new Date(now).toISOString().slice(0,10),new Date(now).toISOString(),lang||'fr');
        codesDb.prepare('INSERT INTO premium_pass_code_links(email,code,last_expiry,last_active) VALUES (?,?,?,1)').run(address,code,entitlement.expiresAt);
      }
      codesDb.exec('COMMIT');return {active:true,passActive:true,expiresAt:entitlement.expiresAt,preservedLegacy:false};
    }catch(error){codesDb.exec('ROLLBACK');throw error;}
  }
  return {reconcile};
}
module.exports={createAccessProjection};
