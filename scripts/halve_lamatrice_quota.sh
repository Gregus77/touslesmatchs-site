#!/usr/bin/env bash
set -euo pipefail
docker exec -i touslesmatchs-api node - <<'NODE'
const Database=require("better-sqlite3");
const db=new Database("/data/codes.db");
const emails=['laùatrice2012@gmail.com','lamatrice2012@gmail.com'];
for (const email of emails) {
  db.prepare(`
    UPDATE codes
    SET credits_max = CASE
      WHEN credits_max IS NULL OR credits_max <= 1 THEN credits_max
      ELSE MAX(1, CAST(credits_max / 2 AS INTEGER))
    END
    WHERE lower(email)=lower(?)
  `).run(email);
}
db.close();
NODE
