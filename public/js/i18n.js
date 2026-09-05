/**
 * Traduction de l'interface — FR / EN / ES / PT / RU / ZH.
 *
 * Regles de redaction respectees dans TOUTES les langues :
 *  - jamais le mot "pari" ni ses equivalents (betting, apuesta, aposta,
 *    ставка, 投注) — on parle d'ANALYSE, de selection, de score de confiance ;
 *  - aucune promesse ni garantie de gain, dans aucune langue ;
 *  - la mention 18+ / jeu responsable est traduite, jamais supprimee.
 *
 * Fonctionnement : chaque element portant data-i18n="cle" voit son texte
 * remplace. data-i18n-html="cle" fait de meme en autorisant le HTML (utile
 * pour les titres avec <br> ou <span>). data-i18n-ph="cle" traduit un
 * placeholder de champ. La langue choisie est memorisee dans localStorage ;
 * a la premiere visite on suit celle du navigateur, avec repli sur FR.
 */
const i18n = (function () {
  const translations = {
    fr: {
      nav_analyses: "Analyses", nav_live: "Live IA", nav_results: "Résultats",
      nav_bankroll: "Bankroll", nav_method: "Méthode", nav_plans: "Tarifs",
      nav_login: "Se connecter", nav_signup: "Créer mon compte gratuit",
      lang_label: "Langue",

      hero_badge: "Le Concile IA sportif",
      hero_title: "5 IA analysent chaque match.<br><span class=\"grad\">On ne vous montre que leurs points d'accord.</span>",
      hero_sub: "Plus une analyse fait consensus entre nos intelligences artificielles indépendantes, plus elle est fiable.",
      hero_cta1: "Voir les matchs en direct", hero_cta2: "Créer mon compte gratuit",
      hero_r1: "✓ Résultats publics", hero_r2: "✓ Données vérifiées",
      hero_r3: "✓ Sans engagement",

      live_now: "Matchs en cours", live_upcoming: "Matchs à venir — calendrier",
      live_all: "Voir tous les matchs →", loading: "Chargement…",

      proof_total: "Sélections terminées", proof_wl: "Gagnées / Perdues",
      proof_winrate: "Taux de réussite", proof_profit: "Profit simulé (mise 10€)",
      proof_note: "Performances calculées sur les sélections officiellement terminées. Les performances passées ne garantissent pas les résultats futurs.",

      verdicts_title: "Derniers verdicts du Concile",
      pick_title: "Le pick gratuit du jour", badge_free: "Gratuit",

      capture_title: "Reçois le pick gratuit chaque matin par email",
      capture_sub: "Aucun spam, aucune carte bancaire — juste le pick du jour et les résultats vérifiés dans ta boîte mail.",
      capture_ph: "toi@exemple.com", capture_btn: "S'inscrire",

      plan_free: "GRATUIT", plan_free_1: "Pick gratuit du jour",
      plan_free_2: "Résultats publics", plan_free_3: "Aucune carte bancaire",
      plan_std: "STANDARD", plan_std_1: "Jusqu'à 3 sélections/jour",
      plan_std_2: "Minimum 3 IA sur 5 d'accord sur Over/Under 2,5",
      plan_prem: "PREMIUM", plan_prem_1: "Jusqu'à 10 sélections/jour",
      plan_prem_2: "Minimum 3 IA sur 5 d'accord · inclut Standard",
      plan_nocommit: "Sans engagement", plan_popular: "Le plus choisi",
      plan_month: "/mois",
      plan_btn_std: "Choisir Standard", plan_btn_prem: "Choisir Premium",
      plans_note: "Les volumes indiqués correspondent à des maximums. Le nombre réel de sélections dépend des matchs atteignant les critères du Concile.<br>Le score de confiance est un indicateur interne d'analyse. Le résultat d'un événement sportif reste incertain.",

      method_title: "Comment ça fonctionne ?", method_see: "Voir la méthode",
      method_1t: "Les données sont collectées",
      method_1d: "Hermès vérifie chaque donnée sur plusieurs sources.",
      method_2t: "Les IA analysent séparément",
      method_2d: "Perplexity, DeepSeek, Mistral, Cohere, Qwen votent.",
      method_3t: "Le Concile calcule le score",
      method_3d: "Publié seulement si la convergence dépasse le seuil.",

      recent_title: "Résultats récents", see_all: "Voir tout →",
      std_yesterday: "Ce que Standard a reçu hier",
      th_match: "Match", th_sel: "Sél.", th_res: "Rés.", th_odd: "Cote",

      partners_title: "Nos partenaires bookmakers agréés ANJ",
      partners_sub: "En passant par nos liens, tu soutiens le site — sans surcoût pour toi.",
      partners_legal: "18+ · Jeu responsable · Ouvrir un compte chez un partenaire ne garantit aucun gain.",

      foot_tag: "Le Concile IA sportif au service de tes analyses.",
      foot_nav: "Navigation", foot_legal: "Légal",

      login_title: "Accès membre",
      login_sub: "Entre ton email et ton code d'accès reçu par email après paiement.",
      login_email: "Email", login_code: "Code d'accès", login_btn: "Accéder →",
    },

    en: {
      nav_analyses: "Analyses", nav_live: "Live AI", nav_results: "Results",
      nav_bankroll: "Bankroll", nav_method: "Method", nav_plans: "Pricing",
      nav_login: "Log in", nav_signup: "Create free account",
      lang_label: "Language",

      hero_badge: "The AI Sports Council",
      hero_title: "Several artificial intelligences analyse.<br><span class=\"grad\">The Council selects the strongest agreements.</span>",
      hero_sub: "TousLesMatchs combines sports data with the votes of several independent AIs to rank analyses by confidence score.",
      hero_cta1: "See live matches", hero_cta2: "Create free account",
      hero_r1: "✓ Public results", hero_r2: "✓ Verified data",
      hero_r3: "✓ No commitment",

      live_now: "Matches in progress", live_upcoming: "Upcoming matches — schedule",
      live_all: "See all matches →", loading: "Loading…",

      proof_total: "Completed selections", proof_wl: "Won / Lost",
      proof_winrate: "Success rate", proof_profit: "Simulated profit (€10 stake)",
      proof_note: "Performance calculated on officially completed selections. Past performance does not guarantee future results.",

      verdicts_title: "Latest Council verdicts",
      pick_title: "Today's free pick", badge_free: "Free",

      capture_title: "Get the free pick every morning by email",
      capture_sub: "No spam, no credit card — just the daily pick and verified results in your inbox.",
      capture_ph: "you@example.com", capture_btn: "Sign up",

      plan_free: "FREE", plan_free_1: "Free pick of the day",
      plan_free_2: "Public results", plan_free_3: "No credit card",
      plan_std: "STANDARD", plan_std_1: "Up to 3 selections/day",
      plan_std_2: "At least 4 of 5 AIs agree on Over/Under 2.5",
      plan_prem: "PREMIUM", plan_prem_1: "Up to 10 selections/day",
      plan_prem_2: "At least 4 of 5 AIs agree · includes Standard",
      plan_nocommit: "No commitment", plan_popular: "Most chosen",
      plan_month: "/month",
      plan_btn_std: "Choose Standard", plan_btn_prem: "Choose Premium",
      plans_note: "The volumes shown are maximums. The actual number of selections depends on how many matches meet the Council's criteria.<br>The confidence score is an internal analysis indicator. The outcome of a sporting event remains uncertain.",

      method_title: "How does it work?", method_see: "See the method",
      method_1t: "Data is collected",
      method_1d: "Hermès verifies every data point across several sources.",
      method_2t: "The AIs analyse separately",
      method_2d: "Perplexity, DeepSeek, Mistral, Cohere and Qwen each vote.",
      method_3t: "The Council computes the score",
      method_3d: "Published only if agreement exceeds the threshold.",

      recent_title: "Recent results", see_all: "See all →",
      std_yesterday: "What Standard received yesterday",
      th_match: "Match", th_sel: "Sel.", th_res: "Res.", th_odd: "Odds",

      partners_title: "Our ANJ-licensed bookmaker partners",
      partners_sub: "Using our links supports the site — at no extra cost to you.",
      partners_legal: "18+ · Responsible gaming · Opening an account with a partner guarantees no winnings.",

      foot_tag: "The AI Sports Council at the service of your analyses.",
      foot_nav: "Navigation", foot_legal: "Legal",

      login_title: "Member access",
      login_sub: "Enter your email and the access code you received by email after payment.",
      login_email: "Email", login_code: "Access code", login_btn: "Enter →",
    },

    es: {
      nav_analyses: "Análisis", nav_live: "IA en directo", nav_results: "Resultados",
      nav_bankroll: "Bankroll", nav_method: "Método", nav_plans: "Precios",
      nav_login: "Iniciar sesión", nav_signup: "Crear cuenta gratis",
      lang_label: "Idioma",

      hero_badge: "El Concilio IA deportivo",
      hero_title: "Varias inteligencias artificiales analizan.<br><span class=\"grad\">El Concilio selecciona las mejores convergencias.</span>",
      hero_sub: "TousLesMatchs combina los datos deportivos con el voto de varias IA independientes para clasificar los análisis según su puntuación de confianza.",
      hero_cta1: "Ver partidos en directo", hero_cta2: "Crear cuenta gratis",
      hero_r1: "✓ Resultados públicos", hero_r2: "✓ Datos verificados",
      hero_r3: "✓ Sin compromiso",

      live_now: "Partidos en curso", live_upcoming: "Próximos partidos — calendario",
      live_all: "Ver todos los partidos →", loading: "Cargando…",

      proof_total: "Selecciones finalizadas", proof_wl: "Acertadas / Falladas",
      proof_winrate: "Tasa de acierto", proof_profit: "Resultado simulado (base 10 €)",
      proof_note: "Rendimiento calculado sobre las selecciones oficialmente finalizadas. Los resultados pasados no garantizan los resultados futuros.",

      verdicts_title: "Últimos veredictos del Concilio",
      pick_title: "El pick gratuito del día", badge_free: "Gratis",

      capture_title: "Recibe el pick gratuito cada mañana por email",
      capture_sub: "Sin spam, sin tarjeta bancaria — solo el pick del día y los resultados verificados en tu correo.",
      capture_ph: "tu@ejemplo.com", capture_btn: "Suscribirme",

      plan_free: "GRATIS", plan_free_1: "Pick gratuito del día",
      plan_free_2: "Resultados públicos", plan_free_3: "Sin tarjeta bancaria",
      plan_std: "STANDARD", plan_std_1: "Hasta 3 selecciones/día",
      plan_std_2: "Mínimo 4 de 5 IA de acuerdo en Más/Menos de 2,5",
      plan_prem: "PREMIUM", plan_prem_1: "Hasta 10 selecciones/día",
      plan_prem_2: "Mínimo 4 de 5 IA de acuerdo · incluye Standard",
      plan_nocommit: "Sin compromiso", plan_popular: "El más elegido",
      plan_month: "/mes",
      plan_btn_std: "Elegir Standard", plan_btn_prem: "Elegir Premium",
      plans_note: "Los volúmenes indicados son máximos. El número real de selecciones depende de los partidos que cumplan los criterios del Concilio.<br>La puntuación de confianza es un indicador interno de análisis. El resultado de un evento deportivo sigue siendo incierto.",

      method_title: "¿Cómo funciona?", method_see: "Ver el método",
      method_1t: "Se recopilan los datos",
      method_1d: "Hermès verifica cada dato en varias fuentes.",
      method_2t: "Las IA analizan por separado",
      method_2d: "Perplexity, DeepSeek, Mistral, Cohere y Qwen votan.",
      method_3t: "El Concilio calcula la puntuación",
      method_3d: "Se publica solo si la convergencia supera el umbral.",

      recent_title: "Resultados recientes", see_all: "Ver todo →",
      std_yesterday: "Lo que recibió Standard ayer",
      th_match: "Partido", th_sel: "Sel.", th_res: "Res.", th_odd: "Cuota",

      partners_title: "Nuestros socios operadores con licencia ANJ",
      partners_sub: "Al usar nuestros enlaces apoyas el sitio — sin coste adicional para ti.",
      partners_legal: "18+ · Juego responsable · Abrir una cuenta con un socio no garantiza ninguna ganancia.",

      foot_tag: "El Concilio IA deportivo al servicio de tus análisis.",
      foot_nav: "Navegación", foot_legal: "Legal",

      login_title: "Acceso de miembro",
      login_sub: "Introduce tu email y el código de acceso recibido por correo tras el pago.",
      login_email: "Email", login_code: "Código de acceso", login_btn: "Acceder →",
    },

    pt: {
      nav_analyses: "Análises", nav_live: "IA ao vivo", nav_results: "Resultados",
      nav_bankroll: "Bankroll", nav_method: "Método", nav_plans: "Preços",
      nav_login: "Entrar", nav_signup: "Criar conta grátis",
      lang_label: "Idioma",

      hero_badge: "O Concílio IA desportivo",
      hero_title: "Várias inteligências artificiais analisam.<br><span class=\"grad\">O Concílio seleciona as melhores convergências.</span>",
      hero_sub: "O TousLesMatchs cruza os dados desportivos com o voto de várias IA independentes para classificar as análises pela sua pontuação de confiança.",
      hero_cta1: "Ver jogos ao vivo", hero_cta2: "Criar conta grátis",
      hero_r1: "✓ Resultados públicos", hero_r2: "✓ Dados verificados",
      hero_r3: "✓ Sem compromisso",

      live_now: "Jogos a decorrer", live_upcoming: "Próximos jogos — calendário",
      live_all: "Ver todos os jogos →", loading: "A carregar…",

      proof_total: "Seleções concluídas", proof_wl: "Certas / Erradas",
      proof_winrate: "Taxa de acerto", proof_profit: "Resultado simulado (base 10 €)",
      proof_note: "Desempenho calculado sobre as seleções oficialmente concluídas. Os resultados passados não garantem os resultados futuros.",

      verdicts_title: "Últimos veredictos do Concílio",
      pick_title: "O pick gratuito do dia", badge_free: "Grátis",

      capture_title: "Recebe o pick gratuito todas as manhãs por email",
      capture_sub: "Sem spam, sem cartão bancário — apenas o pick do dia e os resultados verificados no teu email.",
      capture_ph: "tu@exemplo.com", capture_btn: "Inscrever-me",

      plan_free: "GRÁTIS", plan_free_1: "Pick gratuito do dia",
      plan_free_2: "Resultados públicos", plan_free_3: "Sem cartão bancário",
      plan_std: "STANDARD", plan_std_1: "Até 3 seleções/dia",
      plan_std_2: "Mínimo de 4 de 5 IAs de acordo em Mais/Menos de 2,5",
      plan_prem: "PREMIUM", plan_prem_1: "Até 10 seleções/dia",
      plan_prem_2: "Mínimo de 4 de 5 IAs de acordo · inclui Standard",
      plan_nocommit: "Sem compromisso", plan_popular: "O mais escolhido",
      plan_month: "/mês",
      plan_btn_std: "Escolher Standard", plan_btn_prem: "Escolher Premium",
      plans_note: "Os volumes indicados são máximos. O número real de seleções depende dos jogos que cumprem os critérios do Concílio.<br>A pontuação de confiança é um indicador interno de análise. O resultado de um evento desportivo permanece incerto.",

      method_title: "Como funciona?", method_see: "Ver o método",
      method_1t: "Os dados são recolhidos",
      method_1d: "O Hermès verifica cada dado em várias fontes.",
      method_2t: "As IA analisam separadamente",
      method_2d: "Perplexity, DeepSeek, Mistral, Cohere e Qwen votam.",
      method_3t: "O Concílio calcula a pontuação",
      method_3d: "Publicado apenas se a convergência ultrapassar o limiar.",

      recent_title: "Resultados recentes", see_all: "Ver tudo →",
      std_yesterday: "O que o Standard recebeu ontem",
      th_match: "Jogo", th_sel: "Sel.", th_res: "Res.", th_odd: "Odd",

      partners_title: "Os nossos parceiros licenciados pela ANJ",
      partners_sub: "Ao usares os nossos links apoias o site — sem custo adicional para ti.",
      partners_legal: "18+ · Jogo responsável · Abrir uma conta num parceiro não garante qualquer ganho.",

      foot_tag: "O Concílio IA desportivo ao serviço das tuas análises.",
      foot_nav: "Navegação", foot_legal: "Legal",

      login_title: "Acesso de membro",
      login_sub: "Introduz o teu email e o código de acesso recebido por email após o pagamento.",
      login_email: "Email", login_code: "Código de acesso", login_btn: "Aceder →",
    },

    ru: {
      nav_analyses: "Аналитика", nav_live: "ИИ в прямом эфире", nav_results: "Результаты",
      nav_bankroll: "Банкролл", nav_method: "Метод", nav_plans: "Тарифы",
      nav_login: "Войти", nav_signup: "Создать бесплатный аккаунт",
      lang_label: "Язык",

      hero_badge: "Спортивный Совет ИИ",
      hero_title: "Несколько искусственных интеллектов проводят анализ.<br><span class=\"grad\">Совет отбирает наиболее согласованные решения.</span>",
      hero_sub: "TousLesMatchs объединяет спортивные данные и голоса нескольких независимых ИИ, чтобы ранжировать анализы по уровню уверенности.",
      hero_cta1: "Смотреть матчи в прямом эфире", hero_cta2: "Создать бесплатный аккаунт",
      hero_r1: "✓ Открытые результаты", hero_r2: "✓ Проверенные данные",
      hero_r3: "✓ Без обязательств",

      live_now: "Текущие матчи", live_upcoming: "Ближайшие матчи — расписание",
      live_all: "Все матчи →", loading: "Загрузка…",

      proof_total: "Завершённых отборов", proof_wl: "Верно / Неверно",
      proof_winrate: "Доля успешных", proof_profit: "Условный результат (база 10 €)",
      proof_note: "Показатели рассчитаны по официально завершённым отборам. Прошлые показатели не гарантируют будущих результатов.",

      verdicts_title: "Последние решения Совета",
      pick_title: "Бесплатный выбор дня", badge_free: "Бесплатно",

      capture_title: "Получайте бесплатный выбор дня каждое утро на почту",
      capture_sub: "Без спама и без банковской карты — только выбор дня и проверенные результаты.",
      capture_ph: "vy@primer.com", capture_btn: "Подписаться",

      plan_free: "БЕСПЛАТНО", plan_free_1: "Бесплатный выбор дня",
      plan_free_2: "Открытые результаты", plan_free_3: "Без банковской карты",
      plan_std: "STANDARD", plan_std_1: "До 3 отборов в день",
      plan_std_2: "Минимум 4 из 5 ИИ согласны по тоталу больше/меньше 2,5",
      plan_prem: "PREMIUM", plan_prem_1: "До 10 отборов в день",
      plan_prem_2: "Минимум 4 из 5 ИИ согласны · включает Standard",
      plan_nocommit: "Без обязательств", plan_popular: "Выбирают чаще всего",
      plan_month: "/месяц",
      plan_btn_std: "Выбрать Standard", plan_btn_prem: "Выбрать Premium",
      plans_note: "Указанные объёмы являются максимальными. Фактическое количество отборов зависит от числа матчей, отвечающих критериям Совета.<br>Уровень уверенности — это внутренний аналитический показатель. Исход спортивного события остаётся неопределённым.",

      method_title: "Как это работает?", method_see: "Смотреть метод",
      method_1t: "Сбор данных",
      method_1d: "Hermès проверяет каждый показатель по нескольким источникам.",
      method_2t: "ИИ анализируют независимо",
      method_2d: "Perplexity, DeepSeek, Mistral, Cohere и Qwen голосуют.",
      method_3t: "Совет рассчитывает оценку",
      method_3d: "Публикуется, только если согласованность превышает порог.",

      recent_title: "Последние результаты", see_all: "Показать всё →",
      std_yesterday: "Что получил Standard вчера",
      th_match: "Матч", th_sel: "Выбор", th_res: "Рез.", th_odd: "Коэф.",

      partners_title: "Наши партнёры с лицензией ANJ",
      partners_sub: "Переходя по нашим ссылкам, вы поддерживаете сайт — без доплаты с вашей стороны.",
      partners_legal: "18+ · Ответственная игра · Открытие счёта у партнёра не гарантирует никакого выигрыша.",

      foot_tag: "Спортивный Совет ИИ на службе вашей аналитики.",
      foot_nav: "Навигация", foot_legal: "Правовая информация",

      login_title: "Вход для участников",
      login_sub: "Введите email и код доступа, полученный по почте после оплаты.",
      login_email: "Email", login_code: "Код доступа", login_btn: "Войти →",
    },

    zh: {
      nav_analyses: "分析", nav_live: "AI 实时", nav_results: "战绩",
      nav_bankroll: "资金管理", nav_method: "方法", nav_plans: "价格",
      nav_login: "登录", nav_signup: "免费注册",
      lang_label: "语言",

      hero_badge: "体育 AI 评议会",
      hero_title: "多个人工智能同时分析。<br><span class=\"grad\">评议会筛选出共识最强的结论。</span>",
      hero_sub: "TousLesMatchs 结合体育数据与多个独立 AI 的投票，按置信度对分析结果进行排序。",
      hero_cta1: "查看实时比赛", hero_cta2: "免费注册",
      hero_r1: "✓ 战绩公开", hero_r2: "✓ 数据可核查",
      hero_r3: "✓ 无需长期承诺",

      live_now: "进行中的比赛", live_upcoming: "即将开始 — 赛程",
      live_all: "查看全部比赛 →", loading: "加载中…",

      proof_total: "已结算分析", proof_wl: "命中 / 未命中",
      proof_winrate: "命中率", proof_profit: "模拟结果（基准 10 欧元）",
      proof_note: "数据基于已正式结算的分析计算。过往表现不代表未来结果。",

      verdicts_title: "评议会最新结论",
      pick_title: "每日免费推荐", badge_free: "免费",

      capture_title: "每天早上通过邮件接收免费推荐",
      capture_sub: "无垃圾邮件，无需银行卡 —— 只有当日推荐和已核查的结果。",
      capture_ph: "you@example.com", capture_btn: "订阅",

      plan_free: "免费", plan_free_1: "每日免费推荐",
      plan_free_2: "战绩公开", plan_free_3: "无需银行卡",
      plan_std: "STANDARD", plan_std_1: "每天最多 3 条分析",
      plan_std_2: "至少 5 个 AI 中有 4 个对大/小 2.5 球达成一致",
      plan_prem: "PREMIUM", plan_prem_1: "每天最多 10 条分析",
      plan_prem_2: "至少 5 个 AI 中有 4 个达成一致 · 包含 Standard",
      plan_nocommit: "无需长期承诺", plan_popular: "最多人选择",
      plan_month: "/月",
      plan_btn_std: "选择 Standard", plan_btn_prem: "选择 Premium",
      plans_note: "所示数量为上限。实际分析数量取决于有多少场比赛达到评议会的标准。<br>置信度为内部分析指标。体育赛事的结果始终存在不确定性。",

      method_title: "运作方式", method_see: "查看方法",
      method_1t: "采集数据",
      method_1d: "Hermès 会在多个来源核对每一项数据。",
      method_2t: "各 AI 独立分析",
      method_2d: "Perplexity、DeepSeek、Mistral、Cohere 和 Qwen 分别投票。",
      method_3t: "评议会计算得分",
      method_3d: "只有共识超过阈值时才会发布。",

      recent_title: "近期结果", see_all: "查看全部 →",
      std_yesterday: "Standard 昨日收到的内容",
      th_match: "比赛", th_sel: "分析", th_res: "结果", th_odd: "赔率",

      partners_title: "我们持有 ANJ 牌照的合作方",
      partners_sub: "通过我们的链接访问即是对本站的支持 —— 您无需支付任何额外费用。",
      partners_legal: "18+ · 理性娱乐 · 在合作方开设账户不保证任何收益。",

      foot_tag: "体育 AI 评议会，为您的分析服务。",
      foot_nav: "导航", foot_legal: "法律信息",

      login_title: "会员登录",
      login_sub: "请输入您的邮箱和付款后通过邮件收到的访问码。",
      login_email: "邮箱", login_code: "访问码", login_btn: "进入 →",
    },
  };

  const LANG_NAMES = {
    fr: "Français", en: "English", es: "Español",
    pt: "Português", ru: "Русский", zh: "中文",
  };

  const STORAGE_KEY = "tlm_lang";
  let lang = "fr";

  function detect() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && translations[saved]) return saved;
    } catch (e) { /* localStorage indisponible (mode prive) : on suit le navigateur */ }
    const nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
    return translations[nav] ? nav : "fr";
  }

  function apply() {
    const dict = translations[lang] || translations.fr;
    const fallback = translations.fr;
    // Une cle absente de la langue courante retombe sur le francais plutot que
    // d'afficher la cle brute — un texte en francais reste comprehensible,
    // "plan_btn_std" ne l'est pas.
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      const k = el.getAttribute("data-i18n");
      const v = dict[k] !== undefined ? dict[k] : fallback[k];
      if (v !== undefined) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      const k = el.getAttribute("data-i18n-html");
      const v = dict[k] !== undefined ? dict[k] : fallback[k];
      if (v !== undefined) el.innerHTML = v;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      const k = el.getAttribute("data-i18n-ph");
      const v = dict[k] !== undefined ? dict[k] : fallback[k];
      if (v !== undefined) el.setAttribute("placeholder", v);
    });
    document.documentElement.setAttribute("lang", lang);
    const cur = document.getElementById("lang-current");
    if (cur) cur.textContent = LANG_NAMES[lang] || lang;
  }

  return {
    languages: LANG_NAMES,
    current: function () { return lang; },
    t: function (key) {
      const dict = translations[lang] || translations.fr;
      return dict[key] !== undefined ? dict[key] : (translations.fr[key] || key);
    },
    setLang: function (l) {
      lang = translations[l] ? l : "fr";
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
      apply();
    },
    init: function () { lang = detect(); apply(); },
  };
})();

document.addEventListener("DOMContentLoaded", function () { i18n.init(); });
