/* ══════════════════════════════════════════════════════════════════════════
   FloatingWidgets — composant global unique de TousLesMatchs
   Chargé UNE SEULE FOIS par page via <script src="/js/widgets.js" defer></script>.
   Rend UN SEUL conteneur position:fixed (bas-droite), en flex column :
        💬 Chatbot   (au-dessus)
        TikTok       (dessous)
        Telegram     (en dessous)
   Aucun chevauchement possible : un seul élément fixe, le reste en flux flex.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.__tlmWidgetsLoaded) return;      // jamais deux fois
  window.__tlmWidgetsLoaded = true;

  var TIKTOK = "https://www.tiktok.com/@touslesmatchs.com?_r=1&_t=ZN-97SfTPDm8jW&utm_source=touslesmatchs_site&utm_medium=widget";
  var TELEGRAM = "https://t.me/+qFnIuKg2ZhdlMmY8";

  // ── Styles (injectés une fois) ─────────────────────────────────────────────
  var css = `
  #tlm-widgets{position:fixed;right:18px;bottom:18px;z-index:9000;display:flex;flex-direction:column;align-items:flex-end;gap:14px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
  #tlm-widgets .tlm-fab{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.35);border:none;text-decoration:none;transition:transform .15s;font-size:24px}
  #tlm-widgets .tlm-fab:hover{transform:translateY(-3px)}
  #tlm-widgets .tlm-chatbtn{background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;order:1}
  #tlm-widgets .tlm-tiktok{background:#111;color:#fff;order:2}
  #tlm-widgets .tlm-telegram{background:linear-gradient(135deg,#2aabee,#229ed9);color:#fff;order:3}
  #tlm-widgets .tlm-tiktok svg,#tlm-widgets .tlm-telegram svg{width:26px;height:26px;fill:#fff}
  #tlm-chatpanel{position:fixed;right:18px;bottom:84px;z-index:9001;width:340px;max-width:calc(100vw - 36px);height:460px;max-height:calc(100vh - 120px);background:#0d1020;border:1px solid rgba(99,102,241,.3);border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.5);display:none;flex-direction:column;overflow:hidden}
  #tlm-chatpanel.open{display:flex}
  #tlm-chathead{padding:14px 16px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:space-between}
  #tlm-chathead .tlm-close{cursor:pointer;font-size:20px;line-height:1;opacity:.85}
  #tlm-chatbody{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#06080f}
  #tlm-chatbody .tlm-msg{max-width:82%;padding:9px 13px;border-radius:14px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}
  #tlm-chatbody .tlm-user{align-self:flex-end;background:#4f46e5;color:#fff;border-bottom-right-radius:4px}
  #tlm-chatbody .tlm-bot{align-self:flex-start;background:#171a2e;color:#eceaf4;border-bottom-left-radius:4px}
  #tlm-chatbody .tlm-typing{align-self:flex-start;color:#7b82a0;font-size:12px}
  #tlm-chatfoot{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.08);background:#0d1020}
  #tlm-chatfoot input{flex:1;background:#06080f;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:10px 12px;color:#eceaf4;font-size:14px}
  #tlm-chatfoot input:focus{outline:none;border-color:#6366f1}
  #tlm-chatfoot button{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:none;border-radius:10px;padding:0 14px;font-weight:800;cursor:pointer}
  @media(max-width:480px){#tlm-chatpanel{right:10px;left:10px;width:auto;bottom:80px}#tlm-widgets{right:12px;bottom:12px}}
  `;
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ── Le conteneur unique + les 3 boutons ────────────────────────────────────
  var wrap = document.createElement("div");
  wrap.id = "tlm-widgets";
  wrap.innerHTML =
    '<button class="tlm-fab tlm-chatbtn" id="tlm-chatbtn" aria-label="Assistant">💬</button>' +
    '<a class="tlm-fab tlm-tiktok" href="' + TIKTOK + '" target="_blank" rel="noopener" aria-label="TikTok">' +
      '<svg viewBox="0 0 24 24"><path d="M16.6 5.82a4.28 4.28 0 0 1-1-2.82h-3.1v12.4a2.5 2.5 0 1 1-2.5-2.5c.2 0 .4 0 .6.08v-3.16a5.7 5.7 0 0 0-.6-.04A5.65 5.65 0 1 0 15.7 15.4V9.01a7.35 7.35 0 0 0 4.3 1.38V7.28a4.28 4.28 0 0 1-3.4-1.46z"/></svg></a>' +
    '<a class="tlm-fab tlm-telegram" href="' + TELEGRAM + '" target="_blank" rel="noopener" aria-label="Telegram">' +
      '<svg viewBox="0 0 24 24"><path d="M9.8 15.6 9.6 19c.4 0 .6-.2.8-.4l1.9-1.8 3.9 2.9c.7.4 1.2.2 1.4-.7l2.6-12.1c.2-1-.4-1.4-1.1-1.2L3.4 9.3c-1 .4-1 .9-.2 1.2l4.3 1.3 9.9-6.2c.5-.3.9-.1.5.2z"/></svg></a>';
  document.body.appendChild(wrap);

  // ── Le panneau de chat ─────────────────────────────────────────────────────
  var panel = document.createElement("div");
  panel.id = "tlm-chatpanel";
  panel.innerHTML =
    '<div id="tlm-chathead"><span>💬 Assistant TousLesMatchs</span><span class="tlm-close" id="tlm-chatclose">×</span></div>' +
    '<div id="tlm-chatbody"></div>' +
    '<div id="tlm-chatfoot"><input id="tlm-chatinput" type="text" placeholder="Pose ta question…" autocomplete="off"><button id="tlm-chatsend">➤</button></div>';
  document.body.appendChild(panel);

  var body = panel.querySelector("#tlm-chatbody");
  var input = panel.querySelector("#tlm-chatinput");
  var sendBtn = panel.querySelector("#tlm-chatsend");
  var started = false;

  function auth() {
    return { email: localStorage.getItem("tlm_email") || "", code: localStorage.getItem("tlm_code") || "" };
  }
  function addMsg(text, who) {
    var d = document.createElement("div");
    d.className = "tlm-msg " + (who === "user" ? "tlm-user" : "tlm-bot");
    d.textContent = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
    return d;
  }
  function openPanel() {
    panel.classList.add("open");
    input.focus();
    if (!started) { started = true; loadHistory(); }
  }
  function closePanel() { panel.classList.remove("open"); }

  function loadHistory() {
    var a = auth();
    if (!a.email || !a.code) {
      addMsg("Bonjour 👋 Je suis l'assistant de TousLesMatchs. Pose-moi une question sur le site, les analyses ou les abonnements. (Connecte-toi pour que je garde l'historique de nos échanges.)", "bot");
      return;
    }
    fetch("/api/chat/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.messages && d.messages.length) {
          d.messages.forEach(function (m) { addMsg(m.content, m.role === "assistant" ? "bot" : "user"); });
        } else {
          addMsg("Bonjour 👋 Je suis l'assistant de TousLesMatchs. Comment puis-je t'aider ?", "bot");
        }
      })
      .catch(function () { addMsg("Bonjour 👋 Comment puis-je t'aider ?", "bot"); });
  }

  function send() {
    var text = input.value.trim();
    if (!text) return;
    addMsg(text, "user");
    input.value = "";
    sendBtn.disabled = true;
    var typing = addMsg("…", "bot");
    typing.className = "tlm-typing";
    var a = auth();
    fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: a.email, code: a.code, message: text }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        typing.remove();
        addMsg((d && d.reply) ? d.reply : "Notre assistant est momentanément indisponible.", "bot");
        sendBtn.disabled = false;
      })
      .catch(function () {
        typing.remove();
        addMsg("Notre assistant est momentanément indisponible. Réessaie dans un instant.", "bot");
        sendBtn.disabled = false;
      });
  }

  document.getElementById("tlm-chatbtn").addEventListener("click", function () {
    panel.classList.contains("open") ? closePanel() : openPanel();
  });
  panel.querySelector("#tlm-chatclose").addEventListener("click", closePanel);
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });

  // ── Session unique (une seule connexion active a la fois) ──────────────────
  // Demande de Greg le 03/08/2026 : deux personnes ne doivent pas pouvoir
  // utiliser le meme code en meme temps. /verify-code genere un nouveau
  // jeton a chaque connexion reussie (stocke en localStorage sous tlm_session)
  // et l'ecrit en base, invalidant celui de tout autre appareil. Ce heartbeat,
  // charge une seule fois via widgets.js sur toutes les pages protegees,
  // detecte quand SON jeton n'est plus le bon et deconnecte l'appareil.
  function sessionHeartbeat() {
    var email = localStorage.getItem("tlm_email");
    var code = localStorage.getItem("tlm_code");
    var session = localStorage.getItem("tlm_session");
    if (!email || !code || !session) return; // pas connecte via ce systeme, ou connexion faite avant ce correctif
    fetch("/api/session-check?email=" + encodeURIComponent(email) + "&code=" + encodeURIComponent(code) + "&session=" + encodeURIComponent(session))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.active === false) {
          localStorage.removeItem("tlm_email");
          localStorage.removeItem("tlm_code");
          localStorage.removeItem("tlm_session");
          location.reload();
        }
      })
      .catch(function () {}); // panne reseau : on ne deconnecte jamais sur une simple erreur
  }
  sessionHeartbeat(); // verification immediate au chargement, pas d'attente du premier intervalle
  setInterval(sessionHeartbeat, 8000);
})();
