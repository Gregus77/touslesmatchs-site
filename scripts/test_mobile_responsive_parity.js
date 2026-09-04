"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const home = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "public", "app.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const heroCssStart = home.indexOf('<style id="tlm-stadium-live-hero-css">');
const mobileStart = home.indexOf("@media(max-width:600px)", heroCssStart);
const mobileEnd = home.indexOf("@media(prefers-reduced-motion:reduce)", mobileStart);
const mobileCss = home.slice(mobileStart, mobileEnd);

assert(mobileStart >= 0 && mobileEnd > mobileStart, "le bloc CSS mobile du hero doit exister");
assert(
  mobileCss.includes(".tlm-ai-row{grid-template-columns:minmax(0,1fr) auto"),
  "les votes et le total doivent rester sur la même ligne sur mobile"
);
assert(
  mobileCss.includes(".tlm-ai-total strong{font-size:30px;white-space:nowrap}"),
  "le total 0 / 5 ne doit jamais se couper sur deux lignes"
);
assert(
  mobileCss.includes(".tlm-stage-teams{grid-template-columns:minmax(0,1fr) minmax(72px,auto) minmax(0,1fr)"),
  "les deux équipes et le score doivent tenir dans la carte"
);
assert(
  home.includes("#hero-live-date{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"),
  "la date doit rester compacte sans agrandir la carte"
);
assert(
  mobileCss.includes("body.tlm-page-home .tlm-floating-widgets") &&
    mobileCss.includes("display:none!important;visibility:hidden!important"),
  "les boutons flottants ne doivent pas recouvrir le hero mobile"
);

const version = "tlm-app-v13-responsive-20260904";
assert(sw.includes(`const VERSION = "${version}"`), "le cache PWA doit utiliser la nouvelle version");
assert(home.includes(`/sw.js?v=${version}`), "l'accueil doit demander le nouveau service worker");
assert(
  (app.match(new RegExp(`/sw\\.js\\?v=${version}`, "g")) || []).length === 2,
  "les deux enregistrements PWA de l'application doivent utiliser la nouvelle version"
);

console.log("OK — parité responsive site/application protégée");
