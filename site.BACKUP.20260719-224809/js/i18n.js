const i18n = (function(){
  const translations = {
    fr: {
      pick_today: "Analyse du jour",
      nav_join: "Abonnements",
      nav_cta: "Commencer →",
      mm_home: "🏠 Accueil",
      mm_hist: "📊 Historique des picks",
      mm_preuves: "🏆 Preuves de résultats",
      mm_live: "🔴 Live IA",
      login_title: "Accès membre",
      login_sub: "Entre ton email et ton code d’accès reçu par email après paiement.",
      login_email: "Email",
      login_code: "Code d’accès",
      login_btn: "Accéder →",
      login_required: "Connecte-toi pour accéder au Live IA",
      login_checking: "Vérification…",
      login_invalid: "Code invalide ou expiré.",
      login_error: "Erreur de connexion. Réessaie.",
      sec_next_eye: "Concile · Picks en direct",
      sec_next_title: "Résultats & Prochain Pick",
      sec_pick_eye: "Concile · analyse du jour",
      sec_roi_eye: "Performance",
      sec_roi_title: "Résultats réels · tracés pick par pick",
      lbl_winrate: "Winrate",
      lbl_picks_month: "Picks joués",
      sec_plans_eye: "Abonnements",
      sec_plans_title: "Un plan pour chaque niveau d’ambition",
      sec_plans_sub: "Du pick gratuit au Live IA complet — accès immédiat après paiement.",
      plan_free_badge: "Gratuit",
      plan_free_name: "Découverte",
      plan_free_desc: "La meilleure analyse IA du jour, visible sur le site. Aucune inscription.",
      plan_free_btn: "Voir le pick",
      plan_carte_badge: "À la carte",
      plan_carte_name: "Test",
      plan_carte_desc: "1 crédit = 1 analyse complète sur le match de ton choix en Live IA.",
      plan_pop: "Populaire",
      plan_pro_desc: "10 analyses Live IA par jour + groupe Telegram Pro. Idéal pour suivre les matchs sans attendre.",
      plan_pro_btn: "S’abonner — 9.90€/mois",
      plan_elite_desc: "30 analyses Live IA par jour + alertes Elite quand le Concile détecte un signal très fort.",
      plan_elite_btn: "S’abonner — 19.90€/mois",
      sec_how_eye: "Méthode",
      sec_how_title: "Le Concile ne devine pas.",
      step1_title: "Collecte vérifiée à 6h00",
      step2_title: "4 agents spécialisés + 1 Chief",
      step3_title: "Diffusion à 7h00",
      step4_title: "Résultats tracés, modèle amélioré",
      foot_text: "Analyse sportive assistée par IA · Données vérifiées · 0 match inventé",
      pick_won: "Gagné",
      pick_lost: "Perdu",
      final_score: "Score final",
      locked_votes: "Votes verrouillés",
      subscribe_cta: "S’abonner pour voir les analyses complètes",
      bet_at: "Cote",
      live_today: "En cours",
      upcoming: "À venir",
      bet_type: "Analyse",
      pick_analysis_lbl: "Analyse",
      consensus: "Consensus",
      avg_odds: "Cote moyenne",
      stake: "Mise recommandée",
      see_verdict: "Voir le verdict",
      pf_live_now: "En direct",
      pf_kickoff: "Coup d’envoi dans",
      pf_next: "Prochain pick",
      pf_preview_txt: "L’analyse du Concile sera disponible avant le coup d’envoi.",
      pf_preview_lock: "Réservé aux abonnés Pro & Elite",
      pf_btn: "Voir l’analyse complète",
      pf_hint: "Disponible pour les abonnés Pro et Elite",
      logout: "Déconnexion",
      nav_connect: "Connexion",
      match_done: "Match terminé"
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
