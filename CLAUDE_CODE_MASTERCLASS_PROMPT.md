# 🎯 CLAUDE CODE — PROMPT MASTERCLASS 
## Améliorer TousLesMatchs : Meilleurs Paris + Tunnel Vente + Revenue

**COPY/PASTE THIS ENTIRE PROMPT INTO YOUR CLAUDE CODE CONVERSATION FOR TOUSLESMATCHS**

---

## 📋 CONTEXTE

Tu travailles sur **TousLesMatchs.com** — une plateforme de pronostics IA avec:
- **Core**: Picks sportifs (78% winrate, Hockey > Football)
- **Current state**: Site React gratuit avec affiliation bookmakers
- **Goal**: Monétiser via Stripe (19.90€/mois Premium) TOUT EN améliorant la qualité des picks

**Reference documents dans le projet**:
- `HERMES_SKILLS_AUDIT.md` — 15 skills sélectionnés
- `HERMES_SITE_AUDIT.md` — gaps actuels + critical issues
- `HERMES_KARPATHY_PATTERNS.md` — patterns à appliquer
- `CLAUDE.md` — state du projet

---

## 🎓 TES PATTERNS KARPATHY À APPLIQUER

1. **Three-File Contract** → User DB immutable (audit trail)
2. **Observable Metrics** → GA4 events custom complets
3. **Agentic Loop** → Observe user behavior → Recommend tier
4. **Paywall Routing** → Free → Trial → Premium → VIP (fallback cascade)
5. **Immutable Evaluator** → Track conversions rigoureusement

---

## 🎯 3 OBJECTIFS (Ordre strict)

### OBJECTIF 1: EMAIL CAPTURE + TRIAL (HIGHEST ROI)
```
What: Add email input @ homepage + 3-day free trial funnel
Why: 0 emails = 0 nurture = 0 repeat revenue
Metrics: 100+ emails/day, 20+ trial signups/day
Pattern: Observable funnel (every step tracked in GA4)
```

### OBJECTIF 2: PAYWALL + PREMIUM CTA (CONVERSION)
```
What: Gate "Analyse Live" feature behind 19.90€/month paywall
Why: Feature exists but is free = no revenue lock
Metrics: 5-10% paywall conversion rate
Pattern: Fallback routing (Free → Trial → Premium → Fail)
```

### OBJECTIF 3: BETTER PICKS + EXPLAINABILITY (TRUST)
```
What: Show WHY each pick (variables, confidence score breakdown)
Why: 78% winrate needs context (not just "pick X")
Metrics: Increased trust = better conversion to Premium
Pattern: Observable reasoning (audit trail of decision logic)
```

---

## 🚀 IMPLEMENTATION ROADMAP (STRICT ORDER)

### PHASE 1: EMAIL + TRIAL (Day 1-2 = 6 hours)

#### Task 1.1: Email Capture Component
```
FILE: src/EmailCapture.js
WHAT: React component with email input
WHERE: Homepage hero section (top priority placement)
CTA TEXT: "📧 Get 3 Days Free Premium Access"
INPUTS: [email field] [submit button]
OUTPUT: 
  - Send email to backend /api/newsletter/subscribe
  - GA4 event: "email_captured"
  - Show "Check your email!" success message
  - Redirect to trial page after submit

REQUIREMENT: Input validation (email format), error handling
```

#### Task 1.2: Trial Funnel Backend
```
FILE: scripts/trial_manager.js (NEW)
WHAT: Create trial user in DB, send welcome email
ENDPOINT: POST /api/newsletter/subscribe
INPUT: {email}
LOGIC:
  1. Check email not duplicate
  2. Create user: {email, status: "TRIAL", trial_start: now, trial_end: now+3days}
  3. Send email: "Welcome! Your 3-day trial starts now"
  4. GA4 event: "trial_started"
  5. Return: {status: "success", trial_end_date}

DATABASE: Store in MongoDB (or JSON file for MVP)
Structure: {_id, email, status, trial_start, trial_end, subscription_date, created_at}
```

#### Task 1.3: GA4 Custom Events
```
ADD EVENTS:
  - "email_captured": {email_domain, timestamp}
  - "trial_started": {email, trial_duration_days}
  - "trial_page_visited": {}
  - "upgrade_clicked": {from_page, upgrade_tier}

CODE: In src/App.js + Subscription.js
TRACKING: Use existing window.gtag() function
VERIFY: Check GA4 dashboard real-time after deploy
```

---

### PHASE 2: PAYWALL + PREMIUM CTA (Day 2-3 = 8 hours)

#### Task 2.1: Subscription Model (Database)
```
FILE: scripts/subscription.js (NEW)
CREATE TABLE "subscriptions":
  {
    _id: ObjectId,
    email: String (unique),
    status: Enum["FREE", "TRIAL", "PREMIUM", "VIP"],
    stripe_customer_id: String,
    stripe_subscription_id: String,
    trial_start: Date,
    trial_end: Date,
    subscription_start: Date,
    subscription_end: Date,
    tier: Enum["PREMIUM", "VIP"],
    price: Number (1990 cents = €19.90),
    payment_method: String,
    created_at: Date,
    updated_at: Date,
    audit_log: Array (immutable)
  }

IMMUTABLE: Never UPDATE/DELETE, only INSERT audit log
```

