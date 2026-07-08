const fs = require("fs");
const path = require("path");

const COUNCIL_DIR = path.resolve(__dirname, "../../council");
const HTML_GEN = path.resolve(COUNCIL_DIR, "tools/html_generator.py");

describe("public/index.html protection — incident 08/07/2026", () => {
  test("html_generator.py must NOT write to index.html", () => {
    const content = fs.readFileSync(HTML_GEN, "utf8");
    const pathLine = content.match(/^SITE_HTML_PATH\s*=.*$/m);
    expect(pathLine).not.toBeNull();
    expect(pathLine[0]).not.toContain("index.html");
    expect(pathLine[0]).toContain("pick.html");
  });

  test("html_generator.py SITE_HTML_PATH default is pick.html", () => {
    const content = fs.readFileSync(HTML_GEN, "utf8");
    const match = content.match(/SITE_HTML_PATH.*?["']([^"']+)["']\s*\)/);
    expect(match).not.toBeNull();
    expect(match[1]).toBe("/app/site/pick.html");
  });

  test("no council Python file opens index.html for writing", () => {
    const pyFiles = [];
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".py")) pyFiles.push(full);
      }
    }
    walk(COUNCIL_DIR);

    for (const pyFile of pyFiles) {
      const content = fs.readFileSync(pyFile, "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trimStart().startsWith("#")) continue;
        const writesToIndex =
          line.includes("index.html") &&
          (line.includes("open(") || line.includes("write")) &&
          !line.includes("read") &&
          !line.includes("# ");
        if (writesToIndex) {
          fail(
            `${path.relative(COUNCIL_DIR, pyFile)}:${i + 1} writes to index.html: ${line.trim()}`
          );
        }
      }
    }
  });

  test("docker-compose council volume must NOT map directly to index.html", () => {
    const compose = fs.readFileSync(
      path.resolve(__dirname, "../../docker-compose.yml"),
      "utf8"
    );
    expect(compose).not.toContain("public/index.html:/app/site/index.html");
  });

  test("SITE_HTML_PATH env var is not set to index.html in docker-compose", () => {
    const compose = fs.readFileSync(
      path.resolve(__dirname, "../../docker-compose.yml"),
      "utf8"
    );
    expect(compose).not.toMatch(/SITE_HTML_PATH.*index\.html/);
  });
});
