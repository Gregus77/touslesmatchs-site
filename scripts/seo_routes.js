// SEO routes module for TousLesMatchs
// Usage: require("./seo.js")(app, db);

module.exports = function(app, db) {

function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function slugify(h, a, d) {
  const hh = String(h).replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  const aa = String(a).replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return hh + "-vs-" + aa + "-" + d;
}

// ── Sitemap ──
app.get("/sitemap.xml", (req, res) => {
  try {
    const analyses = db.prepare(
      "SELECT DISTINCT lower(trim(home)) as home, lower(trim(away)) as away, " +
      "date(analysed_at) as d FROM concile_analyses " +
      "WHERE confidence >= 60 AND date(analysed_at) >= '2026-07-03' " +
      "ORDER BY analysed_at DESC"
    ).all();

    const comps = db.prepare(
      "SELECT competition FROM concile_analyses " +
      "WHERE confidence >= 60 AND competition IS NOT NULL AND competition != '' " +
      "GROUP BY competition ORDER BY COUNT(*) DESC"
    ).all();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += '  <url><loc>https://www.touslesmatchs.com/</loc><priority>1.0</priority></url>\n';
    xml += '  <url><loc>https://www.touslesmatchs.com/live-ia</loc><priority>0.9</priority></url>\n';
    xml += '  <url><loc>https://www.touslesmatchs.com/preuves</loc><priority>0.8</priority></url>\n';
    xml += '  <url><loc>https://www.touslesmatchs.com/historique</loc><priority>0.7</priority></url>\n';

    for (const a of analyses) {
      xml += '  <url><loc>https://www.touslesmatchs.com/api/seo/match/' + slugify(a.home, a.away, a.d) + '</loc><priority>0.6</priority></url>\n';
    }
    for (const c of comps) {
      const slug = String(c.competition).replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
      xml += '  <url><loc>https://www.touslesmatchs.com/api/seo/competition/' + slug + '</loc><priority>0.5</priority></url>\n';
    }
    xml += '</urlset>';

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch(e) {
    console.error("[sitemap] error:", e.message);
    res.status(500).type("text").send("Error");
  }
});

// ── Match page ──
app.get("/seo/match/:slug", (req, res) => {
  try {
    const slug = req.params.slug;
    const match = slug.match(/^(.+?)-vs-(.+?)-(\d{4}-\d{2}-\d{2})$/);
    if (!match) return res.redirect(301, "https://www.touslesmatchs.com/");

    const homeSlug = match[1].replace(/-/g, " ");
    const awaySlug = match[2].replace(/-/g, " ");
    const date = match[3];

    const analysis = db.prepare(
      "SELECT * FROM concile_analyses " +
      "WHERE lower(trim(home)) LIKE ? AND lower(trim(away)) LIKE ? " +
      "AND date(analysed_at) = ? ORDER BY analysed_at DESC LIMIT 1"
    ).get("%" + homeSlug + "%", "%" + awaySlug + "%", date);

    if (!analysis) return res.redirect(301, "https://www.touslesmatchs.com/");

    const outcomeLabel = analysis.outcome === "win" ? "GAGNE" : analysis.outcome === "loss" ? "PERDU" : "En attente";
    const score = (analysis.final_score_home != null && analysis.final_score_away != null)
      ? analysis.final_score_home + "-" + analysis.final_score_away : "—";
    const comp = analysis.competition || analysis.sport || "Football";
    const title = "Pronostic " + analysis.home + " vs " + analysis.away + " " + date + " - Analyse IA";
    const desc = "Analyse IA du match " + analysis.home + " vs " + analysis.away + " du " + date +
      ". Pronostic: " + (analysis.best_bet || "—") + ", confiance " + (analysis.confidence || "?") + "%, cote @" + (analysis.real_odd || "—") +
      ". Resultat: " + outcomeLabel + " " + score;

    res.send('<!DOCTYPE html><html lang="fr"><head>' +
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">' +
      '<title>' + esc(title) + '</title>' +
      '<meta name="description" content="' + esc(desc) + '">' +
      '<link rel="canonical" href="https://www.touslesmatchs.com/api/seo/match/' + esc(slug) + '">' +
      '<meta property="og:title" content="' + esc(title) + '">' +
      '<meta property="og:description" content="' + esc(desc) + '">' +
      '<meta property="og:type" content="article">' +
      '<meta name="robots" content="index,follow">' +
      '<script type="application/ld+json">' +
      JSON.stringify({"@context":"https://schema.org","@type":"SportsEvent","name":analysis.home + " vs " + analysis.away,"startDate":date,"sport":comp,"description":desc,"competitor":[{"@type":"SportsTeam","name":analysis.home},{"@type":"SportsTeam","name":analysis.away}]}) +
      '</script>' +
      '<style>body{font-family:Inter,Arial,sans-serif;background:#06080f;color:#eceaf4;margin:0;padding:20px;max-width:800px;margin:0 auto;line-height:1.6}a{color:#6366f1}h1{font-size:28px;font-weight:900;margin-bottom:8px}.meta{color:#7b82a0;font-size:13px;margin-bottom:24px}.card{background:#0d1020;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:24px;margin-bottom:16px}.label{font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#6366f1;margin-bottom:4px}.value{font-size:18px;font-weight:700}.verdict{font-size:24px;font-weight:900;text-align:center}.win{color:#10b981}.loss{color:#f43f5e}.btn{display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:24px}.footer{text-align:center;color:#7b82a0;font-size:12px;margin-top:40px;padding-bottom:40px}</style></head><body>' +
      '<h1>' + esc(analysis.home) + ' vs ' + esc(analysis.away) + '</h1>' +
      '<div class="meta">' + esc(comp) + ' — ' + date + ' ' + outcomeLabel + ' ' + score + '</div>' +
      '<div class="card"><div class="label">Pronostic du Concile</div><div class="value">' + esc(analysis.best_bet || "—") + '</div></div>' +
      '<div class="card"><div class="label">Confiance</div><div class="value">' + (analysis.confidence || "?") + '%</div></div>' +
      '<div class="card"><div class="label">Cote</div><div class="value">@' + (analysis.real_odd || "—") + '</div></div>' +
      (analysis.raison ? '<div class="card"><div class="label">Analyse du Concile</div><div class="value" style="font-size:14px;font-weight:400;color:#a8aec8">' + esc(analysis.raison) + '</div></div>' : '') +
      '<div class="card" style="text-align:center"><div class="label">Verdict</div><div class="verdict ' + (analysis.outcome === "win" ? "win" : analysis.outcome === "loss" ? "loss" : "pending") + '">' + outcomeLabel + '</div></div>' +
      '<div style="text-align:center"><a href="https://www.touslesmatchs.com/" class="btn">Voir le pick du jour</a></div>' +
      '<div class="footer"><p>Analyse generee par le Concile Hermes (5 IA + 1 Chief)</p><p><a href="https://www.touslesmatchs.com/">TousLesMatchs.com</a> — Pronostics sportifs IA</p></div>' +
      '</body></html>');
  } catch(e) {
    console.error("[match] error:", e.message);
    res.redirect(301, "https://www.touslesmatchs.com/");
  }
});

// ── Competition page ──
app.get("/seo/competition/:slug", (req, res) => {
  try {
    const slug = req.params.slug.replace(/-/g, " ");
    const analyses = db.prepare(
      "SELECT * FROM concile_analyses WHERE competition LIKE ? " +
      "AND confidence >= 60 ORDER BY analysed_at DESC LIMIT 50"
    ).all("%" + slug + "%");

    if (analyses.length === 0) return res.redirect(301, "https://www.touslesmatchs.com/");

    const comp = analyses[0].competition || analyses[0].sport || slug;
    const wins = analyses.filter(a => a.outcome === "win").length;
    const losses = analyses.filter(a => a.outcome === "loss").length;
    const wr = (wins + losses) > 0 ? Math.round(wins / (wins + losses) * 100) : 0;
    const title = "Pronostics " + comp + " - Analyses IA TousLesMatchs";
    const desc = "Pronostics IA pour " + comp + ". " + wins + " gains, " + losses + " pertes, " + wr + "% winrate.";

    let rows = "";
    for (const a of analyses) {
      const outcomeLabel = a.outcome === "win" ? "GAGNE" : a.outcome === "loss" ? "PERDU" : "En attente";
      rows += '<div class="card"><div class="label">' + esc(a.analysed_at ? a.analysed_at.slice(0,10) : "") + '</div>' +
        '<div class="value">' + esc(a.home) + ' vs ' + esc(a.away) + ' — ' + outcomeLabel + ' ' + esc(a.best_bet || "") + '</div></div>';
    }

    res.send('<!DOCTYPE html><html lang="fr"><head>' +
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">' +
      '<title>' + esc(title) + '</title>' +
      '<meta name="description" content="' + esc(desc) + '">' +
      '<meta name="robots" content="index,follow">' +
      '<style>body{font-family:Inter,Arial,sans-serif;background:#06080f;color:#eceaf4;margin:0;padding:20px;max-width:800px;margin:0 auto;line-height:1.6}a{color:#6366f1}h1{font-size:28px;font-weight:900;margin-bottom:8px}.meta{color:#7b82a0;font-size:13px;margin-bottom:24px}.card{background:#0d1020;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;margin-bottom:12px}.label{font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#6366f1;margin-bottom:4px}.value{font-size:16px;font-weight:600}.btn{display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:20px}.footer{text-align:center;color:#7b82a0;font-size:12px;margin-top:40px;padding-bottom:40px}</style></head><body>' +
      '<h1>' + esc(comp) + '</h1>' +
      '<div class="meta">' + wins + 'W / ' + losses + 'L — ' + wr + '% winrate</div>' +
      rows +
      '<div style="text-align:center"><a href="https://www.touslesmatchs.com/" class="btn">Voir le pick du jour</a></div>' +
      '<div class="footer"><a href="https://www.touslesmatchs.com/">TousLesMatchs.com</a> — Pronostics sportifs IA</div>' +
      '</body></html>');
  } catch(e) {
    console.error("[competition] error:", e.message);
    res.redirect(301, "https://www.touslesmatchs.com/");
  }
});

console.log("[seo] Routes loaded: sitemap.xml, /seo/match/:slug, /seo/competition/:slug");
};