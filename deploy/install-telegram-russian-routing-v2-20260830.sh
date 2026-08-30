#!/usr/bin/env bash
set -euo pipefail

cd /opt/touslesmatchs
BACKUP="/opt/backups/tlm-telegram-ru-routing-$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$BACKUP"
cp -a .env docker-compose.yml scripts/api_server.js "$BACKUP/"

rollback() {
  echo "ERREUR — restauration automatique"
  cp -a "$BACKUP/.env" .env
  cp -a "$BACKUP/docker-compose.yml" docker-compose.yml
  cp -a "$BACKUP/api_server.js" scripts/api_server.js
  docker compose build api
  docker compose up -d --no-deps --force-recreate api
}
trap rollback ERR

python3 - <<'PY'
from pathlib import Path
import re

env_path = Path(".env")
env = env_path.read_text(encoding="utf-8")
values = {
    "TELEGRAM_RU_FREE_CHANNEL_ID": "-1003885393321",
    "TELEGRAM_RU_STANDARD_CHANNEL_ID": "-1004383282677",
    "TELEGRAM_RU_PREMIUM_CHANNEL_ID": "-1004373972665",
}
for key, value in values.items():
    pattern = rf"(?m)^{re.escape(key)}=.*$"
    if re.search(pattern, env):
        env = re.sub(pattern, f"{key}={value}", env)
    else:
        env = env.rstrip() + f"\n{key}={value}\n"
env_path.write_text(env, encoding="utf-8")

compose_path = Path("docker-compose.yml")
compose = compose_path.read_text(encoding="utf-8")
api, sep, rest = compose.partition("\n  council:")
if not sep:
    raise SystemExit("BLOQUE: section council introuvable")
anchor = "      - TELEGRAM_PREMIUM_CHANNEL_ID=${TELEGRAM_PREMIUM_CHANNEL_ID}\n"
if anchor not in api:
    raise SystemExit("BLOQUE: ancre Telegram API introuvable")
ru_lines = [
    "      - TELEGRAM_RU_FREE_CHANNEL_ID=${TELEGRAM_RU_FREE_CHANNEL_ID}",
    "      - TELEGRAM_RU_STANDARD_CHANNEL_ID=${TELEGRAM_RU_STANDARD_CHANNEL_ID}",
    "      - TELEGRAM_RU_PREMIUM_CHANNEL_ID=${TELEGRAM_RU_PREMIUM_CHANNEL_ID}",
]
for line in ru_lines:
    api = api.replace(line + "\n", "")
api = api.replace(anchor, anchor + "\n".join(ru_lines) + "\n", 1)
compose_path.write_text(api + sep + rest, encoding="utf-8")

server_path = Path("scripts/api_server.js")
server = server_path.read_text(encoding="utf-8")

ru_const_block = '''const TELEGRAM_RU_FREE_CHANNEL_ID = process.env.TELEGRAM_RU_FREE_CHANNEL_ID || "";
const TELEGRAM_RU_STANDARD_CHANNEL_ID = process.env.TELEGRAM_RU_STANDARD_CHANNEL_ID || "";
const TELEGRAM_RU_PREMIUM_CHANNEL_ID = process.env.TELEGRAM_RU_PREMIUM_CHANNEL_ID || "";
'''
if "const TELEGRAM_RU_FREE_CHANNEL_ID =" not in server:
    marker = re.search(r"(?m)^const TELEGRAM_GOAL05_INVITE_URL\b", server)
    if not marker:
        marker = re.search(r"(?m)^const TELEGRAM_ADMIN_CHAT_ID\b", server)
    if not marker:
        raise SystemExit("BLOQUE: emplacement constantes Telegram introuvable")
    server = server[:marker.start()] + ru_const_block + server[marker.start():]

