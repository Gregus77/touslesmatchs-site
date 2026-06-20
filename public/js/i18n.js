// TousLesMatchs — i18n system
// Usage: include this script, call i18n.init() on DOMContentLoaded
// Mark elements with data-i18n="key" for text, data-i18n-ph="key" for placeholder

const I18N = {
  fr: {
    nav_home:"Accueil", nav_historique:"Historique", nav_preuves:"Preuves", nav_live:"Live IA",
    nav_join:"Abonnements", nav_cta:"Commencer →", nav_connect:"Se connecter",
    mm_home:"🏠 Accueil", mm_hist:"📊 Historique", mm_preuves:"🏆 Preuves de gains", mm_live:"🔴 Live IA",
    mm_join:"Rejoindre → dès 1€",
    pick_today:"Pick du jour", pick_analysis:"Analyse pré-match", pick_request:"Demander l'analyse IA →",
    pick_logged_only:"Réservé aux membres — connecte-toi pour accéder à l'analyse complète.",
    tg_join:"📲 Rejoins nos groupes Telegram",
    tg_sub:"Reçois chaque pick en temps réel directement sur ton téléphone.",
    tg_free:"📢 Gratuit — Canal public", tg_pro:"⚡ Pro — Picks premium", tg_elite:"👑 Elite — Picks VIP + Live IA",
    hist_title:"Historique des picks",
    hist_sub:"Tous les picks publiés depuis le lancement — résultats vérifiables, aucun pick caché.",
    filter_all:"Tous", filter_football:"⚽ Football", filter_basketball:"🏀 NBA", filter_baseball:"⚾ Baseball",
    filter_today:"Aujourd'hui", filter_week:"Cette semaine", filter_month:"Ce mois",
    stat_wins:"Picks gagnants", stat_winrate:"Taux de réussite", stat_profit:"Profit total",
    stat_total:"Picks total", stat_streak:"Série max",
    preuves_title:"Preuves de gains",
    preuves_sub:"Transparence totale — chaque pick est documenté, chaque résultat vérifiable.",
    live_title:"Live IA — Matchs en direct",
    live_sub:"Le Concile analyse chaque match en temps réel.",
    no_match:"Aucun match en direct", no_match_sub:"Reviens plus tard ou actualise la page.",
    refresh:"⟳ Actualiser",
    plans_title:"Choisissez votre plan",
    paywall_title:"Réservé aux membres Premium",
    paywall_sub:"L'analyse du Concile est disponible à partir du plan Pro.",
    paywall_cta:"Voir les abonnements →",
    login_title:"Accès membre", login_sub:"Entre ton email et ton code d'accès.",
    login_email:"Email", login_code:"Code d'accès", login_btn:"Accéder →",
    logout:"Déconnexion",
  },
  en: {
    nav_home:"Home", nav_historique:"History", nav_preuves:"Proof", nav_live:"Live AI",
    nav_join:"Plans", nav_cta:"Get started →", nav_connect:"Sign in",
    mm_home:"🏠 Home", mm_hist:"📊 History", mm_preuves:"🏆 Proof of gains", mm_live:"🔴 Live AI",
    mm_join:"Join → from €1",
    pick_today:"Pick of the day", pick_analysis:"Pre-match analysis", pick_request:"Request AI analysis →",
    pick_logged_only:"Members only — sign in to access the full analysis.",
    tg_join:"📲 Join our Telegram groups",
    tg_sub:"Receive each pick in real time directly on your phone.",
    tg_free:"📢 Free — Public channel", tg_pro:"⚡ Pro — Premium picks", tg_elite:"👑 Elite — VIP picks + Live AI",
    hist_title:"Picks history",
    hist_sub:"All picks published since launch — verifiable results, no hidden picks.",
    filter_all:"All", filter_football:"⚽ Football", filter_basketball:"🏀 NBA", filter_baseball:"⚾ Baseball",
    filter_today:"Today", filter_week:"This week", filter_month:"This month",
    stat_wins:"Winning picks", stat_winrate:"Win rate", stat_profit:"Total profit",
    stat_total:"Total picks", stat_streak:"Best streak",
    preuves_title:"Proof of gains",
    preuves_sub:"Full transparency — every pick is documented, every result verifiable.",
    live_title:"Live AI — Live matches",
    live_sub:"The Council analyzes each match in real time.",
    no_match:"No live matches", no_match_sub:"Check back later or refresh.",
    refresh:"⟳ Refresh",
    plans_title:"Choose your plan",
    paywall_title:"Premium members only",
    paywall_sub:"Council analysis is available from the Pro plan.",
    paywall_cta:"See plans →",
    login_title:"Member access", login_sub:"Enter your email and access code.",
    login_email:"Email", login_code:"Access code", login_btn:"Access →",
    logout:"Sign out",
  },
  es: {
    nav_home:"Inicio", nav_historique:"Historial", nav_preuves:"Pruebas", nav_live:"Live IA",
    nav_join:"Planes", nav_cta:"Empezar →", nav_connect:"Conectarse",
    mm_home:"🏠 Inicio", mm_hist:"📊 Historial", mm_preuves:"🏆 Pruebas de ganancias", mm_live:"🔴 Live IA",
    mm_join:"Unirse → desde 1€",
    pick_today:"Pick del día", pick_analysis:"Análisis pre-partido", pick_request:"Solicitar análisis IA →",
    pick_logged_only:"Solo para miembros — inicia sesión para acceder al análisis completo.",
    tg_join:"📲 Únete a nuestros grupos de Telegram",
    tg_sub:"Recibe cada pick en tiempo real directamente en tu teléfono.",
    tg_free:"📢 Gratis — Canal público", tg_pro:"⚡ Pro — Picks premium", tg_elite:"👑 Elite — Picks VIP + Live IA",
    hist_title:"Historial de picks",
    hist_sub:"Todos los picks publicados desde el lanzamiento — resultados verificables.",
    filter_all:"Todos", filter_football:"⚽ Fútbol", filter_basketball:"🏀 NBA", filter_baseball:"⚾ Béisbol",
    filter_today:"Hoy", filter_week:"Esta semana", filter_month:"Este mes",
    stat_wins:"Picks ganadores", stat_winrate:"Tasa de acierto", stat_profit:"Beneficio total",
    stat_total:"Total picks", stat_streak:"Mejor racha",
    preuves_title:"Pruebas de ganancias",
    preuves_sub:"Transparencia total — cada pick documentado, cada resultado verificable.",
    live_title:"Live IA — Partidos en directo",
    live_sub:"El Concilio analiza cada partido en tiempo real.",
    no_match:"Sin partidos en directo", no_match_sub:"Vuelve más tarde o actualiza.",
    refresh:"⟳ Actualizar",
    plans_title:"Elige tu plan",
    paywall_title:"Solo para miembros Premium",
    paywall_sub:"El análisis del Concilio está disponible a partir del plan Pro.",
    paywall_cta:"Ver planes →",
    login_title:"Acceso de miembro", login_sub:"Introduce tu email y código de acceso.",
    login_email:"Email", login_code:"Código de acceso", login_btn:"Acceder →",
    logout:"Cerrar sesión",
  },
  pt: {
    nav_home:"Início", nav_historique:"Histórico", nav_preuves:"Provas", nav_live:"Live IA",
    nav_join:"Planos", nav_cta:"Começar →", nav_connect:"Conectar",
    mm_home:"🏠 Início", mm_hist:"📊 Histórico", mm_preuves:"🏆 Provas de ganhos", mm_live:"🔴 Live IA",
    mm_join:"Entrar → a partir de 1€",
    pick_today:"Pick do dia", pick_analysis:"Análise pré-jogo", pick_request:"Solicitar análise IA →",
    pick_logged_only:"Apenas para membros — faça login para aceder à análise completa.",
    tg_join:"📲 Junte-se aos nossos grupos Telegram",
    tg_sub:"Receba cada pick em tempo real no seu telemóvel.",
    tg_free:"📢 Grátis — Canal público", tg_pro:"⚡ Pro — Picks premium", tg_elite:"👑 Elite — Picks VIP + Live IA",
    hist_title:"Histórico de picks", hist_sub:"Todos os picks publicados desde o lançamento.",
    filter_all:"Todos", filter_football:"⚽ Futebol", filter_basketball:"🏀 NBA", filter_baseball:"⚾ Beisebol",
    filter_today:"Hoje", filter_week:"Esta semana", filter_month:"Este mês",
    stat_wins:"Picks vencedores", stat_winrate:"Taxa de acerto", stat_profit:"Lucro total",
    stat_total:"Total picks", stat_streak:"Melhor sequência",
    preuves_title:"Provas de ganhos", preuves_sub:"Transparência total.",
    live_title:"Live IA — Jogos ao vivo", live_sub:"O Concílio analisa cada jogo em tempo real.",
    no_match:"Nenhum jogo ao vivo", no_match_sub:"Volte mais tarde ou atualize.",
    refresh:"⟳ Atualizar", plans_title:"Escolha o seu plano",
    paywall_title:"Apenas para membros Premium", paywall_sub:"A análise do Concílio está disponível a partir do plano Pro.",
    paywall_cta:"Ver planos →", login_title:"Acesso de membro", login_sub:"Introduza o seu email e código.",
    login_email:"Email", login_code:"Código de acesso", login_btn:"Aceder →", logout:"Sair",
  },
  de: {
    nav_home:"Startseite", nav_historique:"Verlauf", nav_preuves:"Beweise", nav_live:"Live KI",
    nav_join:"Abos", nav_cta:"Loslegen →", nav_connect:"Anmelden",
    mm_home:"🏠 Startseite", mm_hist:"📊 Verlauf", mm_preuves:"🏆 Gewinnbeweise", mm_live:"🔴 Live KI",
    mm_join:"Beitreten → ab 1€",
    pick_today:"Tages-Pick", pick_analysis:"Vorspiel-Analyse", pick_request:"KI-Analyse anfordern →",
    pick_logged_only:"Nur für Mitglieder — melde dich an für die vollständige Analyse.",
    tg_join:"📲 Unseren Telegram-Gruppen beitreten",
    tg_sub:"Erhalte jeden Pick in Echtzeit auf dein Handy.",
    tg_free:"📢 Kostenlos — Öffentlicher Kanal", tg_pro:"⚡ Pro — Premium Picks", tg_elite:"👑 Elite — VIP Picks + Live KI",
    hist_title:"Pick-Verlauf", hist_sub:"Alle veröffentlichten Picks seit dem Start.",
    filter_all:"Alle", filter_football:"⚽ Fußball", filter_basketball:"🏀 NBA", filter_baseball:"⚾ Baseball",
    filter_today:"Heute", filter_week:"Diese Woche", filter_month:"Diesen Monat",
    stat_wins:"Gewinnende Picks", stat_winrate:"Trefferquote", stat_profit:"Gesamtgewinn",
    stat_total:"Picks gesamt", stat_streak:"Beste Serie",
    preuves_title:"Gewinnbeweise", preuves_sub:"Volle Transparenz.",
    live_title:"Live KI — Live-Spiele", live_sub:"Das Konzil analysiert jedes Spiel in Echtzeit.",
    no_match:"Keine Live-Spiele", no_match_sub:"Komm später zurück oder aktualisiere.",
    refresh:"⟳ Aktualisieren", plans_title:"Wähle deinen Plan",
    paywall_title:"Nur für Premium-Mitglieder", paywall_sub:"Die Konzil-Analyse ist ab dem Pro-Plan verfügbar.",
    paywall_cta:"Pläne ansehen →", login_title:"Mitgliederzugang", login_sub:"Gib deine E-Mail und deinen Zugangscode ein.",
    login_email:"E-Mail", login_code:"Zugangscode", login_btn:"Zugang →", logout:"Abmelden",
  },
  it: {
    nav_home:"Home", nav_historique:"Storico", nav_preuves:"Prove", nav_live:"Live IA",
    nav_join:"Piani", nav_cta:"Inizia →", nav_connect:"Accedi",
    mm_home:"🏠 Home", mm_hist:"📊 Storico", mm_preuves:"🏆 Prove di guadagno", mm_live:"🔴 Live IA",
    mm_join:"Iscriviti → da 1€",
    pick_today:"Pick del giorno", pick_analysis:"Analisi pre-partita", pick_request:"Richiedi analisi IA →",
    pick_logged_only:"Solo per membri — accedi per l'analisi completa.",
    tg_join:"📲 Unisciti ai nostri gruppi Telegram",
    tg_sub:"Ricevi ogni pick in tempo reale direttamente sul tuo telefono.",
    tg_free:"📢 Gratuito — Canale pubblico", tg_pro:"⚡ Pro — Pick premium", tg_elite:"👑 Elite — Pick VIP + Live IA",
    hist_title:"Storico dei pick", hist_sub:"Tutti i pick pubblicati dall'inizio.",
    filter_all:"Tutti", filter_football:"⚽ Calcio", filter_basketball:"🏀 NBA", filter_baseball:"⚾ Baseball",
    filter_today:"Oggi", filter_week:"Questa settimana", filter_month:"Questo mese",
    stat_wins:"Pick vincenti", stat_winrate:"Tasso di successo", stat_profit:"Profitto totale",
    stat_total:"Pick totali", stat_streak:"Serie migliore",
    preuves_title:"Prove di guadagno", preuves_sub:"Trasparenza totale.",
    live_title:"Live IA — Partite in diretta", live_sub:"Il Concilio analizza ogni partita in tempo reale.",
    no_match:"Nessuna partita in diretta", no_match_sub:"Torna più tardi o aggiorna.",
    refresh:"⟳ Aggiorna", plans_title:"Scegli il tuo piano",
    paywall_title:"Solo per membri Premium", paywall_sub:"L'analisi del Concilio è disponibile dal piano Pro.",
    paywall_cta:"Vedi piani →", login_title:"Accesso membro", login_sub:"Inserisci la tua email e il codice di accesso.",
    login_email:"Email", login_code:"Codice di accesso", login_btn:"Accedi →", logout:"Esci",
  },
  nl: {
    nav_home:"Startpagina", nav_historique:"Geschiedenis", nav_preuves:"Bewijzen", nav_live:"Live AI",
    nav_join:"Abonnementen", nav_cta:"Beginnen →", nav_connect:"Inloggen",
    mm_home:"🏠 Startpagina", mm_hist:"📊 Geschiedenis", mm_preuves:"🏆 Winstbewijzen", mm_live:"🔴 Live AI",
    mm_join:"Meedoen → vanaf €1",
    pick_today:"Pick van de dag", pick_analysis:"Pre-match analyse", pick_request:"AI-analyse aanvragen →",
    pick_logged_only:"Alleen voor leden — log in voor de volledige analyse.",
    tg_join:"📲 Word lid van onze Telegram-groepen",
    tg_sub:"Ontvang elke pick in realtime op je telefoon.",
    tg_free:"📢 Gratis — Publiek kanaal", tg_pro:"⚡ Pro — Premium picks", tg_elite:"👑 Elite — VIP picks + Live AI",
    hist_title:"Picks geschiedenis", hist_sub:"Alle picks gepubliceerd sinds de lancering.",
    filter_all:"Alle", filter_football:"⚽ Voetbal", filter_basketball:"🏀 NBA", filter_baseball:"⚾ Honkbal",
    filter_today:"Vandaag", filter_week:"Deze week", filter_month:"Deze maand",
    stat_wins:"Winnende picks", stat_winrate:"Slagingspercentage", stat_profit:"Totale winst",
    stat_total:"Totaal picks", stat_streak:"Beste reeks",
    preuves_title:"Winstbewijzen", preuves_sub:"Volledige transparantie.",
    live_title:"Live AI — Live wedstrijden", live_sub:"De Raad analyseert elke wedstrijd in realtime.",
    no_match:"Geen live wedstrijden", no_match_sub:"Kom later terug of ververs.",
    refresh:"⟳ Vernieuwen", plans_title:"Kies uw plan",
    paywall_title:"Alleen voor Premium-leden", paywall_sub:"Raadsanalyse beschikbaar vanaf Pro-plan.",
    paywall_cta:"Plannen bekijken →", login_title:"Ledentoegang", login_sub:"Voer je e-mail en toegangscode in.",
    login_email:"E-mail", login_code:"Toegangscode", login_btn:"Toegang →", logout:"Uitloggen",
  },
  tr: {
    nav_home:"Ana Sayfa", nav_historique:"Geçmiş", nav_preuves:"Kanıtlar", nav_live:"Canlı YZ",
    nav_join:"Planlar", nav_cta:"Başla →", nav_connect:"Giriş Yap",
    mm_home:"🏠 Ana Sayfa", mm_hist:"📊 Geçmiş", mm_preuves:"🏆 Kazanç Kanıtları", mm_live:"🔴 Canlı YZ",
    mm_join:"Katıl → 1€'dan itibaren",
    pick_today:"Günün Seçimi", pick_analysis:"Maç Öncesi Analiz", pick_request:"YZ Analizi İste →",
    pick_logged_only:"Sadece üyeler için — tam analize erişmek için giriş yapın.",
    tg_join:"📲 Telegram Gruplarımıza Katıl",
    tg_sub:"Her seçimi gerçek zamanlı olarak telefonuna al.",
    tg_free:"📢 Ücretsiz — Açık Kanal", tg_pro:"⚡ Pro — Premium Seçimler", tg_elite:"👑 Elite — VIP Seçimler + Canlı YZ",
    hist_title:"Seçim Geçmişi", hist_sub:"Başlangıçtan bu yana tüm yayınlanan seçimler.",
    filter_all:"Tümü", filter_football:"⚽ Futbol", filter_basketball:"🏀 NBA", filter_baseball:"⚾ Beyzbol",
    filter_today:"Bugün", filter_week:"Bu Hafta", filter_month:"Bu Ay",
    stat_wins:"Kazanan Seçimler", stat_winrate:"Başarı Oranı", stat_profit:"Toplam Kâr",
    stat_total:"Toplam Seçim", stat_streak:"En Uzun Seri",
    preuves_title:"Kazanç Kanıtları", preuves_sub:"Tam şeffaflık.",
    live_title:"Canlı YZ — Canlı Maçlar", live_sub:"Konsey her maçı gerçek zamanlı analiz eder.",
    no_match:"Canlı maç yok", no_match_sub:"Daha sonra kontrol edin veya yenileyin.",
    refresh:"⟳ Yenile", plans_title:"Planınızı Seçin",
    paywall_title:"Sadece Premium Üyeler", paywall_sub:"Konsey analizi Pro planından itibaren mevcuttur.",
    paywall_cta:"Planları Gör →", login_title:"Üye Girişi", login_sub:"E-postanızı ve erişim kodunuzu girin.",
    login_email:"E-posta", login_code:"Erişim Kodu", login_btn:"Erişim →", logout:"Çıkış",
  },
  ru: {
    nav_home:"Главная", nav_historique:"История", nav_preuves:"Доказательства", nav_live:"Live ИИ",
    nav_join:"Планы", nav_cta:"Начать →", nav_connect:"Войти",
    mm_home:"🏠 Главная", mm_hist:"📊 История", mm_preuves:"🏆 Доказательства выигрышей", mm_live:"🔴 Live ИИ",
    mm_join:"Вступить → от 1€",
    pick_today:"Выбор дня", pick_analysis:"Предматчевый анализ", pick_request:"Запросить анализ ИИ →",
    pick_logged_only:"Только для членов — войдите для полного анализа.",
    tg_join:"📲 Присоединяйтесь к нашим Telegram-группам",
    tg_sub:"Получайте каждый выбор в реальном времени на свой телефон.",
    tg_free:"📢 Бесплатно — Публичный канал", tg_pro:"⚡ Pro — Премиум пики", tg_elite:"👑 Elite — VIP пики + Live ИИ",
    hist_title:"История пиков", hist_sub:"Все пики с момента запуска.",
    filter_all:"Все", filter_football:"⚽ Футбол", filter_basketball:"🏀 НБА", filter_baseball:"⚾ Бейсбол",
    filter_today:"Сегодня", filter_week:"На этой неделе", filter_month:"В этом месяце",
    stat_wins:"Выигрышные пики", stat_winrate:"Процент побед", stat_profit:"Общая прибыль",
    stat_total:"Всего пиков", stat_streak:"Лучшая серия",
    preuves_title:"Доказательства выигрышей", preuves_sub:"Полная прозрачность.",
    live_title:"Live ИИ — Прямые трансляции", live_sub:"Совет анализирует каждый матч в реальном времени.",
    no_match:"Нет прямых трансляций", no_match_sub:"Вернитесь позже или обновите.",
    refresh:"⟳ Обновить", plans_title:"Выберите план",
    paywall_title:"Только для Premium-участников", paywall_sub:"Анализ Совета доступен от плана Pro.",
    paywall_cta:"Смотреть планы →", login_title:"Доступ для членов", login_sub:"Введите email и код доступа.",
    login_email:"Email", login_code:"Код доступа", login_btn:"Доступ →", logout:"Выйти",
  },
  zh: {
    nav_home:"主页", nav_historique:"历史", nav_preuves:"证明", nav_live:"实时AI",
    nav_join:"方案", nav_cta:"开始 →", nav_connect:"登录",
    mm_home:"🏠 主页", mm_hist:"📊 历史记录", mm_preuves:"🏆 盈利证明", mm_live:"🔴 实时AI",
    mm_join:"加入 → 低至1€",
    pick_today:"今日推荐", pick_analysis:"赛前分析", pick_request:"请求AI分析 →",
    pick_logged_only:"仅限会员 — 登录以访问完整分析。",
    tg_join:"📲 加入我们的Telegram群组",
    tg_sub:"实时接收每个推荐直接到您的手机。",
    tg_free:"📢 免费 — 公共频道", tg_pro:"⚡ Pro — 高级推荐", tg_elite:"👑 Elite — VIP推荐 + 实时AI",
    hist_title:"推荐历史", hist_sub:"自上线以来发布的所有推荐。",
    filter_all:"全部", filter_football:"⚽ 足球", filter_basketball:"🏀 NBA", filter_baseball:"⚾ 棒球",
    filter_today:"今天", filter_week:"本周", filter_month:"本月",
    stat_wins:"获胜推荐", stat_winrate:"胜率", stat_profit:"总利润",
    stat_total:"总推荐", stat_streak:"最长连胜",
    preuves_title:"盈利证明", preuves_sub:"完全透明。",
    live_title:"实时AI — 直播比赛", live_sub:"委员会实时分析每场比赛。",
    no_match:"暂无直播比赛", no_match_sub:"稍后再来或刷新页面。",
    refresh:"⟳ 刷新", plans_title:"选择您的计划",
    paywall_title:"仅限Premium会员", paywall_sub:"委员会分析从Pro计划起可用。",
    paywall_cta:"查看计划 →", login_title:"会员访问", login_sub:"输入您的电子邮件和访问代码。",
    login_email:"电子邮件", login_code:"访问代码", login_btn:"访问 →", logout:"退出",
  },
  ar: {
    nav_home:"الرئيسية", nav_historique:"السجل", nav_preuves:"الإثباتات", nav_live:"مباشر AI",
    nav_join:"الخطط", nav_cta:"ابدأ →", nav_connect:"تسجيل الدخول",
    mm_home:"🏠 الرئيسية", mm_hist:"📊 السجل", mm_preuves:"🏆 إثبات الأرباح", mm_live:"🔴 مباشر AI",
    mm_join:"الانضمام → من €1",
    pick_today:"اختيار اليوم", pick_analysis:"تحليل ما قبل المباراة", pick_request:"طلب تحليل AI →",
    pick_logged_only:"للأعضاء فقط — سجّل دخولك للوصول للتحليل الكامل.",
    tg_join:"📲 انضم إلى مجموعات Telegram",
    tg_sub:"استقبل كل اختيار في الوقت الفعلي على هاتفك.",
    tg_free:"📢 مجاني — قناة عامة", tg_pro:"⚡ Pro — اختيارات مميزة", tg_elite:"👑 Elite — اختيارات VIP + مباشر AI",
    hist_title:"سجل الاختيارات", hist_sub:"جميع الاختيارات المنشورة منذ الإطلاق.",
    filter_all:"الكل", filter_football:"⚽ كرة القدم", filter_basketball:"🏀 NBA", filter_baseball:"⚾ البيسبول",
    filter_today:"اليوم", filter_week:"هذا الأسبوع", filter_month:"هذا الشهر",
    stat_wins:"الاختيارات الرابحة", stat_winrate:"نسبة الفوز", stat_profit:"إجمالي الربح",
    stat_total:"إجمالي الاختيارات", stat_streak:"أفضل سلسلة",
    preuves_title:"إثبات الأرباح", preuves_sub:"شفافية كاملة.",
    live_title:"مباشر AI — المباريات الحية", live_sub:"يحلّل المجلس كل مباراة في الوقت الفعلي.",
    no_match:"لا توجد مباريات مباشرة", no_match_sub:"عد لاحقاً أو أعد التحميل.",
    refresh:"⟳ تحديث", plans_title:"اختر خطتك",
    paywall_title:"للأعضاء المميزين فقط", paywall_sub:"تحليل المجلس متاح من خطة Pro.",
    paywall_cta:"عرض الخطط →", login_title:"وصول الأعضاء", login_sub:"أدخل بريدك الإلكتروني ورمز الوصول.",
    login_email:"البريد الإلكتروني", login_code:"رمز الوصول", login_btn:"الوصول →", logout:"تسجيل الخروج",
  },
};

