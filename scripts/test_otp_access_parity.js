'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');const root=path.join(__dirname,'..');const api=fs.readFileSync(path.join(root,'scripts/api_server.js'),'utf8');
const fn=api.slice(api.indexOf('function paidGoal05Account('),api.indexOf('// Contrôle des droits seul'));
const accounts={owner:{plan:'elite',credits_max:999},free:{plan:'free'},expired:{plan:'premium',expires_at:'2000-01-01T00:00:00Z'}};
const c={console,verifyFcmSubscriber:()=>null,lookupAccountByEmail:e=>accounts[e],db:{prepare:()=>({get:token=>accounts[token]?{email:token,expires_at:'2099-01-01T00:00:00Z'}:null})}};vm.createContext(c);vm.runInContext(fn,c);
const request=t=>({headers:{authorization:'Bearer '+t}});
assert(c.paidGoal05Account(request('owner')));for(const t of ['free','expired','forged'])assert.equal(c.paidGoal05Account(request(t)),null);
const header=fs.readFileSync(path.join(root,'public/js/global-header.js'),'utf8');const auth=header.split('\n').find(l=>l.includes('function authHeaders()'));
const h={localStorage:{getItem:k=>({tlm_token:'obsolete',tlm_session_token:'new-otp',tlm_email:'test'}[k])}};vm.createContext(h);vm.runInContext(auth,h);assert.equal(h.authHeaders().Authorization,'Bearer new-otp');assert(header.includes('/api/auth/access?'));
for(const file of ['dashboard.html','live-ia.html']){const html=fs.readFileSync(path.join(root,'public',file),'utf8');for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/src=|application\/ld\+json|application\/json/.test(m[1]))continue;new vm.Script(m[2],{filename:file});}}
const home=fs.readFileSync(path.join(root,'public/index.html'),'utf8');assert(home.includes('m.client_display_eligible===true||m.client_product_eligible===true'));assert(api.includes('client_display_eligible: isClientOu25MatchEligible(m, false)'));assert(api.includes('const allMatches = cacheOnly ? (liveMatchesCache.data || []) : await fetchLiveMatches();'));
console.log('PASS OTP: active owner paid; free, expired and forged remain locked; new email token wins; display scope separate from signal rules');