old_signature = "function sendTelegramMessage(chatId, text, deliveryMeta = null) {"
new_helper = r'''// Miroir client russe : seuls les trois canaux CLIENTS francais sont recopies.
// Hermès/Admin/Support ne figurent volontairement pas dans cette table.
function russianClientChannelFor(frenchChatId) {
  const source = String(frenchChatId || "");
  if (source === String(TELEGRAM_CHANNEL_ID || "") ||
      source === String(process.env.TELEGRAM_FREE_CHANNEL_ID || "")) {
    return { id: TELEGRAM_RU_FREE_CHANNEL_ID, tier: "free" };
  }
  if (source === String(TELEGRAM_STANDARD_CHANNEL_ID || "")) {
    return { id: TELEGRAM_RU_STANDARD_CHANNEL_ID, tier: "standard" };
  }
  if (source === String(TELEGRAM_PREMIUM_CHANNEL_ID || "")) {
    return { id: TELEGRAM_RU_PREMIUM_CHANNEL_ID, tier: "premium" };
  }
  return null;
}

// Traduction deterministe des gabarits Telegram. Les equipes, scores, minutes,
// cotes et noms de competitions restent strictement identiques.
function translateTelegramClientRu(input) {
  let text = String(input || "");
  const replacements = [
    [/SIGNAL CONSEIL IA DÉTECTÉ/gi, "СИГНАЛ ИИ ОБНАРУЖЕН"],
    [/SIGNAL CONSEIL IA/gi, "СИГНАЛ ИИ"],
    [/SIGNAL FORT GAGNÉ/gi, "СИЛЬНЫЙ СИГНАЛ — ВЫИГРЫШ"],
    [/SIGNAL FORT PERDU/gi, "СИЛЬНЫЙ СИГНАЛ — ПРОИГРЫШ"],
    [/STRONG SIGNAL WON/gi, "СИЛЬНЫЙ СИГНАЛ — ВЫИГРЫШ"],
    [/STRONG SIGNAL LOST/gi, "СИЛЬНЫЙ СИГНАЛ — ПРОИГРЫШ"],
    [/every result stays public, wins and losses alike/gi, "все результаты публикуются: и выигрыши, и проигрыши"],
    [/BILAN DU JOUR/gi, "ИТОГИ ДНЯ"],
    [/Signaux réellement diffusés/gi, "Реально отправленные сигналы"],
    [/Score final/gi, "Итоговый счёт"],
    [/Score de confiance/gi, "Уровень доверия"],
    [/Vote IA/gi, "Голосование ИИ"],
    [/Résultat vérifiable demain sur le site/gi, "Результат можно проверить завтра на сайте"],
    [/Résultats complets : gagnés comme perdus/gi, "Полные результаты: выигрыши и проигрыши"],
    [/La sélection exacte et la raison sont réservées aux membres/gi, "Точный прогноз и обоснование доступны только подписчикам"],
    [/Imagine si tu avais eu le pick en direct/gi, "Представьте, если бы вы получили прогноз в прямом эфире"],
    [/Recevoir tous les signaux dès 4,90€/gi, "Получать все сигналы от 4,90 €"],
    [/La discipline fait la différence sur le long terme/gi, "Дисциплина приносит результат на дистанции"],
    [/Jeu responsable/gi, "Ответственная игра"],
    [/Responsible gaming/gi, "Ответственная игра"],
    [/Conseil IA/gi, "Совет ИИ"],
    [/Championnat/gi, "Чемпионат"],
    [/Gagnés/gi, "Выиграно"],
    [/Perdus/gi, "Проиграно"],
    [/Réussite/gi, "Успешность"],
    [/gagnés sur/gi, "выигрышей из"],
    [/Mise 10€/gi, "Ставка 10 €"],
    [/Gain/gi, "Выплата"],
    [/Cote/gi, "Коэффициент"],
    [/Under 2[.,]5 buts/gi, "Тотал меньше 2,5 голов"],
    [/Over 2[.,]5 buts/gi, "Тотал больше 2,5 голов"],
    [/Under 2\.5 goals/gi, "Тотал меньше 2,5 голов"],
    [/Over 2\.5 goals/gi, "Тотал больше 2,5 голов"],
    [/unanime/gi, "единогласно"],
    [/Score :/gi, "Счёт:"],
    [/minute/gi, "минута"],
  ];
  for (const [pattern, value] of replacements) text = text.replace(pattern, value);
  return text;
}

function sendTelegramMessage(chatId, text, deliveryMeta = null, skipRussianMirror = false) {'''
if "function russianClientChannelFor(" not in server:
    if old_signature not in server:
        raise SystemExit("BLOQUE: fonction sendTelegramMessage introuvable")
    server = server.replace(old_signature, new_helper, 1)

