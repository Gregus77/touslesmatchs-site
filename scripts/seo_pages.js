// ── Pages SEO dynamiques (pronostics) ────────────────────────────────────────
// Module isolé : ne touche pas la base directement. api_server.js prépare les
// données (cote via rowOdd, raison masquée) et appelle ces fonctions de rendu.
// Objectif : capter le trafic Google long-tail ("pronostic <équipe> <équipe>")
// avec des pages riches, uniques et conformes ANJ (pas de "pari", disclaimer,
// aucune garantie de gain).

const SITE = "https://www.touslesmatchs.com";

function escapeHtml(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function slugify(str) {
  return String(str || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Slug déterministe : équipes + date (unique par match/jour).
function matchSlug(item) {
  const d = (item.date || "").slice(0, 10);
  return `${slugify(item.home)}-${slugify(item.away)}${d ? "-" + d : ""}`;
}

function fmtDateFr(iso) {
  if (!iso) return "";
  const parts = String(iso).slice(0, 10).split("-");
  if (parts.length !== 3) return iso;
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
    "août", "septembre", "octobre", "novembre", "décembre"];
  return `${parseInt(parts[2], 10)} ${mois[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
}

// Coquille HTML commune (thème sombre, accent violet, responsive, meta SEO).
function shell({ title, description, canonical, bodyHtml, schema }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:site_name" content="TousLesMatchs">
<meta name="twitter:card" content="summary">
<meta name="robots" content="index,follow">
<link rel="icon" href="/favicon.ico">
${schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : ""}
<style>
  :root{--bg:#06080f;--bg2:#0d1020;--text:#eceaf4;--muted:#7b82a0;--muted2:#a8aec8;--violet:#a78bfa;--green:#34d399;--cyan:#22d3ee;--b1:rgba(255,255,255,.06);--b2:rgba(129,140,248,.18)}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:Inter,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
  a{color:var(--violet);text-decoration:none}
  a:hover{text-decoration:underline}
  .wrap{max-width:820px;margin:0 auto;padding:28px 20px 60px}
  .topnav{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-bottom:1px solid var(--b1);position:sticky;top:0;background:rgba(6,8,15,.9);backdrop-filter:blur(10px);z-index:5}
  .brand{font-weight:900;letter-spacing:-.02em;color:var(--text)}
  .topnav a.cta{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:8px 16px;border-radius:9px;font-size:13px;font-weight:700}
  .bc{font-size:12px;color:var(--muted);margin-bottom:18px}
  h1{font-size:clamp(24px,4vw,34px);font-weight:900;letter-spacing:-.03em;line-height:1.15;margin-bottom:10px}
  h2{font-size:20px;font-weight:800;margin:28px 0 12px;letter-spacing:-.02em}
  .sub{color:var(--muted2);font-size:15px;margin-bottom:22px}
  .card{background:linear-gradient(160deg,rgba(30,27,58,.5),rgba(15,14,30,.6));border:1px solid var(--b2);border-radius:16px;padding:22px;margin-bottom:20px}
  .verdict{display:flex;flex-wrap:wrap;gap:18px;align-items:center}
  .verdict .big{font-size:22px;font-weight:900;color:#fff}
  .pill{display:inline-flex;align-items:baseline;gap:5px}
  .pill b{font-size:22px;font-weight:900}
  .pill.g b{color:var(--green)}.pill.c b{color:var(--cyan)}
  .pill span{font-size:12px;color:var(--muted2)}
  .meta-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
  .tag{font-size:12px;font-weight:700;padding:5px 11px;border-radius:8px;background:rgba(129,140,248,.12);color:var(--violet);border:1px solid var(--b2)}
  .tag.win{background:rgba(16,185,129,.12);color:var(--green);border-color:rgba(16,185,129,.3)}
  .tag.loss{background:rgba(244,63,94,.1);color:#fb7185;border-color:rgba(244,63,94,.25)}
  p{margin-bottom:14px;color:var(--muted2)}
  .list a{display:flex;justify-content:space-between;gap:12px;padding:13px 15px;border:1px solid var(--b1);border-radius:12px;margin-bottom:9px;color:var(--text)}
  .list a:hover{border-color:var(--b2);text-decoration:none;background:rgba(129,140,248,.05)}
  .list .l-match{font-weight:700;font-size:14px}
  .list .l-meta{font-size:12px;color:var(--muted)}
  .disclaimer{margin-top:32px;padding-top:20px;border-top:1px solid var(--b1);font-size:11px;color:var(--muted);line-height:1.7}
  .footlinks{margin-top:18px;font-size:12px}
  .footlinks a{margin-right:14px;color:var(--muted2)}
</style>
</head>
<body>
<nav class="topnav">
  <a href="/" class="brand">TousLesMatchs</a>
  <a href="/#plans" class="cta">Voir les abonnements</a>
</nav>
<div class="wrap">
${bodyHtml}
  <div class="disclaimer">
    Analyses sportives assistées par IA à but informatif. TousLesMatchs ne garantit aucun gain.
    Les jeux d'argent et de hasard peuvent être dangereux : pertes d'argent, conflits familiaux, addiction.
    18+ · Interdit aux mineurs. Conseils et aide sur <a href="https://www.joueurs-info-service.fr" rel="nofollow">joueurs-info-service.fr</a> — 09 74 75 13 13 (appel non surtaxé).
  </div>
  <div class="footlinks">
    <a href="/">Accueil</a><a href="/pronostics">Tous les pronostics</a><a href="/live-ia">Live IA</a><a href="/performances">Performances</a><a href="/faq">FAQ</a>
  </div>
</div>
</body>
</html>`;
}

// ── Page détail : /pronostic/:slug ───────────────────────────────────────────
function renderDetail(item, related) {
  const dateFr = fmtDateFr(item.date);
  const resolved = item.outcome === "win" || item.outcome === "loss";
  const title = `Pronostic ${item.home} - ${item.away}${item.competition ? " (" + item.competition + ")" : ""} | Analyse IA`;
  const description = `Analyse IA de ${item.home} contre ${item.away}${dateFr ? " du " + dateFr : ""} : verdict du Conseil (${item.bet}), niveau de confiance ${item.confidence}% et cote. Le Concile de 5 IA décrypte le match.`;
  const canonical = `${SITE}/pronostic/${matchSlug(item)}`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${item.home} - ${item.away}`,
    sport: item.sport || "Soccer",
    startDate: (item.date || "").slice(0, 10) || undefined,
    homeTeam: { "@type": "SportsTeam", name: item.home },
    awayTeam: { "@type": "SportsTeam", name: item.away },
    description,
    url: canonical,
  };

  const outcomeTag = resolved
    ? `<span class="tag ${item.outcome === "win" ? "win" : "loss"}">${item.outcome === "win" ? "✅ Analyse gagnante" : "❌ Analyse perdue"}</span>`
    : `<span class="tag">🔴 Analyse publiée</span>`;

  const relatedHtml = (related || []).length
    ? `<h2>Autres analyses du Conseil</h2>
       <div class="list">${related.map(r =>
        `<a href="/pronostic/${matchSlug(r)}"><span class="l-match">${escapeHtml(r.home)} - ${escapeHtml(r.away)}</span><span class="l-meta">${escapeHtml(r.competition || "")}</span></a>`
      ).join("")}</div>`
    : "";

  const body = `
  <div class="bc"><a href="/pronostics">Pronostics</a> › ${escapeHtml(item.home)} - ${escapeHtml(item.away)}</div>
  <h1>${escapeHtml(item.home)} - ${escapeHtml(item.away)} : le pronostic du Conseil IA</h1>
  <div class="sub">${item.competition ? escapeHtml(item.competition) + " · " : ""}${dateFr ? "Match du " + escapeHtml(dateFr) : ""}</div>
  <div class="meta-row">
    ${outcomeTag}
    <span class="tag">🧠 5 IA indépendantes</span>
    ${item.sport ? `<span class="tag">${escapeHtml(item.sport)}</span>` : ""}
  </div>
  <div class="card">
    <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--violet);margin-bottom:8px">🔥 Verdict du Conseil</div>
    <div class="verdict">
      <div class="big">${escapeHtml(item.bet || "Analyse IA")}</div>
      <div class="pill g"><b>${item.confidence || ""}%</b><span>de confiance</span></div>
      ${item.cote ? `<div class="pill c"><b>${item.cote}</b><span>cote</span></div>` : ""}
    </div>
  </div>
  <h2>L'analyse en détail</h2>
  <p>${item.reasoning ? escapeHtml(item.reasoning) : `Pour ${escapeHtml(item.home)} contre ${escapeHtml(item.away)}, le Concile a croisé le classement, la forme récente, les confrontations directes et la valeur du marché. Perplexity, DeepSeek, Mistral, Cohere et Qwen ont voté séparément avant que le Concile ne tranche.`}</p>
  <p>Chaque analyse repose sur le vote de 5 IA indépendantes : là où un seul avis peut se tromper, la confrontation des modèles fait ressortir les désaccords et sécurise la décision. Le verdict n'est publié que lorsque la confiance dépasse notre seuil de qualité.</p>
  <h2>Comment fonctionne le Conseil IA ?</h2>
  <p>Hermès collecte les données vérifiées du match, 5 IA analysent stats, forme et valeur, puis le Concile arbitre les désaccords. Si les signaux sont contradictoires, c'est NO BET. <a href="/#methode">Voir la méthode complète →</a></p>
  <div class="card" style="text-align:center">
    <div style="font-weight:800;margin-bottom:8px">Envie de l'analyse complète en direct ?</div>
    <p style="margin-bottom:14px">Rejoins le Concile et suis les matchs en direct.</p>
    <a href="/#plans" style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#fff;padding:13px 30px;border-radius:11px;font-weight:800">Voir les abonnements</a>
  </div>
  ${relatedHtml}
  `;

  return shell({ title, description, canonical, bodyHtml: body, schema });
}

// ── Page index : /pronostics ─────────────────────────────────────────────────
function renderIndex(items) {
  const title = "Pronostics football & sports — Analyses IA | TousLesMatchs";
  const description = "Tous les pronostics du Conseil IA : analyses de matchs football, basket, tennis et plus. Verdict de 5 intelligences artificielles, confiance et historique public.";
  const canonical = `${SITE}/pronostics`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonical,
  };

  const rows = (items || []).map(it => {
    const resolved = it.outcome === "win" || it.outcome === "loss";
    const badge = resolved ? (it.outcome === "win" ? "✅" : "❌") : "🔴";
    return `<a href="/pronostic/${matchSlug(it)}">
      <span class="l-match">${badge} ${escapeHtml(it.home)} - ${escapeHtml(it.away)}</span>
      <span class="l-meta">${escapeHtml(it.competition || it.sport || "")}${it.confidence ? " · " + it.confidence + "%" : ""}</span>
    </a>`;
  }).join("");

  const body = `
  <div class="bc"><a href="/">Accueil</a> › Pronostics</div>
  <h1>Pronostics & analyses IA</h1>
  <p class="sub">Chaque match est analysé par le Conseil : 5 intelligences artificielles votent, la convergence tranche. Historique 100 % public — gagnés comme perdus.</p>
  <div class="list">${rows || "<p>Aucune analyse publiée pour le moment.</p>"}</div>
  `;

  return shell({ title, description, canonical, bodyHtml: body, schema });
}

// ── Sitemap dynamique des pronostics ─────────────────────────────────────────
function renderSitemap(items) {
  const urls = [`${SITE}/pronostics`]
    .concat((items || []).map(it => `${SITE}/pronostic/${matchSlug(it)}`));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;
}

module.exports = { slugify, matchSlug, renderDetail, renderIndex, renderSitemap };
