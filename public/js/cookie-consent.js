(function () {
  // TousLesMatchs n'utilise aucun cookie tiers (auth par localStorage,
  // pas de session cookie) — cette bannière informe quand meme de la
  // collecte de donnees de navigation (pixel de suivi /api/t), par
  // transparence et conformite, meme quand aucun cookie n'est pose.
  if (localStorage.getItem("tlm_privacy_ack")) return;

  var bar = document.createElement("div");
  bar.id = "tlm-privacy-banner";
  bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:9500;"
    + "background:rgba(8,10,20,.97);backdrop-filter:blur(12px);"
    + "border-top:1px solid rgba(255,255,255,.1);padding:14px 20px;"
    + "display:flex;gap:16px;align-items:center;justify-content:center;flex-wrap:wrap;"
    + "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;"
    + "font-size:13px;color:#c8cce0;line-height:1.5";

  bar.innerHTML =
    '<span style="max-width:640px">🍪 Ce site utilise des données de navigation pour mesurer son audience et améliorer votre expérience. Aucun cookie publicitaire tiers. '
    + '<a href="/confidentialite" style="color:#818cf8;text-decoration:underline">En savoir plus</a></span>'
    + '<button id="tlm-privacy-ok" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:none;padding:9px 22px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap">J\'ai compris</button>';

  document.body.appendChild(bar);
  document.getElementById("tlm-privacy-ok").onclick = function () {
    localStorage.setItem("tlm_privacy_ack", "1");
    bar.remove();
  };
})();
