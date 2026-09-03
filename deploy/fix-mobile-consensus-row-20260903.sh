#!/usr/bin/env bash
set -euo pipefail

cd /opt/touslesmatchs
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup="/opt/backups/tlm-mobile-consensus-${stamp}"
mkdir -p "$backup"
chmod 700 "$backup"
cp -a public/index.html "$backup/index.html"

node <<'NODE'
const fs = require("fs");
const path = "public/index.html";
const source = fs.readFileSync(path, "utf8");
const before = ".tlm-ai-row{grid-template-columns:1fr}.tlm-ai-total{display:flex;align-items:baseline;justify-content:center;gap:8px}.tlm-ai-total strong{font-size:38px}.tlm-ai-vote i{width:34px;height:34px}";
const after = ".tlm-ai-row{grid-template-columns:minmax(0,1fr) auto;gap:8px}.tlm-ai-votes{gap:4px}.tlm-ai-vote{font-size:0}.tlm-ai-vote i{width:30px;height:30px;font-size:11px}.tlm-ai-total{min-width:82px;text-align:right}.tlm-ai-total strong{display:inline-block;font-size:34px;white-space:nowrap;word-break:normal}.tlm-ai-total span{display:none}.tlm-ai-result{max-width:82px;margin:6px 0 0 auto;line-height:1.25}";
if (source.includes(after)) {
  console.log("CSS mobile deja present");
} else {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error("ancre CSS mobile introuvable ou ambigue: " + count);
  fs.writeFileSync(path, source.replace(before, after));
  console.log("CSS mobile applique");
}
NODE

docker compose up -d --build site
sleep 3

docker compose ps site
proof="$(curl -fsSL --max-time 30 "https://www.touslesmatchs.com/?v=${stamp}")"
grep -Fq '.tlm-ai-row{grid-template-columns:minmax(0,1fr) auto;gap:8px}' <<<"$proof"
grep -Fq 'white-space:nowrap;word-break:normal' <<<"$proof"

echo "OK — affichage mobile 0 / 5 sur une seule ligne"
echo "Sauvegarde: $backup"
