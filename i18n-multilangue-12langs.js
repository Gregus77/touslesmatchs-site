const i18n = (function(){
  const translations = {
    fr: {
      pick_today: "Analyse du jour",
      nav_join: "Abonnements",
      nav_cta: "Commencer →",
      mm_home: "\u{1F3E0} Accueil",
      mm_hist: "\u{1F4CA} Historique des picks",
      mm_preuves: "\u{1F3C6} Preuves de résultats",
      mm_live: "\u{1F534} Live IA",
      login_title: "Accès membre",
      login_sub: "Entre ton email et ton code d'accès reçu par email après paiement.",
      login_email: "Email",
      login_code: "Code d'accès",
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
      sec_plans_title: "Un plan pour chaque niveau d'ambition",
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
      plan_pro_btn: "S'abonner — 9.90€/mois",
      plan_elite_desc: "30 analyses Live IA par jour + alertes Elite quand le Concile détecte un signal très fort.",
      plan_elite_btn: "S'abonner — 19.90€/mois",
      sec_how_eye: "Méthode",
      sec_how_title: "Le Concile ne devine pas.",
      step1_title: "Collecte vérifiée à 6h00",
      step2_title: "6 agents spécialisés + 1 Chief",
      step3_title: "Diffusion à 7h00",
      step4_title: "Résultats tracés, modèle amélioré",
      foot_text: "Analyse sportive assistée par IA · Données vérifiées · 0 match inventé",
      pick_won: "Gagné",
      pick_lost: "Perdu",
      final_score: "Score final",
      locked_votes: "Votes verrouillés",
      subscribe_cta: "S'abonner pour voir les analyses complètes",
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
      pf_kickoff: "Coup d'envoi dans",
      pf_next: "Prochain pick",
      pf_preview_txt: "L'analyse du Concile sera disponible avant le coup d'envoi.",
      pf_preview_lock: "Réservé aux abonnés Pro & Elite",
      pf_btn: "Voir l'analyse complète",
      pf_hint: "Disponible pour les abonnés Pro et Elite",
      logout: "Déconnexion",
      nav_connect: "Connexion",
      match_done: "Match terminé"
    },
    en: {
      pick_today: "Today's Analysis",
      nav_join: "Subscriptions",
      nav_cta: "Get Started →",
      mm_home: "\u{1F3E0} Home",
      mm_hist: "\u{1F4CA} Pick History",
      mm_preuves: "\u{1F3C6} Proof of Results",
      mm_live: "\u{1F534} Live AI",
      login_title: "Member Access",
      login_sub: "Enter your email and the access code you received by email after payment.",
      login_email: "Email",
      login_code: "Access Code",
      login_btn: "Access →",
      login_required: "Log in to access Live AI",
      login_checking: "Verifying…",
      login_invalid: "Invalid or expired code.",
      login_error: "Connection error. Try again.",
      sec_next_eye: "Council · Live Picks",
      sec_next_title: "Results & Next Pick",
      sec_pick_eye: "Council · today's analysis",
      sec_roi_eye: "Performance",
      sec_roi_title: "Real results · tracked pick by pick",
      lbl_winrate: "Win Rate",
      lbl_picks_month: "Picks Played",
      sec_plans_eye: "Subscriptions",
      sec_plans_title: "A plan for every ambition level",
      sec_plans_sub: "From free pick to full Live AI — immediate access after payment.",
      plan_free_badge: "Free",
      plan_free_name: "Discovery",
      plan_free_desc: "The best AI analysis of the day, visible on the site. No registration needed.",
      plan_free_btn: "See the pick",
      plan_carte_badge: "Pay Per Pick",
      plan_carte_name: "Test",
      plan_carte_desc: "1 credit = 1 full analysis on the match of your choice in Live AI.",
      plan_pop: "Popular",
      plan_pro_desc: "10 Live AI analyses per day + Pro Telegram group. Ideal to follow matches without waiting.",
      plan_pro_btn: "Subscribe — €9.90/month",
      plan_elite_desc: "30 Live AI analyses per day + Elite alerts when the Council detects a very strong signal.",
      plan_elite_btn: "Subscribe — €19.90/month",
      sec_how_eye: "Method",
      sec_how_title: "The Council doesn't guess.",
      step1_title: "Verified collection at 6:00 AM",
      step2_title: "6 specialized agents + 1 Chief",
      step3_title: "Distribution at 7:00 AM",
      step4_title: "Results tracked, model improved",
      foot_text: "AI-assisted sports analysis · Verified data · 0 invented match",
      pick_won: "Won",
      pick_lost: "Lost",
      final_score: "Final score",
      locked_votes: "Locked votes",
      subscribe_cta: "Subscribe to see full analyses",
      bet_at: "Odds",
      live_today: "In progress",
      upcoming: "Upcoming",
      bet_type: "Analysis",
      pick_analysis_lbl: "Analysis",
      consensus: "Consensus",
      avg_odds: "Average odds",
      stake: "Recommended stake",
      see_verdict: "See the verdict",
      pf_live_now: "Live now",
      pf_kickoff: "Kickoff in",
      pf_next: "Next pick",
      pf_preview_txt: "The Council's analysis will be available before kickoff.",
      pf_preview_lock: "Reserved for Pro & Elite subscribers",
      pf_btn: "View full analysis",
      pf_hint: "Available for Pro and Elite subscribers",
      logout: "Log out",
      nav_connect: "Log in",
      match_done: "Match finished"
    },
    es: {
      pick_today: "Análisis del día",
      nav_join: "Suscripciones",
      nav_cta: "Empezar →",
      mm_home: "\u{1F3E0} Inicio",
      mm_hist: "\u{1F4CA} Historial de picks",
      mm_preuves: "\u{1F3C6} Pruebas de resultados",
      mm_live: "\u{1F534} IA en Vivo",
      login_title: "Acceso de miembro",
      login_sub: "Introduce tu email y el código de acceso que recibiste por correo electrónico después del pago.",
      login_email: "Email",
      login_code: "Código de acceso",
      login_btn: "Acceder →",
      login_required: "Conéctate para acceder a la IA en Vivo",
      login_checking: "Verificando…",
      login_invalid: "Código inválido o caducado.",
      login_error: "Error de conexión. Inténtalo de nuevo.",
      sec_next_eye: "Concilio · Picks en directo",
      sec_next_title: "Resultados & Próximo Pick",
      sec_pick_eye: "Concilio · análisis del día",
      sec_roi_eye: "Rendimiento",
      sec_roi_title: "Resultados reales · trazados pick por pick",
      lbl_winrate: "Tasa de acierto",
      lbl_picks_month: "Picks jugados",
      sec_plans_eye: "Suscripciones",
      sec_plans_title: "Un plan para cada nivel de ambición",
      sec_plans_sub: "Del pick gratuito a la IA en Vivo completa — acceso inmediato después del pago.",
      plan_free_badge: "Gratis",
      plan_free_name: "Descubrimiento",
      plan_free_desc: "El mejor análisis IA del día, visible en el sitio. Sin registro.",
      plan_free_btn: "Ver el pick",
      plan_carte_badge: "A la carta",
      plan_carte_name: "Prueba",
      plan_carte_desc: "1 crédito = 1 análisis completo en el partido de tu elección en IA en Vivo.",
      plan_pop: "Popular",
      plan_pro_desc: "10 análisis de IA en Vivo por día + grupo Telegram Pro. Ideal para seguir los partidos sin esperar.",
      plan_pro_btn: "Suscribirse — 9.90€/mes",
      plan_elite_desc: "30 análisis de IA en Vivo por día + alertas Elite cuando el Concilio detecta una señal muy fuerte.",
      plan_elite_btn: "Suscribirse — 19.90€/mes",
      sec_how_eye: "Método",
      sec_how_title: "El Concilio no adivina.",
      step1_title: "Recopilación verificada a las 6:00",
      step2_title: "6 agentes especializados + 1 Chief",
      step3_title: "Publicación a las 7:00",
      step4_title: "Resultados trazados, modelo mejorado",
      foot_text: "Análisis deportivo asistido por IA · Datos verificados · 0 partido inventado",
      pick_won: "Ganado",
      pick_lost: "Perdido",
      final_score: "Resultado final",
      locked_votes: "Votos bloqueados",
      subscribe_cta: "Suscríbete para ver los análisis completos",
      bet_at: "Cuota",
      live_today: "En curso",
      upcoming: "Próximo",
      bet_type: "Análisis",
      pick_analysis_lbl: "Análisis",
      consensus: "Consenso",
      avg_odds: "Cuota media",
      stake: "Apuesta recomendada",
      see_verdict: "Ver el veredicto",
      pf_live_now: "En directo",
      pf_kickoff: "Comienza en",
      pf_next: "Próximo pick",
      pf_preview_txt: "El análisis del Concilio estará disponible antes del comienzo.",
      pf_preview_lock: "Reservado para suscriptores Pro & Elite",
      pf_btn: "Ver el análisis completo",
      pf_hint: "Disponible para suscriptores Pro y Elite",
      logout: "Cerrar sesión",
      nav_connect: "Conectar",
      match_done: "Partido terminado"
    },
    pt: {
      pick_today: "Análise do dia",
      nav_join: "Assinaturas",
      nav_cta: "Começar →",
      mm_home: "\u{1F3E0} Início",
      mm_hist: "\u{1F4CA} Histórico de picks",
      mm_preuves: "\u{1F3C6} Provas de resultados",
      mm_live: "\u{1F534} IA ao Vivo",
      login_title: "Acesso de membro",
      login_sub: "Insere o teu email e o código de acesso recebido por email após o pagamento.",
      login_email: "Email",
      login_code: "Código de acesso",
      login_btn: "Aceder →",
      login_required: "Conecta-te para aceder à IA ao Vivo",
      login_checking: "A verificar…",
      login_invalid: "Código inválido ou expirado.",
      login_error: "Erro de conexão. Tenta novamente.",
      sec_next_eye: "Concílio · Picks ao vivo",
      sec_next_title: "Resultados & Próximo Pick",
      sec_pick_eye: "Concílio · análise do dia",
      sec_roi_eye: "Desempenho",
      sec_roi_title: "Resultados reais · traçados pick por pick",
      lbl_winrate: "Taxa de acerto",
      lbl_picks_month: "Picks jogados",
      sec_plans_eye: "Assinaturas",
      sec_plans_title: "Um plano para cada nível de ambição",
      sec_plans_sub: "Do pick gratuito à IA ao Vivo completa — acesso imediato após pagamento.",
      plan_free_badge: "Grátis",
      plan_free_name: "Descoberta",
      plan_free_desc: "A melhor análise IA do dia, visível no site. Sem registo.",
      plan_free_btn: "Ver o pick",
      plan_carte_badge: "À la carte",
      plan_carte_name: "Teste",
      plan_carte_desc: "1 crédito = 1 análise completa no jogo da tua escolha na IA ao Vivo.",
      plan_pop: "Popular",
      plan_pro_desc: "10 análises IA ao Vivo por dia + grupo Telegram Pro. Ideal para seguir os jogos sem esperar.",
      plan_pro_btn: "Assinar — 9.90€/mês",
      plan_elite_desc: "30 análises IA ao Vivo por dia + alertas Elite quando o Concílio deteta um sinal muito forte.",
      plan_elite_btn: "Assinar — 19.90€/mês",
      sec_how_eye: "Método",
      sec_how_title: "O Concílio não adivinha.",
      step1_title: "Recolha verificada às 6:00",
      step2_title: "6 agentes especializados + 1 Chief",
      step3_title: "Publicação às 7:00",
      step4_title: "Resultados traçados, modelo melhorado",
      foot_text: "Análise desportiva assistida por IA · Dados verificados · 0 jogo inventado",
      pick_won: "Ganhou",
      pick_lost: "Perdeu",
      final_score: "Resultado final",
      locked_votes: "Votos bloqueados",
      subscribe_cta: "Assina para ver as análises completas",
      bet_at: "Cota",
      live_today: "Em curso",
      upcoming: "Próximo",
      bet_type: "Análise",
      pick_analysis_lbl: "Análise",
      consensus: "Consenso",
      avg_odds: "Cota média",
      stake: "Aposta recomendada",
      see_verdict: "Ver o veredito",
      pf_live_now: "Ao vivo",
      pf_kickoff: "Início em",
      pf_next: "Próximo pick",
      pf_preview_txt: "A análise do Concílio estará disponível antes do início.",
      pf_preview_lock: "Reservado para assinantes Pro & Elite",
      pf_btn: "Ver a análise completa",
      pf_hint: "Disponível para assinantes Pro e Elite",
      logout: "Sair",
      nav_connect: "Entrar",
      match_done: "Jogo terminado"
    },
    de: {
      pick_today: "Analyse des Tages",
      nav_join: "Abonnements",
      nav_cta: "Loslegen →",
      mm_home: "\u{1F3E0} Startseite",
      mm_hist: "\u{1F4CA} Pick-Verlauf",
      mm_preuves: "\u{1F3C6} Ergebnisnachweise",
      mm_live: "\u{1F534} Live-KI",
      login_title: "Mitgliederzugang",
      login_sub: "Gib deine E-Mail und den Zugangscode ein, den du nach der Zahlung per E-Mail erhalten hast.",
      login_email: "E-Mail",
      login_code: "Zugangscode",
      login_btn: "Zugreifen →",
      login_required: "Melde dich an, um auf Live-KI zuzugreifen",
      login_checking: "Überprüfung…",
      login_invalid: "Ungültiger oder abgelaufener Code.",
      login_error: "Verbindungsfehler. Versuche es erneut.",
      sec_next_eye: "Rat · Live-Picks",
      sec_next_title: "Ergebnisse & Nächster Pick",
      sec_pick_eye: "Rat · Analyse des Tages",
      sec_roi_eye: "Leistung",
      sec_roi_title: "Echte Ergebnisse · Pick für Pick verfolgt",
      lbl_winrate: "Gewinnrate",
      lbl_picks_month: "Picks gespielt",
      sec_plans_eye: "Abonnements",
      sec_plans_title: "Ein Plan für jedes Ambitionsniveau",
      sec_plans_sub: "Vom kostenlosen Pick bis zur vollständigen Live-KI — sofortiger Zugang nach Zahlung.",
      plan_free_badge: "Kostenlos",
      plan_free_name: "Entdeckung",
      plan_free_desc: "Die beste KI-Analyse des Tages, auf der Website sichtbar. Keine Anmeldung erforderlich.",
      plan_free_btn: "Pick ansehen",
      plan_carte_badge: "Einzeln",
      plan_carte_name: "Test",
      plan_carte_desc: "1 Guthaben = 1 vollständige Analyse zum Spiel deiner Wahl in Live-KI.",
      plan_pop: "Beliebt",
      plan_pro_desc: "10 Live-KI-Analysen pro Tag + Pro-Telegram-Gruppe. Ideal, um Spiele ohne Wartezeit zu verfolgen.",
      plan_pro_btn: "Abonnieren — 9.90€/Monat",
      plan_elite_desc: "30 Live-KI-Analysen pro Tag + Elite-Benachrichtigungen, wenn der Rat ein sehr starkes Signal erkennt.",
      plan_elite_btn: "Abonnieren — 19.90€/Monat",
      sec_how_eye: "Methode",
      sec_how_title: "Der Rat rät nicht.",
      step1_title: "Verifizierte Sammlung um 6:00 Uhr",
      step2_title: "6 spezialisierte Agenten + 1 Chief",
      step3_title: "Veröffentlichung um 7:00 Uhr",
      step4_title: "Ergebnisse verfolgt, Modell verbessert",
      foot_text: "KI-gestützte Sportanalyse · Verifizierte Daten · 0 erfundenes Spiel",
      pick_won: "Gewonnen",
      pick_lost: "Verloren",
      final_score: "Endstand",
      locked_votes: "Stimmen gesperrt",
      subscribe_cta: "Abonnieren, um vollständige Analysen zu sehen",
      bet_at: "Quote",
      live_today: "Laufend",
      upcoming: "Bevorstehend",
      bet_type: "Analyse",
      pick_analysis_lbl: "Analyse",
      consensus: "Konsens",
      avg_odds: "Durchschnittsquote",
      stake: "Empfohlener Einsatz",
      see_verdict: "Urteil ansehen",
      pf_live_now: "Live jetzt",
      pf_kickoff: "Anstoß in",
      pf_next: "Nächster Pick",
      pf_preview_txt: "Die Analyse des Rates ist vor dem Anpfiff verfügbar.",
      pf_preview_lock: "Nur für Pro & Elite-Abonnenten",
      pf_btn: "Vollständige Analyse ansehen",
      pf_hint: "Verfügbar für Pro- und Elite-Abonnenten",
      logout: "Abmelden",
      nav_connect: "Anmelden",
      match_done: "Spiel beendet"
    },
    zh: {
      pick_today: "今日分析",
      nav_join: "订阅",
      nav_cta: "开始使用 →",
      mm_home: "\u{1F3E0} 首页",
      mm_hist: "\u{1F4CA} 预测历史",
      mm_preuves: "\u{1F3C6} 结果证明",
      mm_live: "\u{1F534} 实时AI",
      login_title: "会员登录",
      login_sub: "输入您的电子邮件和付款后通过电子邮件收到的访问码。",
      login_email: "邮箱",
      login_code: "访问码",
      login_btn: "进入 →",
      login_required: "请登录以访问实时AI",
      login_checking: "验证中…",
      login_invalid: "验证码无效或已过期。",
      login_error: "连接错误，请重试。",
      sec_next_eye: "议会 · 实时预测",
      sec_next_title: "结果与下一个预测",
      sec_pick_eye: "议会 · 今日分析",
      sec_roi_eye: "表现",
      sec_roi_title: "真实结果 · 逐个预测跟踪",
      lbl_winrate: "胜率",
      lbl_picks_month: "已玩预测",
      sec_plans_eye: "订阅方案",
      sec_plans_title: "为每个目标量身定制方案",
      sec_plans_sub: "从免费预测到完整实时AI — 付款后立即访问。",
      plan_free_badge: "免费",
      plan_free_name: "发现",
      plan_free_desc: "最佳的每日AI分析，在网站上可查看。无需注册。",
      plan_free_btn: "查看预测",
      plan_carte_badge: "单次购买",
      plan_carte_name: "试用",
      plan_carte_desc: "1积分 = 在实时AI中对你选择的比赛进行完整分析。",
      plan_pop: "热门",
      plan_pro_desc: "每天10次实时AI分析 + Pro版Telegram群组。无需等待即可关注比赛。",
      plan_pro_btn: "订阅 — €9.90/月",
      plan_elite_desc: "每天30次实时AI分析 + 当议会检测到极强信号时的Elite警报。",
      plan_elite_btn: "订阅 — €19.90/月",
      sec_how_eye: "方法",
      sec_how_title: "议会不做猜测。",
      step1_title: "早上6点验证数据收集",
      step2_title: "6个专业AI代理 + 1位首席",
      step3_title: "早上7点发布",
      step4_title: "结果跟踪，模型优化",
      foot_text: "AI辅助体育分析 · 数据已验证 · 0场虚假比赛",
      pick_won: "赢了",
      pick_lost: "输了",
      final_score: "最终比分",
      locked_votes: "锁定投票",
      subscribe_cta: "订阅查看完整分析",
      bet_at: "赔率",
      live_today: "进行中",
      upcoming: "即将到来",
      bet_type: "分析",
      pick_analysis_lbl: "分析",
      consensus: "共识",
      avg_odds: "平均赔率",
      stake: "建议投注",
      see_verdict: "查看裁决",
      pf_live_now: "正在直播",
      pf_kickoff: "开球倒计时",
      pf_next: "下一个预测",
      pf_preview_txt: "议会的分析将在开赛前提供。",
      pf_preview_lock: "仅供Pro和Elite订阅者",
      pf_btn: "查看完整分析",
      pf_hint: "适用于Pro和Elite订阅者",
      logout: "退出登录",
      nav_connect: "登录",
      match_done: "比赛结束"
    },
    ru: {
      pick_today: "Анализ дня",
      nav_join: "Подписки",
      nav_cta: "Начать →",
      mm_home: "\u{1F3E0} Главная",
      mm_hist: "\u{1F4CA} История прогнозов",
      mm_preuves: "\u{1F3C6} Подтверждение результатов",
      mm_live: "\u{1F534} Live AI",
      login_title: "Доступ для участников",
      login_sub: "Введите свой email и код доступа, полученный по email после оплаты.",
      login_email: "Email",
      login_code: "Код доступа",
      login_btn: "Войти →",
      login_required: "Войдите, чтобы получить доступ к Live AI",
      login_checking: "Проверка…",
      login_invalid: "Недействительный или просроченный код.",
      login_error: "Ошибка соединения. Попробуйте снова.",
      sec_next_eye: "Совет · Прогнозы в прямом эфире",
      sec_next_title: "Результаты и следующий прогноз",
      sec_pick_eye: "Совет · анализ дня",
      sec_roi_eye: "Производительность",
      sec_roi_title: "Реальные результаты · отслеживание прогнозов",
      lbl_winrate: "Процент побед",
      lbl_picks_month: "Сыграно прогнозов",
      sec_plans_eye: "Подписки",
      sec_plans_title: "План для каждого уровня амбиций",
      sec_plans_sub: "От бесплатного прогноза до полного Live AI — доступ сразу после оплаты.",
      plan_free_badge: "Бесплатно",
      plan_free_name: "Открытие",
      plan_free_desc: "Лучший AI-анализ дня, доступный на сайте. Без регистрации.",
      plan_free_btn: "Смотреть прогноз",
      plan_carte_badge: "Поштучно",
      plan_carte_name: "Тест",
      plan_carte_desc: "1 кредит = 1 полный анализ матча по вашему выбору в Live AI.",
      plan_pop: "Популярное",
      plan_pro_desc: "10 анализов Live AI в день + группа Telegram Pro. Идеально для отслеживания матчей без ожидания.",
      plan_pro_btn: "Подписаться — €9.90/мес",
      plan_elite_desc: "30 анализов Live AI в день + Elite-оповещения, когда Совет обнаруживает очень сильный сигнал.",
      plan_elite_btn: "Подписаться — €19.90/мес",
      sec_how_eye: "Метод",
      sec_how_title: "Совет не гадает.",
      step1_title: "Проверенный сбор данных в 6:00",
      step2_title: "6 специализированных агентов + 1 Chief",
      step3_title: "Публикация в 7:00",
      step4_title: "Результаты отслежены, модель улучшена",
      foot_text: "Спортивный анализ с помощью AI · Проверенные данные · 0 выдуманных матчей",
      pick_won: "Выигрыш",
      pick_lost: "Проигрыш",
      final_score: "Финальный счёт",
      locked_votes: "Заблокированные голоса",
      subscribe_cta: "Подпишитесь, чтобы видеть полный анализ",
      bet_at: "Коэффициент",
      live_today: "В процессе",
      upcoming: "Предстоящий",
      bet_type: "Анализ",
      pick_analysis_lbl: "Анализ",
      consensus: "Консенсус",
      avg_odds: "Средний коэффициент",
      stake: "Рекомендуемая ставка",
      see_verdict: "Посмотреть вердикт",
      pf_live_now: "Прямой эфир",
      pf_kickoff: "Начало через",
      pf_next: "Следующий прогноз",
      pf_preview_txt: "Анализ Совета будет доступен до начала матча.",
      pf_preview_lock: "Только для подписчиков Pro и Elite",
      pf_btn: "Посмотреть полный анализ",
      pf_hint: "Доступно для подписчиков Pro и Elite",
      logout: "Выйти",
      nav_connect: "Войти",
      match_done: "Матч завершён"
    }
  };

  var lang = "fr";

  // Map country → language (ISO 3166-1 alpha-2 → ISO 639-1)
  var countryToLang = {
    FR: "fr", BE: "fr", CH: "fr", LU: "fr", MC: "fr",
    GB: "en", US: "en", CA: "en", AU: "en", IE: "en", NZ: "en", ZA: "en", IN: "en",
    ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
    PT: "pt", BR: "pt", AO: "pt", MZ: "pt",
    DE: "de", AT: "de", 
    CN: "zh", TW: "zh", SG: "zh",
    RU: "ru", UA: "ru", BY: "ru", KZ: "ru"
  };

  var langNames = {
    fr: "Français",
    en: "English",
    es: "Español",
    pt: "Português",
    de: "Deutsch",
    zh: "中文",
    ru: "Русский"
  };

  var langFlags = {
    fr: "\u{1F1EB}\u{1F1F7}",
    en: "\u{1F1EC}\u{1F1E7}",
    es: "\u{1F1EA}\u{1F1F8}",
    pt: "\u{1F1E7}\u{1F1F7}",
    de: "\u{1F1E9}\u{1F1EA}",
    zh: "\u{1F1E8}\u{1F1F3}",
    ru: "\u{1F1F7}\u{1F1FA}"
  };

  // ── Auto-detect language via ip-api.com (free, no key) ──────────────────────────────────
  function autoDetectLang(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://ip-api.com/json/?fields=countryCode", true);
    xhr.timeout = 5000;
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          var countryCode = (data.countryCode || "").toUpperCase();
          var detected = countryToLang[countryCode];
          if (detected && translations[detected]) {
            lang = detected;
          }
        } catch(e) {}
      }
      // Fallback: navigator.language
      if (!lang || !translations[lang]) {
        var navLang = (navigator.language || "fr").slice(0, 2);
        lang = translations[navLang] ? navLang : "fr";
      }
      if (callback) callback(lang);
    };
    xhr.onerror = function() {
      // Fallback on error
      var navLang = (navigator.language || "fr").slice(0, 2);
      lang = translations[navLang] ? navLang : "fr";
      if (callback) callback(lang);
    };
    xhr.ontimeout = function() {
      var navLang = (navigator.language || "fr").slice(0, 2);
      lang = translations[navLang] ? navLang : "fr";
      if (callback) callback(lang);
    };
    try { xhr.send(); } catch(e) {
      var navLang = (navigator.language || "fr").slice(0, 2);
      lang = translations[navLang] ? navLang : "fr";
      if (callback) callback(lang);
    }
  }

  // ── Apply translations to DOM ────────────────────────────────────────────────────────────
  function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(function(el) {
      var key = el.getAttribute("data-i18n");
      var val = translations[lang] && translations[lang][key];
      if (val) el.textContent = val;
    });
    // Update HTML lang attribute
    document.documentElement.setAttribute("lang", lang);
    // Update selected flag in the picker
    var selEl = document.getElementById("lang-selected");
    if (selEl) {
      selEl.textContent = langFlags[lang] ? (langFlags[lang] + " " + langNames[lang]) : lang.toUpperCase();
    }
  }

  // ── Create language picker UI ────────────────────────────────────────────────────────────
  function createLangPicker() {
    var slot = document.getElementById("lang-picker-slot");
    if (!slot) return;
    // Already created?
    if (document.getElementById("lang-picker")) return;

    var container = document.createElement("div");
    container.id = "lang-picker";
    container.style.cssText = "position:relative;display:inline-block;";

    var btn = document.createElement("button");
    btn.id = "lang-selected";
    btn.setAttribute("aria-label", "Changer la langue");
    btn.style.cssText = "background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#eceaf4;border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;white-space:nowrap;line-height:1.4;";
    btn.textContent = langFlags[lang] ? (langFlags[lang] + " " + langNames[lang]) : lang.toUpperCase();

    var dropdown = document.createElement("div");
    dropdown.id = "lang-dropdown";
    dropdown.style.cssText = "position:absolute;top:calc(100% + 4px);right:0;background:#0d1020;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:4px 0;min-width:170px;z-index:9999;display:none;box-shadow:0 8px 32px rgba(0,0,0,.4);";

    var langs = ["fr", "en", "es", "pt", "de", "zh", "ru"];
    langs.forEach(function(l) {
      if (!translations[l]) return;
      var item = document.createElement("div");
      item.setAttribute("data-lang", l);
      item.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 14px;font-size:13px;color:#a8aec8;cursor:pointer;transition:background .15s,color .15s;";
      item.innerHTML = (langFlags[l] || "") + " " + (langNames[l] || l.toUpperCase());
      item.onmouseover = function(){ this.style.background = "rgba(255,255,255,.06)"; this.style.color = "#eceaf4"; };
      item.onmouseout = function(){ this.style.background = "transparent"; this.style.color = "#a8aec8"; };
      item.onclick = function(e) {
        e.stopPropagation();
        setLang(l);
        dropdown.style.display = "none";
      };
      dropdown.appendChild(item);
    });

    btn.onclick = function(e) {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
    };

    // Close dropdown on click outside
    document.addEventListener("click", function() {
      dropdown.style.display = "none";
    });

    container.appendChild(btn);
    container.appendChild(dropdown);
    slot.appendChild(container);
  }

  // ── Public API ───────────────────────────────────────────────────────────────────────────
  function t(key) {
    return (translations[lang] && translations[lang][key]) || key;
  }

  function init() {
    autoDetectLang(function() {
      applyTranslations();
      createLangPicker();
    });
  }

  function setLang(l) {
    if (!translations[l]) return;
    lang = l;
    try { localStorage.setItem("tlm_lang", l); } catch(e) {}
    applyTranslations();
  }

  // Check if user has a saved preference
  try {
    var saved = localStorage.getItem("tlm_lang");
    if (saved && translations[saved]) {
      lang = saved;
    }
  } catch(e) {}

  return {
    t: t,
    init: init,
    setLang: setLang,
    currentLang: function() { return lang; },
    translations: translations
  };
})();
