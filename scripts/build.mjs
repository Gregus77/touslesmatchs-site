import { copyFile, mkdir, rm } from "node:fs/promises";

const files = [
  "index.html",
  "styles.css",
  "conditions-utilisation.html",
  "politique-confidentialite.html",
  "mentions-legales.html",
  "jeu-responsable.html"
];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

for (const file of files) {
  await copyFile(file, `dist/${file}`);
}

console.log(`Build OK: ${files.length} fichiers copiés dans dist/`);
