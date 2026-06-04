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

async function post(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname,
      path,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try {
          resolve(JSON.parse(d));
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
      const productRes = await post("api.stripe.com", "/v1/products", {
        name: price.product_name,
        type: "service",
      });

      if (!productRes.id) {
        console.error(`  ❌ Failed to create ${price.name} product`);
        continue;
      }

      const productId = productRes.id;
      console.log(`     ✓ Product created: ${productId}`);

      // 2. Create price for product
      console.log(`  → Creating ${price.name} price (€${(price.amount / 100).toFixed(2)}/month)...`);
      const priceRes = await post("api.stripe.com", "/v1/prices", {
        product: productId,
        amount: price.amount,
        currency: price.currency,
        recurring: {
          interval: price.interval,
        },
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
