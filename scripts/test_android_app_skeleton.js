const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const files = [
  "mobile/android/settings.gradle",
  "mobile/android/build.gradle",
  "mobile/android/app/build.gradle",
  "mobile/android/app/src/main/AndroidManifest.xml",
  "mobile/android/app/src/main/java/com/touslesmatchs/app/MainActivity.java",
  ".github/workflows/build-android-apk.yml",
];

for (const rel of files) {
  assert(fs.existsSync(path.join(root, rel)), `${rel} manquant`);
}

const main = fs.readFileSync(path.join(root, "mobile/android/app/src/main/java/com/touslesmatchs/app/MainActivity.java"), "utf8");
assert(main.includes("https://www.touslesmatchs.com/dashboard.html?source=android"), "URL dashboard manquante");
assert(main.includes("touslesmatchs.com"), "domaine TousLesMatchs manquant");
assert(main.includes("settings.setJavaScriptEnabled(true)"), "JavaScript requis pour le dashboard");
assert(main.includes("settings.setDomStorageEnabled(true)"), "stockage local requis pour la session");

const manifest = fs.readFileSync(path.join(root, "mobile/android/app/src/main/AndroidManifest.xml"), "utf8");
assert(manifest.includes("android.permission.INTERNET"), "permission internet manquante");
assert(!manifest.includes("BILLING"), "Play Billing ne doit pas être activé dans cette bêta consumption-only");

console.log("android_app_skeleton: OK");