start = server.find("function sendTelegramMessage(")
end = server.find("// Génère un lien d'invitation Telegram", start)
if start < 0 or end < 0:
    raise SystemExit("BLOQUE: limites fonction Telegram introuvables")
segment = server[start:end]
old_resolve = "          resolve(parsed.ok === true);"
mirror_block = '''          if (parsed.ok === true && !skipRussianMirror) {
            const ruTarget = russianClientChannelFor(chatId);
            if (ruTarget && ruTarget.id) {
              const ruText = translateTelegramClientRu(text);
              setImmediate(() => {
                sendTelegramMessage(ruTarget.id, ruText, null, true)
                  .then(ok => console.log(`[telegram-ru] ${ruTarget.tier} chat_id=${ruTarget.id}: ${ok ? "OK" : "FAIL"}`))
                  .catch(e => console.error(`[telegram-ru] ${ruTarget.tier}: ${e.message}`));
              });
            }
          }
          resolve(parsed.ok === true);'''
if "[telegram-ru]" not in segment:
    if segment.count(old_resolve) != 1:
        raise SystemExit(f"BLOQUE: point miroir ambigu ({segment.count(old_resolve)})")
    segment = segment.replace(old_resolve, mirror_block, 1)
    server = server[:start] + segment + server[end:]

server_path.write_text(server, encoding="utf-8")
PY

node --check scripts/api_server.js
docker compose config --quiet
docker compose build api
docker compose up -d --no-deps --force-recreate api
sleep 20

docker exec touslesmatchs-api node --check /app/server.js
docker exec touslesmatchs-api grep -q "\[telegram-ru\]" /app/server.js
curl -fsS https://www.touslesmatchs.com/api/health >/tmp/tlm-health-ru.json
python3 - <<'PY'
import json
with open("/tmp/tlm-health-ru.json", encoding="utf-8") as f:
    data=json.load(f)
assert data.get("ok") is True, data
assert data.get("integrations",{}).get("telegram",{}).get("ok") is True, data
print("API=OK TELEGRAM_FR=OK")
PY

docker exec -i touslesmatchs-api node <<'NODE'
const https = require("https");
const token = process.env.TELEGRAM_BOT_TOKEN;
const channels = {
  GRATUIT_RU: process.env.TELEGRAM_RU_FREE_CHANNEL_ID,
  STANDARD_RU: process.env.TELEGRAM_RU_STANDARD_CHANNEL_ID,
  PREMIUM_RU: process.env.TELEGRAM_RU_PREMIUM_CHANNEL_ID
};
const message = "✅ ТЕХНИЧЕСКАЯ ПРОВЕРКА TousLesMatchs\nРусский канал подключён. Прогноз не публикуется.\n⚠️ 18+ · Ответственная игра";

function send(id) {
  return new Promise(resolve => {
    const body = JSON.stringify({
      chat_id: id,
      text: message,
      disable_web_page_preview: true
    });
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${token}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      },
      timeout: 15000
    }, response => {
      let data = "";
      response.on("data", chunk => data += chunk);
      response.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (_) { resolve({ok:false}); }
      });
    });
    req.on("error", () => resolve({ok:false}));
    req.on("timeout", () => { req.destroy(); resolve({ok:false}); });
    req.write(body);
    req.end();
  });
}

(async () => {
  let ok = 0;
  for (const [name,id] of Object.entries(channels)) {
    const result = await send(id);
    console.log(`TEST_${name}=${result.ok ? "OK" : "ECHEC"}`);
    if (result.ok) ok++;
  }
  if (ok !== 3) process.exit(1);
  console.log("TESTS_RUSSES=3/3");
})();
NODE

trap - ERR
echo "ROUTAGE_FR=INCHANGE"
echo "ROUTAGE_RU=ACTIF"
echo "HERMES_ADMIN=NON_REPLIQUE"
echo "VERDICT=OK"
echo "SAUVEGARDE=$BACKUP"