#### Task 2.2: Paywall Gate on Analyse Live
```
FILE: src/AnalyseLive.js (MODIFY)
CURRENT: Feature is 100% free
NEW:
  - Check user.subscription status
  - if status === "TRIAL" AND trial_expired:
      → Show paywall card
  - if status === "FREE":
      → Show paywall card
  - if status === "PREMIUM" OR "VIP":
      → Show full analysis (unlimited)

PAYWALL CARD COMPONENT (src/PaywallCard.js):
  - Title: "💎 Upgrade to Premium"
  - Price: "€19.90/month"
  - Features:
    ✅ Unlimited live analysis
    ✅ Daily picks in email
    ✅ Advanced odds
  - CTA button: "Start Premium" → /subscription
  - Risk reversal: "30-day guarantee"
  - GA4 event: "paywall_shown"
```

#### Task 2.3: Stripe Integration Prep
```
FILE: src/Subscription.js (MODIFY)
REQUIREMENT: Stripe React library (npm install @stripe/react-js)
WHAT: Checkout button linking to Stripe
STRIPE SETUP:
  1. Create Stripe account (stripe.com)
  2. Create product "Premium Monthly" (€19.90)
  3. Add STRIPE_PUBLIC_KEY to .env
  4. Backend webhook receiver ready (Phase 3)

CHECKOUT FLOW:
  1. User clicks "Start Premium"
  2. Stripe checkout page opens
  3. User enters payment (card)
  4. Stripe webhook → backend activation
  5. User redirected to dashboard

SETUP (MVP): Don't code full flow yet, just Checkout button
```

#### Task 2.4: Premium CTA Redesign on Homepage
```
FILE: src/App.js (MODIFY homepage section)
CURRENT: Small "💎 Devenir Premium" button hidden
NEW: Prominent card design:

┌─────────────────────────────────┐
│      💎 UPGRADE TO PREMIUM       │
├─────────────────────────────────┤
│ Get unlimited access to:         │
│  ✅ Live match analysis          │
│  ✅ Daily picks in your email    │
│  ✅ Advanced probability models  │
│  ✅ 30-day guarantee             │
│                                  │
│  €19.90/month • Cancel anytime  │
│                                  │
│   [🔐 START PREMIUM]             │
│                                  │
│ 897 users already subscribed     │
└─────────────────────────────────┘

SCARCITY TEXT: "897/1000 premium slots filled" 
  → Update this daily (counter)
  → GA4 event: "premium_card_viewed"
```

---

### PHASE 3: BETTER PICKS + EXPLAINABILITY (Day 3-4 = 4 hours)

#### Task 3.1: Pick Reasoning Component
```
FILE: src/PickDetail.js (NEW)
SHOW for each pick in the main feed:

Pick: "Over 2.5 goals — Italy vs Greece"
Confidence: 8.3/10 ⭐⭐⭐⭐⭐⭐⭐⭐

WHY THIS PICK:
├─ Form analysis: Italy 5W-1L (recent), Greece 2W-4L
├─ Head-to-head: Italy 3-0 vs Greece (last 3 meetings)
├─ Home/Away: Italy +1.2 goals @ home
├─ Injury report: No key injuries
├─ Odds value: 1.65 (EV = +12%)
└─ AI confidence: DeepSeek model trained on 500+ matches

[Show breakdown chart or expandable details]
```

#### Task 3.2: Confidence Score Breakdown
```
CONFIDENCE FORMULA (display this):
  8.3/10 = Average of:
    ├─ Form score: 8.5 (recent wins)
    ├─ Head-to-head: 8.0 (historical edge)
    ├─ Odds value: 8.2 (probabilistic edge)
    ├─ AI model: 8.4 (DeepSeek prediction)
    └─ Injury risk: 8.1 (no key absences)

SHOW AS: Visual bar chart or simple breakdown
PURPOSE: Build trust (not magic, science-based)
```

#### Task 3.3: Add "Previous 10 Picks" Mini-Stats
```
FILE: src/StatsWidget.js (NEW or modify existing)
SHOW ON HOMEPAGE:

╔════════════════════════╗
║ RECENT PERFORMANCE     ║
╠════════════════════════╣
║ Last 10 picks: 8W-2L   ║
║ Winrate: 80% ↑         ║
║ ROI: +45% (this month) ║
║ Avg odds: 1.68         ║
╚════════════════════════╝

PURPOSE: Social proof + credibility
PLACEMENT: Hero section + sidebar
```

---

## ✅ VERIFICATION CHECKLIST (Before Deploy)

