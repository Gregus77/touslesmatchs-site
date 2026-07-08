const fs = require("fs");
const path = require("path");

const API_SERVER_PATH = path.join(__dirname, "..", "api_server.js");
const apiSource = fs.readFileSync(API_SERVER_PATH, "utf8");

describe("RC2 — Stripe Carte mode", () => {
  test("/stripe/create-checkout must use dynamic mode based on plan", () => {
    const stripeCheckoutBlock = apiSource.match(
      /app\.post\("\/stripe\/create-checkout"[\s\S]*?res\.json\(\{ ok: true, url: session\.url \}\)/
    );
    expect(stripeCheckoutBlock).not.toBeNull();
    const block = stripeCheckoutBlock[0];

    expect(block).not.toMatch(/mode:\s*["']subscription["']\s*,/);
    expect(block).toMatch(/mode.*carte.*payment|payment.*carte/s);
  });

  test("/create-checkout must use payment mode for carte plan", () => {
    const handleCheckoutBlock = apiSource.match(
      /async function handleCreateCheckout[\s\S]*?res\.json\(\{ ok: true, url: session\.url \}\)/
    );
    expect(handleCheckoutBlock).not.toBeNull();
    const block = handleCheckoutBlock[0];

    expect(block).toMatch(/plan\s*===\s*["']carte["']\s*\?\s*["']payment["']/);
  });

  test("no checkout endpoint should hardcode mode subscription for all plans", () => {
    const checkoutBlocks = apiSource.match(
      /checkout\.sessions\.create\(\{[\s\S]*?\}\)/g
    ) || [];

    for (const block of checkoutBlocks) {
      if (block.includes("mode:") && !block.includes("mode,") && !block.includes("mode\n")) {
        expect(block).not.toMatch(/mode:\s*["']subscription["']\s*,/);
      }
    }
  });

  test("cancel_url should point to existing pages", () => {
    const cancelUrls = apiSource.match(/cancel_url:\s*["'][^"']+["']/g) || [];
    for (const url of cancelUrls) {
      expect(url).not.toContain("/subscription");
    }
  });
});
