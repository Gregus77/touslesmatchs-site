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
