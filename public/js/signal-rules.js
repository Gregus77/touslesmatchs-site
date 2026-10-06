(function () {
  'use strict';
  fetch('/api/public-signal-rules', {cache: 'no-store'})
    .then(function (r) { if (!r.ok) throw new Error('rules'); return r.json(); })
    .then(function (r) {
      if (r.strategy !== 'goal05-favorite-v2' || !Number.isFinite(r.to_minute)) return;
      window.tlmSignalWindowEnd = r.to_minute;
      var lead = document.querySelector('.tlm-hero-lead');
      if (lead) lead.textContent = 'De la ' + r.from_minute + 'e à la ' + r.to_minute
        + 'e minute, le système surveille les rencontres Top 5 contre Bottom 5. Le signal vise l’équipe favorite encore à 0 but, avec une cote réelle fraîche d’au moins '
        + Number(r.min_odd).toFixed(2).replace('.', ',') + ' et un accord minimum de '
        + r.min_votes + ' IA sur 5.';
      var end = document.getElementById('hero-window-end');
      if (end) end.textContent = r.to_minute + "'";
      var note = document.getElementById('tier-note');
      if (note) note.textContent = 'Stratégie actuelle +0,5 but de l’équipe favorite V2 : Top 5 face à une équipe Bottom 5 obligatoire. '
        + 'La saison actuelle et les 3 précédentes, la forme offensive des 5 derniers matchs, la défense adverse et le live sont analysés. '
        + 'Entre la ' + r.from_minute + 'e et la ' + r.to_minute + 'e minute, l’équipe ciblée doit être encore à 0 but, avec au moins '
        + r.min_votes + ' IA sur 5, une note verte ≥ ' + r.min_score + '/10, une couverture factuelle ≥ '
        + r.min_coverage_pct + ' % et une cote réelle fraîche ≥ '
        + Number(r.min_odd).toFixed(2).replace('.', ',') + '. Aucun résultat n’est garanti.';
    }).catch(function () { /* Keep the current static wording if the API is unavailable. */ });
})();