### Phase 1 Verification (Email capture works)
- [ ] Email input visible on homepage
- [ ] Submit button works (no JS errors)
- [ ] GA4 event "email_captured" fires
- [ ] Backend receives email + stores
- [ ] Trial user created in DB with expiry
- [ ] Welcome email sent successfully
- [ ] Test with fake email (abc@test.com)

### Phase 2 Verification (Paywall works)
- [ ] Non-logged user sees paywall on Analyse Live
- [ ] Paywall card displays correctly (mobile + desktop)
- [ ] Premium CTA button visible on homepage
- [ ] GA4 event "paywall_shown" fires
- [ ] GA4 event "upgrade_clicked" fires when button clicked
- [ ] Stripe checkout loads (test mode)
- [ ] Scarcity counter updates daily

### Phase 3 Verification (Picks explained)
- [ ] Pick detail shows confidence score
- [ ] Breakdown chart renders (form/h2h/odds/etc)
- [ ] "Previous 10 picks" stats widget shows
- [ ] Stats update when new pick added
- [ ] Mobile layout doesn't break

### Overall Verification
- [ ] No console errors (F12)
- [ ] All GA4 events firing in real-time
- [ ] Responsive design (360px, 768px, 1920px widths)
- [ ] Dark mode still works (black & gold)
- [ ] All external links working (Telegram, TikTok, Winamax)
- [ ] Load time < 3s (Lighthouse check)

---

## 📊 SUCCESS METRICS (This Week)

| Metric | Target | How to measure |
|--------|--------|-----------------|
| Emails captured | 50+ | GA4 "email_captured" count |
| Trial conversions | 10+ | DB trial user count |
| Paywall impressions | 100+ | GA4 "paywall_shown" count |
| Premium signups | 2-3 | Stripe dashboard |
| Pick confidence understanding | +40% users | GA4 page scroll depth increase |

---

## 🎯 NEXT ACTIONS AFTER THIS

Once this is deployed + tested:

**Week 2**:
- Stripe webhook completion (auto-activation)
- Email nurture sequence (daily picks in inbox)
- User dashboard (see trial countdown, upgrade option)

**Week 3**:
- Premium features unlock (Analyse Live unlimited)
- VIP tier (€99/month, unlimited analysis + API)
- SEO blog articles (drive organic traffic)

**Week 4+**:
- TikTok auto-poster (viral growth)
- Affiliate optimization (higher commission bookmakers)
- Monitoring dashboard (revenue, conversions, retention)

---

## 🔗 REFERENCE FILES IN PROJECT

```
├── HERMES_SKILLS_AUDIT.md          ← 15 skills roadmap
├── HERMES_SITE_AUDIT.md            ← Detailed gaps analysis
├── HERMES_KARPATHY_PATTERNS.md     ← Pattern implementation examples
├── HERMES_QUICK_SUMMARY.md         ← Quick reference
├── CLAUDE.md                        ← Project state
├── src/App.js                       ← Main site
├── src/AnalyseLive.js              ← Feature to paywall
├── src/Subscription.js             ← Stripe integration
└── scripts/multi_agent.js          ← Pick generation (already good)
```

---

## ⚠️ IMPORTANT NOTES

### Don't modify these (they're working):
- `scripts/multi_agent.js` (picks generation)
- `scripts/bot.js` (Telegram)
- Winrate logic (already 78%)

### DO modify these (to add features):
- `src/App.js` (add Email capture + Premium CTA)
- `src/AnalyseLive.js` (add paywall gate)
- `src/Subscription.js` (add Stripe)
- `package.json` (add @stripe/react-js)

### Create NEW files:
- `src/EmailCapture.js` (email input)
- `src/PaywallCard.js` (paywall component)
- `src/PickDetail.js` (confidence breakdown)
- `src/StatsWidget.js` (recent performance)
- `scripts/trial_manager.js` (backend trial logic)
- `scripts/subscription.js` (DB schema)

---

## 🚀 START NOW

1. **Read** `HERMES_SITE_AUDIT.md` (10 min) to understand gaps
2. **Check** `src/App.js` structure (understand current layout)
3. **Create** `src/EmailCapture.js` component (2 hours)
4. **Test** email capture end-to-end with GA4
5. **Deploy** to VPS (via GitHub actions)
6. **Monitor** GA4 events firing in real-time
7. **Iterate** based on conversion metrics

---

## 💡 FINAL THOUGHT (Karpathy Mindset)

> "From vibe coding to agentic engineering"

**Your current state**: Vibe code (free picks, no monetization)
**Your new state**: Agentic engineering (pick quality + conversion funnel + observable metrics)

This prompt is NOT "add random features". It's:
✅ Observable (GA4 tracks every step)
✅ Three-file contract (User DB immutable)
✅ Fallback routing (Free → Trial → Premium)
✅ Agent-directed (you decide, I execute)

**Your job**: Direct. **My job**: Execute. **Result**: €10K+/month revenue by August.

---

**Ready? Start implementing Phase 1. Report back when email capture is live.**

**Hermès Skills Lab + Claude Code | 08/06/2026**
