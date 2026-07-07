const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");

describe("Frontend integrity", () => {
  test("public/index.html exists", () => {
    expect(fs.existsSync(path.join(ROOT, "public/index.html"))).toBe(true);
  });

  test("public/live-ia.html exists", () => {
    expect(fs.existsSync(path.join(ROOT, "public/live-ia.html"))).toBe(true);
  });

  test("public/template.html exists for council", () => {
    expect(fs.existsSync(path.join(ROOT, "public/template.html"))).toBe(true);
  });

  test("docker-compose.yml mounts public/ not site/", () => {
    const dc = fs.readFileSync(path.join(ROOT, "docker-compose.yml"), "utf8");
    expect(dc).not.toContain("/opt/touslesmatchs/site:/srv");
    expect(dc).toContain("/opt/touslesmatchs/public:/srv");
  });

  test("no buy.stripe.com in public/index.html", () => {
    const html = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");
    expect(html).not.toContain("buy.stripe.com");
  });

  test("no buy.stripe.com in public/live-ia.html", () => {
    const html = fs.readFileSync(path.join(ROOT, "public/live-ia.html"), "utf8");
    expect(html).not.toContain("buy.stripe.com");
  });

  test("startCheckout() present in public/index.html", () => {
    const html = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");
    expect(html).toContain("startCheckout");
  });

  test("council Dockerfile copies template.html", () => {
    const df = fs.readFileSync(path.join(ROOT, "council/Dockerfile"), "utf8");
    expect(df).toContain("COPY public/template.html /app/site/template.html");
  });
});

describe("Deployment manifest and signature", () => {
  test("DEPLOYMENT_MANIFEST.json exists and is valid JSON", () => {
    const fp = path.join(ROOT, "DEPLOYMENT_MANIFEST.json");
    expect(fs.existsSync(fp)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(fp, "utf8"));
    expect(manifest.frontend.directory).toBe("public");
    expect(manifest.frontend.entry_file).toBe("index.html");
    expect(manifest.checks.forbidden_volume).toContain("site:/srv");
    expect(manifest.checks.required_volume).toContain("public:/srv");
  });

  test("FRONTEND_SIGNATURE.json exists and is valid JSON", () => {
    const fp = path.join(ROOT, "FRONTEND_SIGNATURE.json");
    expect(fs.existsSync(fp)).toBe(true);
    const sig = JSON.parse(fs.readFileSync(fp, "utf8"));
    expect(sig.frontend_dir).toBe("public");
    expect(sig.files["index.html"]).toBeDefined();
    expect(sig.files["live-ia.html"]).toBeDefined();
    expect(sig.docker_volume).toContain("public:/srv");
  });

  test("FRONTEND_SIGNATURE files match actual frontend files", () => {
    const sig = JSON.parse(fs.readFileSync(path.join(ROOT, "FRONTEND_SIGNATURE.json"), "utf8"));
    for (const file of Object.keys(sig.files)) {
      expect(fs.existsSync(path.join(ROOT, sig.frontend_dir, file))).toBe(true);
    }
  });

  test("required env vars in docker-compose.yml", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "DEPLOYMENT_MANIFEST.json"), "utf8"));
    const dc = fs.readFileSync(path.join(ROOT, "docker-compose.yml"), "utf8");
    for (const v of manifest.checks.required_env_vars) {
      expect(dc).toContain(v);
    }
  });

  test("frontend title matches manifest expectations", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "DEPLOYMENT_MANIFEST.json"), "utf8"));
    const html = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");
    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    expect(titleMatch).not.toBeNull();
    const title = titleMatch[1].toLowerCase();
    expect(title).toContain(manifest.checks.frontend_title_must_contain.toLowerCase());
    expect(title).not.toContain(manifest.checks.frontend_title_must_not_contain.toLowerCase());
  });
});
