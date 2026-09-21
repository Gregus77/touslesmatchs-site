(function () {
  'use strict';
  // Separate keys keep legacy live renderers and the global dictionary untouched.
  var translations = {
    fr: { kicker:'Football · Analyse par IA',title:'5 IA confrontent leurs analyses.',decision:'Vous gardez la décision.',lead:'Football en direct. Avis détaillés et historique consultable.',signup:'Créer mon compte gratuit',exampleLink:'Voir un exemple',emailNote:'Un code par email. Sans carte bancaire.',transparent:'Méthode transparente',understand:'Comprenez chaque analyse',data:'Données de match',context:'Contexte et historique',control:'Vous gardez le contrôle',tool:'Un outil d’aide à la décision',exampleLabel:'Exemple illustratif — pas un signal en direct',teamA:'Équipe A',teamB:'Équipe B',market:'Over / Under 2,5',ai1:'IA 1',ai2:'IA 2',ai3:'IA 3',ai4:'IA 4',ai5:'IA 5',over:'Over',under:'Under',abstain:'Abstention',agreement:'avis concordants sur 5',odds:'Cote non fournie — à vérifier chez votre bookmaker.',methodLabel:'Notre méthode',signalsTitle:'Signaux envoyés',signalsText:'Une analyse n’est pas un signal envoyé. Consultez les sélections diffusées et leur contexte dans l’historique.',liveLink:'Explorer le Live IA →',resultsTitle:'Résultats consultables',resultsText:'Gagnés, perdus et en attente : consultez les résultats enregistrés et les limites de l’historique. Aucun gain garanti.',resultsLink:'Consulter l’historique →',shadowTitle:'Tests à blanc',shadowText:'Les essais internes servent à évaluer les modèles. Ils doivent rester distincts des signaux réellement diffusés.',methodLink:'Comprendre la méthode →',discover:'Découvrez le fonctionnement',free:'gratuitement',discoverText:'Recevez un code d’accès par email et explorez votre espace gratuit.',calendar:'Calendrier des rencontres',history:'Historique détaillé des analyses',newsletter:'Alertes par email',newsletterTitle:'Recevez les actualités et alertes par email',newsletterText:'Inscription aux emails de TousLesMatchs. Aucun signal quotidien garanti ; ce formulaire ne crée pas de compte.' },
    en: { kicker:'Football · AI analysis',title:'5 AIs compare their analyses.',decision:'You make the decision.',lead:'Live football. Detailed opinions and an accessible history.',signup:'Create my free account',exampleLink:'See an example',emailNote:'A code by email. No bank card required.',transparent:'Transparent method',understand:'Understand each analysis',data:'Match data',context:'Context and history',control:'You stay in control',tool:'A decision-support tool',exampleLabel:'Illustrative example — not a live signal',teamA:'Team A',teamB:'Team B',market:'Over / Under 2.5',ai1:'AI 1',ai2:'AI 2',ai3:'AI 3',ai4:'AI 4',ai5:'AI 5',over:'Over',under:'Under',abstain:'Abstention',agreement:'agreeing opinions out of 5',odds:'Odds not provided — check with your bookmaker.',methodLabel:'Our method',signalsTitle:'Sent signals',signalsText:'An analysis is not a sent signal. Consult the published selections and their context in the history.',liveLink:'Explore Live AI →',resultsTitle:'Accessible results',resultsText:'Wins, losses and pending outcomes: consult recorded results and the limits of the history. No guaranteed profit.',resultsLink:'View the history →',shadowTitle:'Shadow tests',shadowText:'Internal tests evaluate the models. They must remain separate from signals actually sent.',methodLink:'Understand the method →',discover:'Discover how it works',free:'for free',discoverText:'Receive an access code by email and explore your free account.',calendar:'Match calendar',history:'Detailed analysis history',newsletter:'Email updates',newsletterTitle:'Receive news and alerts by email',newsletterText:'Subscribe to TousLesMatchs emails. No daily signal is guaranteed; this form does not create an account.' },
    ru: { kicker:'Футбол · Анализ ИИ',title:'5 ИИ сопоставляют свои анализы.',decision:'Решение остаётся за вами.',lead:'Футбол в прямом эфире. Подробные мнения и доступная история.',signup:'Создать бесплатный аккаунт',exampleLink:'Посмотреть пример',emailNote:'Код по электронной почте. Банковская карта не нужна.',transparent:'Прозрачный метод',understand:'Понимайте каждый анализ',data:'Данные матчей',context:'Контекст и история',control:'Вы сохраняете контроль',tool:'Помощь в принятии решения',exampleLabel:'Иллюстративный пример — не сигнал в прямом эфире',teamA:'Команда А',teamB:'Команда Б',market:'Тотал больше / меньше 2,5',ai1:'ИИ 1',ai2:'ИИ 2',ai3:'ИИ 3',ai4:'ИИ 4',ai5:'ИИ 5',over:'Больше',under:'Меньше',abstain:'Воздержался',agreement:'совпадающих мнения из 5',odds:'Коэффициент не указан — уточните у вашего букмекера.',methodLabel:'Наш метод',signalsTitle:'Отправленные сигналы',signalsText:'Анализ — это не отправленный сигнал. Смотрите опубликованные прогнозы и их контекст в истории.',liveLink:'Перейти к анализу в прямом эфире →',resultsTitle:'Доступные результаты',resultsText:'Выигрыши, проигрыши и ожидающие результаты: изучайте записи и ограничения истории. Прибыль не гарантирована.',resultsLink:'Посмотреть историю →',shadowTitle:'Тесты без отправки',shadowText:'Внутренние тесты оценивают модели. Их необходимо отделять от действительно отправленных сигналов.',methodLink:'Узнать о методе →',discover:'Узнайте, как это работает',free:'бесплатно',discoverText:'Получите код доступа по электронной почте и изучите бесплатный личный кабинет.',calendar:'Календарь матчей',history:'Подробная история анализов',newsletter:'Оповещения по почте',newsletterTitle:'Получайте новости и оповещения по почте',newsletterText:'Подписка на письма TousLesMatchs. Ежедневные сигналы не гарантированы; эта форма не создаёт аккаунт.' }
  };
  Object.assign(translations.fr, {collection:'Les données disponibles donnent le contexte du match.',models:'Les modèles du Conseil confrontent leurs avis sur les matchs éligibles.',guidesLink:'Guides football',guidesTitle:'Comprendre avant de décider',guidesIntro:'Des guides en français pour lire un total de buts, distinguer BTTS et comprendre les limites des votes IA.',guidesCta:'Lire les guides gratuits'});
  Object.assign(translations.en, {collection:'Available data provides match context.',models:'Council models compare their opinions on eligible matches.',guidesLink:'Football guides (FR)',guidesTitle:'Understand before deciding',guidesIntro:'French-language guides to goal totals, BTTS and the limits of AI consensus.',guidesCta:'Read the free guides (FR)'});
  Object.assign(translations.ru, {collection:'Доступные данные дают контекст матча.',models:'Модели Совета сопоставляют мнения по подходящим матчам.',guidesLink:'Руководства (FR)',guidesTitle:'Разберитесь, прежде чем решать',guidesIntro:'Руководства на французском: тотал голов, BTTS и ограничения голосования ИИ.',guidesCta:'Читать бесплатные руководства (FR)'});
  function fold(target, key) {
    var node = document.querySelector(target);
    var row = node && node.closest('.row');
    if (!row || row.parentElement.classList.contains('capture-fold')) return;
    var details = document.createElement('details');
    details.className = 'capture-fold';
    var summary = document.createElement('summary');
    summary.dataset.capture = key;
    details.appendChild(summary);
    row.parentNode.insertBefore(details, row);
    details.appendChild(row);
  }
  function openAnchor() {
    if (!location.hash) return;
    var target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (_) { return; }
    if (!target) return;
    var parent = target.parentElement;
    while (parent) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
  }
  function apply(language) {
    var lang = language || (window.i18n && window.i18n.current()) || document.documentElement.lang || 'fr';
    var dict = translations[lang] || translations.en;
    document.querySelectorAll('[data-capture]').forEach(function (el) {
      // Existing auto-translator skips explicitly managed keys. These scoped keys
      // intentionally have no entry in the legacy global dictionary.
      el.setAttribute('data-i18n', 'capture_home_' + el.dataset.capture);
      var text = dict[el.dataset.capture];
      if (text !== undefined && el.textContent !== text) el.textContent = text;
      el.lang = translations[lang] ? lang : 'en';
    });
    document.querySelectorAll('[data-capture-aria]').forEach(function (el) { el.setAttribute('data-i18n-aria-label', 'capture_home_' + el.dataset.captureAria); el.setAttribute('aria-label', dict[el.dataset.captureAria]); });
  }
  function start() {
    fold('#upcoming-panel', 'calendar');
    fold('#daily-accordion', 'history');
    fold('#email-capture-card', 'newsletter');
    // Keep the newsletter endpoint and form, but never represent it as account creation.
    var title = document.querySelector('#email-capture-card [data-i18n="capture_title"]');
    var subtitle = document.querySelector('#email-capture-card [data-i18n="capture_sub"]');
    if (title) { title.removeAttribute('data-i18n'); title.dataset.capture = 'newsletterTitle'; }
    if (subtitle) { subtitle.removeAttribute('data-i18n'); subtitle.dataset.capture = 'newsletterText'; }
    apply();
    openAnchor();
    document.addEventListener('tlm-language-change', function (event) { apply(event.detail && event.detail.lang); });
    window.addEventListener('hashchange', openAnchor);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
