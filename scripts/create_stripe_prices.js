#!/usr/bin/env node
// ═══════════════════════════════════════════════════════
// CREATE STRIPE PRICES — Premium/VIP/Elite
// ═══════════════════════════════════════════════════════

const https = require("https");

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_KEY) {
  console.error("❌ STRIPE_SECRET_KEY not set");
  process.exit(1);
}

const prices = [
  {
    name: "Premium",
    amount: 990, // 9.90€ en cents
    currency: "eur",
    interval: "month",
    product_name: "TousLesMatchs Premium",
  },
  {
    name: "VIP",
    amount: 1990, // 19.90€
    currency: "eur",
    interval: "month",
    product_name: "TousLesMatchs VIP",
  },
  {
    name: "Elite",
    amount: 2990, // 29.90€
    currency: "eur",
    interval: "month",
    product_name: "TousLesMatchs Elite",
  },
];

// Stripe exige application/x-www-form-urlencoded (pas JSON)
function stripePost(path, params) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(params).toString();
    const req = https.request({
      hostname: "api.stripe.com",
      path,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(data),
      },
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(d);
          if (parsed.error) {
            console.error("  Stripe error:", parsed.error.message);
          }
          resolve(parsed);
        } catch {
          reject(new Error("Parse error"));
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function createPrices() {
  console.log("\n🔨 Creating Stripe Prices...\n");

  const results = {};

  for (const price of prices) {
    try {
      // 1. Create product
      console.log(`  → Creating ${price.name} product...`);
      const productRes = await stripePost("/v1/products", {
        name: price.product_name,
      });

      if (!productRes.id) {
        console.error(`  ❌ Failed to create ${price.name} product`);
        continue;
      }

      const productId = productRes.id;
      console.log(`     ✓ Product created: ${productId}`);

      // 2. Create price for product
      console.log(`  → Creating ${price.name} price (€${(price.amount / 100).toFixed(2)}/month)...`);
      const priceRes = await stripePost("/v1/prices", {
        product: productId,
        unit_amount: price.amount,
        currency: price.currency,
        "recurring[interval]": price.interval,
      });

      if (!priceRes.id) {
        console.error(`  ❌ Failed to create ${price.name} price`);
        continue;
      }

      results[price.name] = {
        product_id: productId,
        price_id: priceRes.id,
      };

      console.log(`     ✓ Price created: ${priceRes.id}\n`);
    } catch (e) {
      console.error(`  ❌ Error for ${price.name}: ${e.message}\n`);
    }
  }

  // Output results
  console.log("✅ RESULTS:\n");
  console.log(JSON.stringify(results, null, 2));
  console.log("\n📝 Add these to your .env file:");
  console.log(`STRIPE_PRICE_ID_PREMIUM=${results.Premium?.price_id || "MISSING"}`);
  console.log(`STRIPE_PRICE_ID_VIP=${results.VIP?.price_id || "MISSING"}`);
  console.log(`STRIPE_PRICE_ID_ELITE=${results.Elite?.price_id || "MISSING"}`);
}

createPrices().catch(console.error);
