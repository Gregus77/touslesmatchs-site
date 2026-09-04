(function () {
  'use strict';
  fetch('/api/public-signal-rules', {cache: 'no-store'})
    .then(function (r) { if (!r.ok) throw new Error('rules'); return r.json(); })
    .then(function (r) {
      if (!r.ok || !Number.isFinite(r.to_minute)) return;
      window.tlmSignalWindowEnd = r.to_minute;
      var lead = document.querySelector('.tlm-hero-lead');
      if (lead) lead.textContent = 'Entre la ' + r.from_minute + 'e et la ' + r.to_minute
        + 'e minute, 5 IA analysent le match. Vous recevez uniquement les signaux validés par au moins '
        + r.min_votes + ' IA sur 5.';
      var end = document.getElementById('hero-window-end');
      if (end) end.textContent = r.to_minute + "'";
      var note = document.getElementById('tier-note');
      if (note) note.textContent = 'Règle actuelle Standard et Premium : football de championnat entre la '
        + r.from_minute + 'e et la ' + r.to_minute + 'e minute, majorité minimale '
        + r.min_votes + '/5, confiance ≥' + r.min_confidence + '/100 et cote ANJ réelle entre '
        + Number(r.min_odd).toFixed(2).replace('.', ',') + ' et '
        + Number(r.max_odd).toFixed(2).replace('.', ',') + '. Les autres critères de qualité restent applicables.';
    }).catch(function () { /* Keep neutral wording if the API is unavailable. */ });
})();
