const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");
const SCRIPTS_DIR = path.join(__dirname, "..");

const FORBIDDEN_PATTERN = /\bpari(?:er|ez|ons|ent|é|ée|ées|és|s)?\b/gi;

const ALLOWED_WORDS = ["Paris", "ParionsSport"];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(FORBIDDEN_PATTERN);
    if (!matches) continue;

    for (const match of matches) {
      if (ALLOWED_WORDS.includes(match)) continue;
      if (/Europe\/Paris/.test(line)) continue;
      if (/timeZone.*Paris/.test(line)) continue;
      if (/Saint-Germain/.test(line)) continue;
      if (/home:\s*["']Paris/.test(line)) continue;
      if (/heure de Paris/.test(line)) continue;
      if (/fr-CA.*Paris/.test(line)) continue;

      violations.push({ file: filePath, line: i + 1, text: line.trim(), match });
    }
  }
  return violations;
}

function getHtmlFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getHtmlFiles(full));
    } else if (entry.name.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

describe("RC2 — ANJ compliance scan", () => {
  test("no public HTML file contains forbidden ANJ terms", () => {
    const htmlFiles = getHtmlFiles(PUBLIC_DIR);
    expect(htmlFiles.length).toBeGreaterThan(0);

    const allViolations = [];
    for (const file of htmlFiles) {
      allViolations.push(...scanFile(file));
    }

    if (allViolations.length > 0) {
      const report = allViolations.map(v =>
        `  ${path.relative(PUBLIC_DIR, v.file)}:${v.line} → "${v.match}"`
      ).join("\n");
      fail(`ANJ violations found in public HTML:\n${report}`);
    }
  });

  test("user-facing email scripts do not contain forbidden ANJ terms", () => {
    const emailScripts = [
      "send_welcome_email.js",
      "send_sequence_email.js",
      "publish_free_nopick.js",
      "publish_free_premium_reminder.js",
    ];

    const allViolations = [];
    for (const script of emailScripts) {
      const filePath = path.join(SCRIPTS_DIR, script);
      if (fs.existsSync(filePath)) {
        allViolations.push(...scanFile(filePath));
      }
    }

    if (allViolations.length > 0) {
      const report = allViolations.map(v =>
        `  ${path.basename(v.file)}:${v.line} → "${v.match}"`
      ).join("\n");
      fail(`ANJ violations found in email scripts:\n${report}`);
    }
  });

  test("Telegram messages in api_server.js do not contain forbidden terms", () => {
    const apiPath = path.join(SCRIPTS_DIR, "api_server.js");
    const content = fs.readFileSync(apiPath, "utf8");

    const tgMessagePattern = /sendTelegramMessage\([^,]+,\s*[`"'][\s\S]*?[`"']\)/g;
    const tgTemplates = content.match(tgMessagePattern) || [];

    const tgTextPattern = /tg(?:Free|Premium|Elite)Text\s*=\s*`[\s\S]*?`;/g;
    const tgTexts = content.match(tgTextPattern) || [];

    const allMessages = [...tgTemplates, ...tgTexts].join("\n");
    const violations = allMessages.match(FORBIDDEN_PATTERN) || [];
    const real = violations.filter(m => !ALLOWED_WORDS.includes(m));

    expect(real).toEqual([]);
  });
});

describe("RC2 — Legal pages exist", () => {
  const requiredPages = [
    "mentions-legales.html",
    "politique-confidentialite.html",
    "cookies.html",
    "cgu.html",
    "cgv.html",
  ];

  for (const page of requiredPages) {
    test(`${page} exists in public/`, () => {
      const filePath = path.join(PUBLIC_DIR, page);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  }

  test("index.html footer links to all legal pages", () => {
    const indexContent = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");
    expect(indexContent).toContain('href="/mentions-legales.html"');
    expect(indexContent).toContain('href="/cgu.html"');
    expect(indexContent).toContain('href="/cgv.html"');
    expect(indexContent).toContain('href="/politique-confidentialite.html"');
    expect(indexContent).toContain('href="/cookies.html"');
  });

  test("live-ia.html footer links to all legal pages", () => {
    const liveContent = fs.readFileSync(path.join(PUBLIC_DIR, "live-ia.html"), "utf8");
    expect(liveContent).toContain('href="/mentions-legales.html"');
    expect(liveContent).toContain('href="/cgu.html"');
    expect(liveContent).toContain('href="/cgv.html"');
    expect(liveContent).toContain('href="/politique-confidentialite.html"');
    expect(liveContent).toContain('href="/cookies.html"');
  });
});

describe("RC2 — Preuves page", () => {
  test("preuves/index.html exists", () => {
    expect(fs.existsSync(path.join(PUBLIC_DIR, "preuves", "index.html"))).toBe(true);
  });
});