const LANG_META = {
  fr:{ flag:"🇫🇷", label:"FR", dir:"ltr" },
  en:{ flag:"🇬🇧", label:"EN", dir:"ltr" },
  es:{ flag:"🇪🇸", label:"ES", dir:"ltr" },
  pt:{ flag:"🇵🇹", label:"PT", dir:"ltr" },
  de:{ flag:"🇩🇪", label:"DE", dir:"ltr" },
  it:{ flag:"🇮🇹", label:"IT", dir:"ltr" },
  nl:{ flag:"🇳🇱", label:"NL", dir:"ltr" },
  tr:{ flag:"🇹🇷", label:"TR", dir:"ltr" },
  ru:{ flag:"🇷🇺", label:"RU", dir:"ltr" },
  zh:{ flag:"🇨🇳", label:"ZH", dir:"ltr" },
  ar:{ flag:"🇸🇦", label:"AR", dir:"rtl" },
};

const i18n = {
  current: "fr",
  t(key){ return (I18N[this.current] || I18N.fr)[key] || (I18N.fr[key] || key); },
  apply(){
    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-html]").forEach(el => {
      el.innerHTML = this.t(el.dataset.i18nHtml);
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => {
      el.placeholder = this.t(el.dataset.i18nPh);
    });
    const meta = LANG_META[this.current] || LANG_META.fr;
    document.documentElement.lang = this.current;
    document.documentElement.dir = meta.dir;
    // Update active state in picker
    document.querySelectorAll(".lang-opt").forEach(b => {
      b.classList.toggle("active", b.dataset.lang === this.current);
    });
  },
  set(lang){
    if(!I18N[lang]) return;
    this.current = lang;
    localStorage.setItem("tlm_lang", lang);
    // Ferme le picker immédiatement avant tout re-render
    const p = document.getElementById("lang-picker");
    if(p) p.classList.remove("open");
    this.apply();
    this.updateToggleBtn();
    if(typeof render === "function") render();
    if(typeof renderMain === "function") renderMain();
  },
  detect(){
    const saved = localStorage.getItem("tlm_lang");
    if(saved && I18N[saved]){ this.current = saved; return; }
    const browser = (navigator.language || "fr").slice(0,2).toLowerCase();
    this.current = I18N[browser] ? browser : "fr";
  },
  picker(){
    const langs = Object.keys(LANG_META);
    const cur = LANG_META[this.current];
    return `<div class="lang-picker" id="lang-picker">
      <button class="lang-toggle" id="lang-toggle-btn">
        <span class="lang-flag">${cur.flag}</span>
        <span class="lang-label">${cur.label}</span>
        <span class="lang-arrow">▾</span>
      </button>
      <div class="lang-dropdown" id="lang-dropdown">
        ${langs.map(l=>`<button class="lang-opt${l===this.current?' active':''}" data-lang="${l}">${LANG_META[l].flag} ${LANG_META[l].label}</button>`).join('')}
      </div>
    </div>`;
  },
  updateToggleBtn(){
    const btn = document.getElementById("lang-toggle-btn");
    if(!btn) return;
    const cur = LANG_META[this.current];
    btn.querySelector(".lang-flag").textContent = cur.flag;
    btn.querySelector(".lang-label").textContent = cur.label;
  },
  init(){
    this.detect();
    if(!document.getElementById("i18n-style")){
      const s = document.createElement("style");
      s.id = "i18n-style";
      s.textContent = `
        .lang-picker{position:relative;display:inline-block}
        .lang-toggle{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--text,#eceaf4);border-radius:8px;padding:5px 10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;user-select:none}
        .lang-toggle:hover{background:rgba(255,255,255,.1)}
        .lang-arrow{font-size:10px;opacity:.6;transition:transform .2s}
        .lang-picker.open .lang-arrow{transform:rotate(180deg)}
        .lang-dropdown{display:none;position:absolute;top:calc(100% + 8px);right:0;background:#0d1020;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:6px;min-width:140px;box-shadow:0 20px 50px rgba(0,0,0,.7);z-index:9999;grid-template-columns:1fr 1fr;gap:3px}
        .lang-picker.open .lang-dropdown{display:grid}
        .lang-opt{background:transparent;border:none;color:#a8aec8;font-size:13px;font-weight:600;padding:7px 10px;border-radius:7px;cursor:pointer;text-align:left;font-family:inherit;transition:all .1s;white-space:nowrap;width:100%}
        .lang-opt:hover{background:rgba(255,255,255,.07);color:#eceaf4}
        .lang-opt.active{background:rgba(99,102,241,.18);color:#818cf8}
      `;
      document.head.appendChild(s);
    }
    const target = document.getElementById("lang-picker-slot");
    if(target){
      target.innerHTML = this.picker();
      // Toggle on button click
      document.getElementById("lang-toggle-btn").addEventListener("click", e => {
        e.stopPropagation();
        document.getElementById("lang-picker").classList.toggle("open");
      });
      // Select language on option click
      target.querySelectorAll(".lang-opt").forEach(btn => {
        btn.addEventListener("click", e => {
          e.stopPropagation();
          const lang = btn.dataset.lang;
          i18n.set(lang);
          document.getElementById("lang-picker").classList.remove("open");
          // update active state
          target.querySelectorAll(".lang-opt").forEach(b => b.classList.toggle("active", b.dataset.lang === lang));
          i18n.updateToggleBtn();
        });
      });
    }
    this.apply();
  }
};

// Close picker when clicking outside
document.addEventListener("click", () => {
  const p = document.getElementById("lang-picker");
  if(p) p.classList.remove("open");
});
