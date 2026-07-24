const i18n = (function(){
  const translations = {
    fr: {
      pick_today: "Analyse du jour",
      nav_join: "Abonnements",
      nav_cta: "Commencer ->",
      mm_home: "Accueil",
      mm_hist: "Historique des picks",
      mm_preuves: "Preuves de resultats",
      mm_live: "Live IA",
      login_title: "Acces membre",
      login_sub: "Entre ton email et ton code d'acces recu par email apres paiement.",
      login_email: "Email",
      login_code: "Code d'acces",
      login_btn: "Acceder ->",
      login_required: "Connecte-toi pour acceder au Live IA",
      login_checking: "Verification...",
      login_invalid: "Code invalide ou expire.",
      login_error: "Erreur de connexion. Reessaie.",
      sec_next_eye: "Concile - Picks en direct",
      sec_next_title: "Resultats & Prochain Pick",
      sec_pick_eye: "Concile - analyse du jour",
      sec_roi_eye: "Performance",
      sec_roi_title: "Resultats reels - traces pick par pick",
      lbl_winrate: "Winrate",
      lbl_picks_month: "Picks joues",
      sec_plans_eye: "Abonnements",
      sec_plans_title: "Standard. Premium. Elite/VIP.",
      sec_plans_sub: "Choisis ton volume de signaux IA avec paiement securise Stripe.",
      plan_free_badge: "Entree",
      plan_free_name: "Standard",
      plan_free_desc: "Jusqu'a 3 signaux par jour, confiance minimale 88/100, cote ARJEL minimum 1.50.",
      plan_free_btn: "S'abonner Standard",
      plan_carte_badge: "Entree",
      plan_carte_name: "Standard",
      plan_carte_desc: "Le niveau d'entree pour suivre les meilleurs signaux selectionnes.",
      plan_pop: "Populaire",
      plan_pro_desc: "10 analyses Live IA par jour + groupe Telegram Premium. Plus de volume, toujours filtre.",
      plan_pro_btn: "S'abonner Premium",
      plan_elite_desc: "30 signaux par jour + alertes Signal Fort automatiques. Le niveau complet multisport.",
      plan_elite_btn: "S'abonner Elite/VIP",
      sec_how_eye: "Methode",
      sec_how_title: "Le Concile ne devine pas.",
      step1_title: "Collecte verifiee a 6h00",
      step2_title: "4 agents specialises + 1 Chief",
      step3_title: "Diffusion a 7h00",
      step4_title: "Resultats traces, modele ameliore",
      foot_text: "Analyse sportive assistee par IA - Donnees verifiees - 0 match invente",
      pick_won: "Gagne",
      pick_lost: "Perdu",
      final_score: "Score final",
      locked_votes: "Votes verrouilles",
      subscribe_cta: "S'abonner pour voir les analyses completes",
      bet_at: "Cote",
      live_today: "En cours",
      upcoming: "A venir",
      bet_type: "Analyse",
      pick_analysis_lbl: "Analyse",
      consensus: "Consensus",
      avg_odds: "Cote moyenne",
      stake: "Mise recommandee",
      see_verdict: "Voir le verdict",
      pf_live_now: "En direct",
      pf_kickoff: "Coup d'envoi dans",
      pf_next: "Prochain pick",
      pf_preview_txt: "L'analyse du Concile sera disponible avant le coup d'envoi.",
      pf_preview_lock: "Reserve aux abonnes Premium & Elite/VIP",
      pf_btn: "Voir l'analyse complete",
      pf_hint: "Disponible pour les abonnes Premium et Elite/VIP",
      logout: "Deconnexion",
      nav_connect: "Connexion",
      match_done: "Match termine"
    }
  };

  let lang = "fr";

  return {
    t: function(key) {
      return (translations[lang] && translations[lang][key]) || key;
    },
    init: function() {
      var userLang = (navigator.language || "fr").slice(0, 2);
      lang = translations[userLang] ? userLang : "fr";
      document.querySelectorAll("[data-i18n]").forEach(function(el) {
        var key = el.getAttribute("data-i18n");
        var val = translations[lang] && translations[lang][key];
        if (val) el.textContent = val;
      });
    },
    setLang: function(l) {
      lang = translations[l] ? l : "fr";
      this.init();
    }
  };
})();
