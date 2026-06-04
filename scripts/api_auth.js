// ═══════════════════════════════════════════════════════
// API AUTH ENDPOINTS — /api/auth/login, /api/auth/register
// ═══════════════════════════════════════════════════════

const UsersManager = require("./users_manager");
const users = new UsersManager();

const https = require("https");

// POST /api/auth/login
async function handleLogin(req, res, body) {
  try {
    const { email, password } = JSON.parse(body);
    const result = users.authenticateUser(email, password);

    if (result.ok) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, user: result.user }));
    } else {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: result.error }));
    }
  } catch (e) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
}

// POST /api/auth/register
async function handleRegister(req, res, body) {
  try {
    const { email, password } = JSON.parse(body);
    const result = users.createUser(email, password, "free");

    if (result.ok) {
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, user: result.user }));
    } else {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: result.error }));
    }
  } catch (e) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
}

// POST /api/stripe/create-checkout
async function handleStripeCheckout(req, res, body) {
  try {
    const { price_id, user_id } = JSON.parse(body);
    const user = users.getUserById(user_id);

    if (!user) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "User not found" }));
      return;
    }

    const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
    if (!STRIPE_KEY || !price_id) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Stripe non configuré" }));
      return;
    }

    const stripeBody = new URLSearchParams({
      "payment_method_types[0]": "card",
      "mode": "subscription",
      "line_items[0][price]": price_id,
      "line_items[0][quantity]": "1",
      "success_url": "https://www.touslesmatchs.com?premium=success&user_id=" + user_id,
      "cancel_url": "https://www.touslesmatchs.com?premium=cancel",
      "allow_promotion_codes": "true",
      "client_reference_id": user_id,
      "customer_email": user.email,
    }).toString();

    const stripeReq = https.request({
      hostname: "api.stripe.com",
      path: "/v1/checkout/sessions",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(stripeBody),
      },
    }, stripeRes => {
      let d = "";
      stripeRes.on("data", c => d += c);
      stripeRes.on("end", () => {
        try {
          const session = JSON.parse(d);
          if (session.url) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, url: session.url }));
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: session.error?.message || "Erreur Stripe" }));
          }
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Erreur parsing Stripe" }));
        }
      });
    });

    stripeReq.on("error", () => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Connexion Stripe échouée" }));
    });

    stripeReq.write(stripeBody);
    stripeReq.end();
  } catch (e) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
}

module.exports = {
  handleLogin,
  handleRegister,
  handleStripeCheckout,
};
