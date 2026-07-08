const fs = require("fs");
const path = require("path");

const INDEX_PATH = path.join(__dirname, "..", "..", "public", "index.html");
const API_PATH = path.join(__dirname, "..", "api_server.js");
const indexSource = fs.readFileSync(INDEX_PATH, "utf8");
const apiSource = fs.readFileSync(API_PATH, "utf8");

describe("RC2.1 — Public reference amount coherence", () => {
  test("public buildChart uses mise=10 as default for non-members", () => {
    const match = indexSource.match(/var mise\s*=\s*isMember\s*\?\s*STAKE\s*:\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(match[1]).toBe("10");
  });

  test("STAKE default is 10", () => {
    const match = indexSource.match(/var STAKE\s*=\s*parseInt\(.*\)\s*\|\|\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(match[1]).toBe("10");
  });

  test("simulateur is hidden for public visitors (display:none)", () => {
    expect(indexSource).toMatch(/id="member-simulator"[^>]*style="[^"]*display:\s*none/);
  });

  test("public disclaimer is present", () => {
    expect(indexSource).toContain("Performances publiques en %");
    expect(indexSource).toContain("Simulateur de mise dans l'espace membre");
  });

  test("public section shows only % metrics (ROI, winrate), not euro amounts", () => {
    const roiSection = indexSource.match(/<section class="roi-section"[\s\S]*?<\/section>/);
    expect(roiSection).not.toBeNull();
    const section = roiSection[0];

    const htmlPart = section.split("<script")[0] || section;

    expect(htmlPart).toContain("ROI");
    expect(htmlPart).toContain("Winrate");
    expect(htmlPart).not.toMatch(/\d+\s*€\s*par/i);
  });
});

describe("RC2.1 — Email financial coherence", () => {
  test("renewal email table header should not contain ANJ term 'Paris'", () => {
    const renewalBlock = apiSource.match(/function renewalEmailHtml[\s\S]*?^}/m);
    expect(renewalBlock).not.toBeNull();
    const block = renewalBlock[0];

    const tableHeaders = block.match(/<th[^>]*>([^<]*)<\/th>/g) || [];
    for (const th of tableHeaders) {
      const text = th.replace(/<[^>]*>/g, "");
      expect(text).not.toMatch(/\bParis\b/);
    }
  });

  test("renewal email should not use unit notation (e.g. +8u, -10u)", () => {
    const renewalBlock = apiSource.match(/function renewalEmailHtml[\s\S]*?^}/m);
    expect(renewalBlock).not.toBeNull();
    expect(renewalBlock[0]).not.toMatch(/[+-]\d+u\b/);
  });

  test("renewal email should not promise gains", () => {
    const renewalBlock = apiSource.match(/function renewalEmailHtml[\s\S]*?^}/m);
    expect(renewalBlock).not.toBeNull();
    const block = renewalBlock[0];

    expect(block).not.toMatch(/CE QUE TU AURAIS GAGNÉ/i);
    expect(block).toMatch(/Aucune garantie de gain|ne garantit pas/i);
  });

  test("renewal email simulation uses % not hardcoded euro amounts", () => {
    const renewalBlock = apiSource.match(/function renewalEmailHtml[\s\S]*?^}/m);
    expect(renewalBlock).not.toBeNull();
    const block = renewalBlock[0];

    expect(block).not.toMatch(/Sur \d+€ misés/i);
  });
});

describe("RC2.1 — ANJ extension checks (emails)", () => {
  test("no user-facing email contains the word 'pari' as ANJ term", () => {
    const emailBlocks = [];

    const welcomeMatch = apiSource.match(/Bienvenue.*TousLesMatchs[\s\S]*?<\/div>\s*`/g);
    if (welcomeMatch) emailBlocks.push(...welcomeMatch);

    const renewMatch = apiSource.match(/function renewalEmailHtml[\s\S]*?^}/m);
    if (renewMatch) emailBlocks.push(renewMatch[0]);

    const teaserMatch = apiSource.match(/teaser.*abonnement[\s\S]*?`\s*;/g);
    if (teaserMatch) emailBlocks.push(...teaserMatch);

    const allText = emailBlocks.join("\n");
    const pariMatches = allText.match(/\bpari(?:er|ez|ons|ent|é|ée|s)?\b/gi) || [];
    const real = pariMatches.filter(m =>
      !["Paris"].includes(m) &&
      !m.match(/Europe\/Paris/) &&
      !m.match(/ParionsSport/)
    );

    expect(real).toEqual([]);
  });
});
