const fs = require("fs");

const appHtml = fs.readFileSync("public/app.html", "utf8");
const apiServer = fs.readFileSync("scripts/api_server.js", "utf8");

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

assertIncludes(appHtml, "app-auth-split", "two-column account onboarding");
assertIncludes(appHtml, "Déjà abonné ?", "existing subscriber entry");
assertIncludes(appHtml, "Recevoir mon accès gratuit", "new user free access CTA");
assertIncludes(appHtml, "login: true", "session login flag");
assertIncludes(appHtml, "d.valid || d.ok", "verify-code valid response handling");
assertIncludes(appHtml, 'token() ? "pick" : "me"', "first launch opens account screen");
assertIncludes(appHtml, "/api/app-access/start", "app access public endpoint");

assertIncludes(apiServer, "handleAppAccessStart", "shared app access handler");
assertIncludes(apiServer, 'app.post("/api/app-access/start"', "api-prefixed app access route");
assertIncludes(apiServer, 'app.post("/app-access/start"', "stripped app access route");
assertIncludes(apiServer, "APP_ANDROID_LEAD", "Brevo Android lead tag");
assertIncludes(apiServer, "Ton code d’accès application TousLesMatchs", "access code email subject");

console.log("app_onboarding_flow: OK");
