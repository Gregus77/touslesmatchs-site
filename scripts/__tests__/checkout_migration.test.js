const fs = require("fs");
const path = require("path");

// ── 1. No buy.stripe.com links remain in frontend files ──

describe("Payment Link migration — no buy.stripe.com remaining", () => {
  const frontendFiles = [
    path.resolve(__dirname, "../../public/index.html"),
    path.resolve(__dirname, "../../public/live-ia.html"),
    path.resolve(__dirname, "../../site/index.html"),
  ];

  for (const filePath of frontendFiles) {
    const basename = path.relative(path.resolve(__dirname, "../.."), filePath);
    test(`${basename} has no buy.stripe.com links`, () => {
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).not.toContain("buy.stripe.com");
    });
  }

  test("api_server.js has no buy.stripe.com links", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    expect(content).not.toContain("buy.stripe.com");
  });
});

// ── 2. Frontend files use startCheckout() ──

describe("Frontend uses startCheckout() API flow", () => {
  test("public/index.html calls startCheckout for carte", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../../public/index.html"), "utf8");
    expect(content).toContain("startCheckout('carte'");
  });

  test("public/index.html calls startCheckout for premium", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../../public/index.html"), "utf8");
    expect(content).toContain("startCheckout('premium'");
  });

  test("public/index.html calls startCheckout for elite", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../../public/index.html"), "utf8");
    expect(content).toContain("startCheckout('elite'");
  });

  test("public/index.html defines startCheckout function", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../../public/index.html"), "utf8");
    expect(content).toContain("function startCheckout(plan");
  });

  test("public/live-ia.html defines startCheckout function", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../../public/live-ia.html"), "utf8");
    expect(content).toContain("function startCheckout(plan");
  });

  test("site/index.html defines startCheckout function", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../../site/index.html"), "utf8");
    expect(content).toContain("function startCheckout(plan");
  });

  test("startCheckout calls /api/create-checkout", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../../public/index.html"), "utf8");
    expect(content).toContain("fetch('/api/create-checkout'");
  });
});

// ── 3. API create-checkout endpoint correctness ──

describe("handleCreateCheckout endpoint", () => {
  test("api_server.js registers /create-checkout route", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    expect(content).toContain('app.post("/create-checkout"');
  });

  test("handleCreateCheckout sets success_url to live-ia", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    const match = content.match(/handleCreateCheckout[\s\S]*?success_url.*?touslesmatchs\.com\/([\w-?=&{}$`]+)/);
    expect(match).not.toBeNull();
    expect(match[1]).toContain("live-ia");
  });

  test("handleCreateCheckout sets cancel_url", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    const match = content.match(/handleCreateCheckout[\s\S]*?cancel_url/);
    expect(match).not.toBeNull();
  });

  test("handleCreateCheckout passes customer_email when available", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    expect(content).toContain("customer_email");
    expect(content).toContain("sessionParams.customer_email");
  });

  test("handleCreateCheckout supports carte plan in payment mode", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    const fn = content.match(/handleCreateCheckout[\s\S]*?res\.json\(\{ ok: true/);
    expect(fn).not.toBeNull();
    expect(fn[0]).toContain('carte');
    expect(fn[0]).toContain('"payment"');
  });

  test("handleCreateCheckout supports subscription mode for premium", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    const fn = content.match(/handleCreateCheckout[\s\S]*?res\.json\(\{ ok: true/);
    expect(fn[0]).toContain('"subscription"');
  });
});

// ── 4. Webhook handles all event types ──

describe("Stripe webhook handles all event types", () => {
  test("handles checkout.session.completed", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    expect(content).toContain('"checkout.session.completed"');
  });

  test("handles customer.subscription.deleted", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    expect(content).toContain('"customer.subscription.deleted"');
  });

  test("handles invoice.payment_succeeded", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    expect(content).toContain('"invoice.payment_succeeded"');
  });

  test("handles charge.refunded", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    expect(content).toContain('"charge.refunded"');
  });
});

// ── 5. Webhook activates CRM ──

describe("Webhook integrates with CRM", () => {
  test("checkout.session.completed calls crm.activateSubscription", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    const block = content.match(/checkout\.session\.completed[\s\S]*?customer\.subscription\.deleted/);
    expect(block).not.toBeNull();
    expect(block[0]).toContain("crm.activateSubscription");
  });

  test("customer.subscription.deleted calls crm.cancelSubscription", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    const block = content.match(/customer\.subscription\.deleted[\s\S]*?invoice\.payment_succeeded/);
    expect(block).not.toBeNull();
    expect(block[0]).toContain("crm.cancelSubscription");
  });
});

// ── 6. Brevo transactional email bypass ──

describe("Brevo transactional email bypass", () => {
  test("brevoSendEmail accepts transactional option", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    expect(content).toContain("transactional = false");
  });

  test("purchase confirmation email is marked transactional", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    expect(content).toContain("{ transactional: true }");
  });

  test("transactional emails skip daily cap", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    const fn = content.match(/function brevoSendEmail[\s\S]*?httpPostStrict/);
    expect(fn).not.toBeNull();
    expect(fn[0]).toContain("if (!transactional)");
  });
});

// ── 7. Email upsells link to website, not Payment Links ──

describe("Email upsells link to website", () => {
  test("upsell block in confirmation email links to touslesmatchs.com/#plans", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    const checkoutBlock = content.match(/checkout\.session\.completed[\s\S]*?(?=if \(event\.type ===)/);
    expect(checkoutBlock).not.toBeNull();
    expect(checkoutBlock[0]).not.toContain("buy.stripe.com");
    const planLinks = (checkoutBlock[0].match(/touslesmatchs\.com\/#plans/g) || []);
    expect(planLinks.length).toBeGreaterThanOrEqual(2);
  });
});

// ── 8. No duplicate route registration ──

describe("Route registration", () => {
  test("/create-checkout is registered only once", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../api_server.js"), "utf8");
    const matches = content.match(/app\.post\("\/create-checkout"/g);
    expect(matches).not.toBeNull();
    expect(matches.length).toBe(1);
  });
});
