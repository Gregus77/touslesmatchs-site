'use strict';

(function initModule(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.document) root.addEventListener('DOMContentLoaded', () => api.init(root.document));
})(typeof window !== 'undefined' ? window : null, function buildModule() {
  const API_ROOT = '';
  const state = { captures: [], session: null };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
  }

  function stateMessage(status) {
    return ({
      draft: 'Captures recues, extraction en attente.',
      extracted: 'Extraction terminee : verifiez chaque donnee avant confirmation.',
      confirmed: 'Donnees confirmees : le Concile peut maintenant analyser cet instantane.',
      analysed: 'Analyse privee terminee.',
      resolved: 'Analyse resolue et historisee.',
    })[status] || 'Session prete.';
  }

  function extractionToEditor(extraction) {
    if (!extraction || typeof extraction !== 'object') return null;
    return JSON.parse(JSON.stringify({
      match: extraction.match || {},
      bookmaker: extraction.bookmaker || '',
      screenshots: Array.isArray(extraction.screenshots) ? extraction.screenshots : [],
      markets: Array.isArray(extraction.markets) ? extraction.markets : [],
      stats: extraction.stats && typeof extraction.stats === 'object' ? extraction.stats : {},
    }));
  }

  function renderVerdict(session) {
    const verdict = session && session.verdict;
    const best = verdict && verdict.best;
    if (!best) return '<div class="empty-verdict">Aucun bulletin exploitable. Aucun avis n a ete invente.</div>';
    const probability = Math.round(Number(best.probability || 0) * 100);
    const values = [
      ['Probabilite moyenne', probability + ' %'],
      ['Cote bookmaker', best.bookmakerOdd == null ? 'Non disponible' : Number(best.bookmakerOdd).toFixed(2)],
      ['Cote juste', Number(best.fairOdd || 0).toFixed(2)],
      ['Value', best.value == null ? 'Non calculee' : Number(best.value).toFixed(3)],
      ['Accord', Number(best.agreement || 0) + ' avis valides'],
    ];
    return '<article class="verdict-card verdict-' + esc(String(best.label || '').toLowerCase()) + '">' +
      '<div class="verdict-label">' + esc(best.label || 'RISQUE') + '</div>' +
      '<h3>' + esc(best.market) + ' · ' + esc(best.selection) + '</h3>' +
      '<div class="verdict-grid">' + values.map(([label, value]) =>
        '<div><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>').join('') + '</div>' +
      (Array.isArray(verdict.alternatives) && verdict.alternatives.length
        ? '<details><summary>Alternatives anonymisees</summary>' + verdict.alternatives.map((item) =>
          '<p>' + esc(item.market) + ' · ' + esc(item.selection) + ' — ' +
          Math.round(Number(item.probability || 0) * 100) + ' %</p>').join('') + '</details>'
        : '') + '</article>';
  }

  function authHeaders() {
    return {
      'content-type': 'application/json',
      'x-tlm-email': sessionStorage.getItem('tlm_admin_email') || '',
      'x-tlm-code': sessionStorage.getItem('tlm_admin_code') || '',
    };
  }

  async function request(route, options) {
    const response = await fetch(API_ROOT + route, {
      ...options,
      headers: { ...authHeaders(), ...(options && options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({ ok: false, error: 'Reponse serveur illisible' }));
    if (!response.ok) throw new Error(payload.error || 'Requete refusee');
    return payload;
  }

  function setStatus(document, text, kind) {
    const box = document.getElementById('status');
    box.textContent = text;
    box.dataset.kind = kind || 'info';
  }

  function fileToCompressedCapture(file, category) {
    return new Promise((resolve, reject) => {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Format non autorise'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Lecture image impossible'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Image invalide'));
        image.onload = () => {
          const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          const mimeType = file.type === 'image/png' ? 'image/png' : 'image/webp';
          const dataUrl = canvas.toDataURL(mimeType, 0.82);
          const sizeBytes = Math.ceil((dataUrl.split(',')[1] || '').length * 3 / 4);
          if (sizeBytes > 1500000) return reject(new Error('Image encore trop lourde apres compression'));
          resolve({ category, mimeType, sizeBytes, dataUrl });
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function drawFiles(document, files) {
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    state.captures = Array.from(files).map((file, index) => ({ file, category: index < 3 ? 'odds' : 'stats' }));
    for (const [index, item] of state.captures.entries()) {
      const row = document.createElement('div');
      row.className = 'file-row';
      row.innerHTML = '<span>' + esc(item.file.name) + '</span><select aria-label="Categorie capture ' + (index + 1) +
        '"><option value="odds">Cotes</option><option value="stats"' + (index >= 3 ? ' selected' : '') +
        '>Statistiques</option></select>';
      row.querySelector('select').addEventListener('change', (event) => { item.category = event.target.value; });
      list.appendChild(row);
    }
  }

  function showSession(document, session) {
    state.session = session;
    setStatus(document, stateMessage(session.status), session.status);
    document.getElementById('session-id').textContent = session.id || '';
    document.getElementById('editor').value = JSON.stringify(extractionToEditor(session.extraction || session.confirmed), null, 2);
    document.getElementById('confirm-btn').disabled = session.status !== 'extracted';
    document.getElementById('analyse-btn').disabled = session.status !== 'confirmed';
    document.getElementById('verdict').innerHTML = session.status === 'analysed' ? renderVerdict(session) : '';
  }

  function init(document) {
    const fileInput = document.getElementById('captures');
    const uploadButton = document.getElementById('extract-btn');
    const confirmButton = document.getElementById('confirm-btn');
    const analyseButton = document.getElementById('analyse-btn');
    const loginButton = document.getElementById('save-auth');

    fileInput.addEventListener('change', () => drawFiles(document, fileInput.files));

    loginButton.addEventListener('click', () => {
      sessionStorage.setItem('tlm_admin_email', document.getElementById('admin-email').value.trim());
      sessionStorage.setItem('tlm_admin_code', document.getElementById('admin-code').value.trim());
      setStatus(document, 'Identifiants admin enregistres pour cette session.', 'info');
    });

    uploadButton.addEventListener('click', async () => {
      try {
        if (state.captures.length < 4 || state.captures.length > 10) throw new Error('Selectionnez entre 4 et 10 captures');
        const odds = state.captures.filter((item) => item.category === 'odds').length;
        const stats = state.captures.filter((item) => item.category === 'stats').length;
        if (odds < 3 || stats < 1) throw new Error('Il faut au moins 3 captures de cotes et 1 de statistiques');
        setStatus(document, 'Compression et extraction en cours...', 'working');
        const captures = await Promise.all(state.captures.map((item) => fileToCompressedCapture(item.file, item.category)));
        const payload = await request('/admin/live-capture/sessions', {
          method: 'POST', body: JSON.stringify({ captures }),
        });
        showSession(document, payload.session);
      } catch (error) {
        setStatus(document, error.message, 'error');
      }
    });

    confirmButton.addEventListener('click', async () => {
      try {
        const confirmed = JSON.parse(document.getElementById('editor').value);
        const payload = await request('/admin/live-capture/sessions/' + encodeURIComponent(state.session.id) + '/confirm', {
          method: 'POST', body: JSON.stringify({ confirmed }),
        });
        showSession(document, payload.session);
      } catch (error) {
        setStatus(document, error.message, 'error');
      }
    });

    analyseButton.addEventListener('click', async () => {
      try {
        analyseButton.disabled = true;
        setStatus(document, 'Les cinq avis anonymes analysent le JSON confirme...', 'working');
        const payload = await request('/admin/live-capture/sessions/' + encodeURIComponent(state.session.id) + '/analyse', {
          method: 'POST', body: '{}',
        });
        showSession(document, payload.session);
      } catch (error) {
        analyseButton.disabled = false;
        setStatus(document, error.message, 'error');
      }
    });
  }

  return { stateMessage, extractionToEditor, renderVerdict, init };
});
