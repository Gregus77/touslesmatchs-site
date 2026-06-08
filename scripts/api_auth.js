// api_auth.js — Auth endpoints + Stripe Checkout
// Login/Register : stubs Phase 4 (JWT à implémenter)
// handleStripeCheckout : fonctionnel dès maintenant

const https = require("https");

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";

function cors(res) {
  res.setHeader("Content-Type", "application/json");
}

function handleLogin(req, res, body) {
  cors(res);
  res.writeHead(503);
  res.end(JSON.stringify({ ok: false, error: "Authentification bientôt disponible" }));
}

function handleRegister(req, res, body) {
  cors(res);
  res.writeHead(503);
  res.end(JSON.stringify({ ok: false, error: "Inscription bientôt disponible" }));
}

function handleStripeCheckout(req, res, body) {
  cors(res);
  try {
    const { price_id } = JSON.parse(body);
    if (!price_id) {
      res.writeHead(400);
      res.end(JSON.stringify({ ok: false, error: "price_id requis" }));
      return;
    }
    if (!STRIPE_KEY) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: "Stripe non configuré" }));
      return;
    }

    const stripeBody = new URLSearchParams({
      "payment_method_types[0]": "card",
      "mode": "subscription",
      "line_items[0][price]": price_id,
      "line_items[0][quantity]": "1",
      "success_url": "https://www.touslesmatchs.com?premium=success",
      "cancel_url": "https://www.touslesmatchs.com?premium=cancel",
      "allow_promotion_codes": "true"
    }).toString();

    const stripeReq = https.request({
      hostname: "api.stripe.com",
      path: "/v1/checkout/sessions",
      method: "POST",
      headers: {
        "Authorization": "Bearer " + STRIPE_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(stripeBody)
      }
    }, stripeRes => {
      let d = ""; stripeRes.on("data", c => d += c);
      stripeRes.on("end", () => {
        try {
          const session = JSON.parse(d);
          if (session.url) {
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, url: session.url }));
          } else {
            res.writeHead(400);
            res.end(JSON.stringify({ ok: false, error: session.error && session.error.message || "Erreur Stripe" }));
          }
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: "Erreur parsing réponse Stripe" }));
        }
      });
    });

    stripeReq.on("error", () => {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: "Connexion Stripe échouée" }));
    });
    stripeReq.write(stripeBody);
    stripeReq.end();
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
}

module.exports = { handleLogin, handleRegister, handleStripeCheckout };
