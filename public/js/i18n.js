// TousLesMatchs — i18n system
// Usage: include this script, call i18n.init() on DOMContentLoaded
// Mark elements with data-i18n="key" for text, data-i18n-ph="key" for placeholder

const I18N = {
  fr: {
    nav_home:"Accueil", nav_historique:"Historique", nav_preuves:"Preuves", nav_live:"Live IA",
    nav_join:"Abonnements", nav_cta:"Commencer →", nav_connect:"Se connecter",
    mm_home:"🏠 Accueil", mm_hist:"📊 Historique", mm_preuves:"🏆 Preuves de resultats", mm_live:"🔴 Live IA",
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
    preuves_title:"Preuves de resultats",
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
    no_pick_today:"Aucun pick aujourd'hui", pick_won:"PICK GAGNANT", pick_lost:"PICK PERDANT",
    final_score:"Score final", live_today:"Live aujourd'hui", upcoming:"À venir",
    locked_votes:"Votes réservés aux membres", pick_analysis_lbl:"Analyse Concile",
    consensus:"consensus", avg_odds:"Cote moyenne", stake:"Mise", bet_type:"Type de pari", bet_at:"Parier chez",
    subscribe_cta:"S'abonner →", see_verdict:"🔒 Voir le verdict →",
    hero_badge:"Concile V4.3 · Analyse en temps réel",
    hero_t1:"Le Conseil des IA analyse chaque match.", hero_t2:"",
    hero_sub:"Quand plusieurs IA voient le même signal, tu décides avec une longueur d’avance. 🔥",
    hero_cta1:"Voir le pick du jour →", hero_cta2:"Accès Live IA",
    lbl_winrate:"Winrate", lbl_roi:"ROI total", lbl_ia:"IA du Concile", lbl_src:"Sources min.",
    lbl_bankroll:"Bankroll", lbl_picks_month:"Picks du mois",
    sec_next_eye:"Concile · Picks en direct", sec_next_title:"Résultats & Prochain Pick",
    sec_pick_eye:"Concile · analyse du jour",
    sec_roi_eye:"Performance", sec_roi_title:"Résultats réels · tracés pick par pick",
    sec_plans_eye:"Abonnements", sec_plans_title:"Un plan pour chaque niveau d'ambition",
    sec_plans_sub:"Du pick gratuit au Live IA complet — accès immédiat après paiement.",
    plan_free_badge:"Gratuit", plan_free_name:"Découverte",
    plan_free_desc:"Le meilleur pick du jour, visible sur le site. Aucune inscription.",
    plan_free_btn:"Voir le pick",
    plan_carte_badge:"À la carte", plan_carte_name:"Test",
    plan_carte_desc:"1 crédit = 1 analyse complète sur le match de ton choix en Live IA.",
    plan_pop:"Populaire",
    plan_pro_desc:"10 analyses/jour + Telegram Pro + Live IA avec reset à minuit.",
    plan_pro_btn:"S'abonner — 9.90€/mois",
    plan_elite_desc:"30 analyses/jour + Telegram Elite VIP + accès prioritaire + support.",
    plan_elite_btn:"S'abonner — 19.90€/mois",
    sec_how_eye:"Méthode", sec_how_title:"Le Concile ne devine pas.",
    step1_title:"Collecte vérifiée à 6h00", step2_title:"4 agents spécialisés + 1 Chief",
    step3_title:"Diffusion à 7h00", step4_title:"Résultats tracés, modèle amélioré",
    foot_text:"Analyse sportive assistée par IA · Données vérifiées · 0 match inventé",
    pf_won:"GAGNÉ", pf_lost:"PERDU", pf_live_now:"Match en cours →",
    pf_kickoff:"Coup d'envoi dans", pf_next:"PROCHAIN PICK",
    pf_preview_txt:"Le Concile a analysé ce match en profondeur",
    pf_preview_lock:"Recommandation réservée aux membres",
    pf_btn:"🔮 Obtenir l'Analyse du Concile →",
    pf_hint:"⚡ Accès dès 1€ · À la carte ou abonnement mensuel",
    login_required:"Email et code requis.", login_checking:"Vérification...",
    login_invalid:"Code invalide.", login_error:"Erreur serveur. Réessaie.",
    match_done:"Terminé",
  },
  en: {
    nav_home:"Home", nav_historique:"History", nav_preuves:"Proof", nav_live:"Live AI",
    nav_join:"Plans", nav_cta:"Get started →", nav_connect:"Sign in",
    mm_home:"🏠 Home", mm_hist:"📊 History", mm_preuves:"🏆 Proof of results", mm_live:"🔴 Live AI",
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
    preuves_title:"Proof of results",
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
    no_pick_today:"No pick today", pick_won:"WINNING PICK", pick_lost:"LOSING PICK",
    final_score:"Final score", live_today:"Live today", upcoming:"Upcoming",
    locked_votes:"Votes for members only", pick_analysis_lbl:"Council Analysis",
    consensus:"consensus", avg_odds:"Average odds", stake:"Stake", bet_type:"Bet type", bet_at:"Bet with",
    subscribe_cta:"Subscribe →", see_verdict:"🔒 See verdict →",
    hero_badge:"Council V4.3 · Real-time Analysis",
    hero_t1:"The Council analyzes.", hero_t2:"You decide with better data.",
    hero_sub:"5 artificial intelligences. 3 verified sources. One pick per day, when and only when the data justifies it.",
    hero_cta1:"See today's pick →", hero_cta2:"Live AI Access",
    lbl_winrate:"Win rate", lbl_roi:"Total ROI", lbl_ia:"Council AIs", lbl_src:"Min. sources",
    lbl_bankroll:"Bankroll", lbl_picks_month:"Picks this month",
    sec_next_eye:"Council · Live Picks", sec_next_title:"Results & Next Pick",
    sec_pick_eye:"Council · today's analysis",
    sec_roi_eye:"Performance", sec_roi_title:"Real results · tracked pick by pick",
    sec_plans_eye:"Subscriptions", sec_plans_title:"A plan for every level of ambition",
    sec_plans_sub:"From free pick to full Live AI — instant access after payment.",
    plan_free_badge:"Free", plan_free_name:"Discovery",
    plan_free_desc:"The best pick of the day, visible on the site. No registration needed.",
    plan_free_btn:"See pick",
    plan_carte_badge:"Pay-as-you-go", plan_carte_name:"Try",
    plan_carte_desc:"1 credit = 1 full analysis on the match of your choice in Live AI.",
    plan_pop:"Popular",
    plan_pro_desc:"10 analyses/day + Telegram Pro + Live AI with midnight reset.",
    plan_pro_btn:"Subscribe — €9.90/month",
    plan_elite_desc:"30 analyses/day + Telegram Elite VIP + priority access + support.",
    plan_elite_btn:"Subscribe — €19.90/month",
    sec_how_eye:"Method", sec_how_title:"The Council doesn't guess.",
    step1_title:"Verified data collected at 6am", step2_title:"4 specialist agents + 1 Chief",
    step3_title:"Published at 7am", step4_title:"Results tracked, model improved",
    foot_text:"AI-powered sports analysis · Verified data · 0 invented matches",
    pf_won:"WON", pf_lost:"LOST", pf_live_now:"Match in progress →",
    pf_kickoff:"Kick-off in", pf_next:"NEXT PICK",
    pf_preview_txt:"The Council analyzed this match in depth",
    pf_preview_lock:"Recommendation for members only",
    pf_btn:"🔮 Get Council Analysis →",
    pf_hint:"⚡ Access from €1 · Pay-as-you-go or monthly subscription",
    login_required:"Email and code required.", login_checking:"Checking...",
    login_invalid:"Invalid code.", login_error:"Server error. Try again.",
    match_done:"Finished",
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
    no_pick_today:"Sin pick hoy", pick_won:"PICK GANADOR", pick_lost:"PICK PERDIDO",
    final_score:"Resultado final", live_today:"En directo hoy", upcoming:"Próximo",
    locked_votes:"Votos reservados a miembros", pick_analysis_lbl:"Análisis Concilio",
    consensus:"consenso", avg_odds:"Cuota media", stake:"Apuesta", bet_type:"Tipo de apuesta", bet_at:"Apostar en",
    subscribe_cta:"Suscribirse →", see_verdict:"🔒 Ver veredicto →",
    hero_badge:"Concilio V4.3 · Análisis en tiempo real",
    hero_t1:"El Concilio analiza.", hero_t2:"Decides con más datos.",
    hero_sub:"5 inteligencias artificiales. 3 fuentes verificadas. Un pick por día, cuando y solo cuando los datos lo justifican.",
    hero_cta1:"Ver el pick del día →", hero_cta2:"Acceso Live IA",
    lbl_winrate:"Tasa de acierto", lbl_roi:"ROI total", lbl_ia:"IA del Concilio", lbl_src:"Fuentes mín.",
    lbl_bankroll:"Bankroll", lbl_picks_month:"Picks del mes",
    sec_next_eye:"Concilio · Picks en directo", sec_next_title:"Resultados y Próximo Pick",
    sec_pick_eye:"Concilio · análisis del día", sec_roi_eye:"Rendimiento",
    sec_roi_title:"Resultados reales · rastreados pick a pick",
    sec_plans_eye:"Suscripciones", sec_plans_title:"Un plan para cada nivel de ambición",
    sec_plans_sub:"Desde el pick gratuito hasta el Live IA completo.",
    plan_free_badge:"Gratis", plan_free_name:"Descubrimiento",
    plan_free_desc:"El mejor pick del día, visible en el sitio. Sin registro.",
    plan_free_btn:"Ver pick", plan_carte_badge:"Por crédito", plan_carte_name:"Prueba",
    plan_carte_desc:"1 crédito = 1 análisis completo en Live IA.",
    plan_pop:"Popular", plan_pro_desc:"10 análisis/día + Telegram Pro + Live IA.",
    plan_pro_btn:"Suscribirse — 9,90€/mes",
    plan_elite_desc:"30 análisis/día + Telegram Elite VIP + acceso prioritario.",
    plan_elite_btn:"Suscribirse — 19,90€/mes",
    sec_how_eye:"Método", sec_how_title:"El Concilio no adivina.",
    step1_title:"Datos verificados a las 6h", step2_title:"4 agentes especializados + 1 Chief",
    step3_title:"Publicación a las 7h", step4_title:"Resultados rastreados, modelo mejorado",
    foot_text:"Análisis deportivo asistido por IA · Datos verificados · 0 partidos inventados",
    pf_won:"GANADO", pf_lost:"PERDIDO", pf_live_now:"Partido en curso →",
    pf_kickoff:"Saque de inicio en", pf_next:"PRÓXIMO PICK",
    pf_preview_txt:"El Concilio analizó este partido en profundidad",
    pf_preview_lock:"Recomendación reservada a miembros",
    pf_btn:"🔮 Obtener Análisis del Concilio →",
    pf_hint:"⚡ Acceso desde 1€ · Por crédito o suscripción mensual",
    login_required:"Email y código requeridos.", login_checking:"Comprobando...",
    login_invalid:"Código inválido.", login_error:"Error del servidor. Inténtalo de nuevo.",
    match_done:"Terminado",
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
    no_pick_today:"Sem pick hoje", pick_won:"PICK VENCEDOR", pick_lost:"PICK PERDIDO",
    final_score:"Resultado final", live_today:"Ao vivo hoje", upcoming:"A seguir",
    locked_votes:"Votos reservados a membros", pick_analysis_lbl:"Análise Concílio",
    consensus:"consenso", avg_odds:"Cota média", stake:"Aposta", bet_type:"Tipo de aposta", bet_at:"Apostar em",
    subscribe_cta:"Subscrever →", see_verdict:"🔒 Ver veredicto →",
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
    no_pick_today:"Kein Pick heute", pick_won:"GEWINN-PICK", pick_lost:"VERLUST-PICK",
    final_score:"Endergebnis", live_today:"Heute live", upcoming:"Demnächst",
    locked_votes:"Abstimmungen nur für Mitglieder", pick_analysis_lbl:"Konzil-Analyse",
    consensus:"Konsens", avg_odds:"Durchschnittliche Quote", stake:"Einsatz", bet_type:"Wettart", bet_at:"Wetten bei",
    subscribe_cta:"Abonnieren →", see_verdict:"🔒 Ergebnis sehen →",
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
    no_pick_today:"Nessun pick oggi", pick_won:"PICK VINCENTE", pick_lost:"PICK PERDENTE",
    final_score:"Risultato finale", live_today:"Live oggi", upcoming:"In arrivo",
    locked_votes:"Voti riservati ai membri", pick_analysis_lbl:"Analisi Concilio",
    consensus:"consenso", avg_odds:"Quota media", stake:"Puntata", bet_type:"Tipo di scommessa", bet_at:"Scommetti su",
    subscribe_cta:"Abbonati →", see_verdict:"🔒 Vedi verdetto →",
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
    no_pick_today:"Geen pick vandaag", pick_won:"WINNENDE PICK", pick_lost:"VERLIEZENDE PICK",
    final_score:"Eindstand", live_today:"Live vandaag", upcoming:"Binnenkort",
    locked_votes:"Stemmen alleen voor leden", pick_analysis_lbl:"Raadsanalyse",
    consensus:"consensus", avg_odds:"Gemiddelde odds", stake:"Inzet", bet_type:"Wedtype", bet_at:"Gokken bij",
    subscribe_cta:"Abonneren →", see_verdict:"🔒 Zie verdict →",
    hero_badge:"Concilie V4.3 · Realtime analyse",
    hero_t1:"Het Concilie analyseert.", hero_t2:"Jij beslist met meer data.",
    hero_sub:"5 kunstmatige intelligenties. 3 geverifieerde bronnen. Één pick per dag, wanneer de data het rechtvaardigt.",
    hero_cta1:"Zie de pick van vandaag →", hero_cta2:"Live AI Toegang",
    lbl_winrate:"Slagingspercentage", lbl_roi:"Totale ROI", lbl_ia:"Concilie AI's", lbl_src:"Min. bronnen",
    lbl_bankroll:"Bankroll", lbl_picks_month:"Picks deze maand",
    sec_next_eye:"Concilie · Live Picks", sec_next_title:"Resultaten & Volgende Pick",
    sec_pick_eye:"Concilie · analyse van vandaag", sec_roi_eye:"Prestaties",
    sec_roi_title:"Echte resultaten · bijgehouden per pick",
    sec_plans_eye:"Abonnementen", sec_plans_title:"Een plan voor elk ambitieniveau",
    sec_plans_sub:"Van gratis pick tot volledig Live AI — directe toegang na betaling.",
    plan_free_badge:"Gratis", plan_free_name:"Kennismaking",
    plan_free_desc:"De beste pick van de dag, zichtbaar op de site. Geen registratie nodig.",
    plan_free_btn:"Zie pick", plan_carte_badge:"Per krediet", plan_carte_name:"Probeer",
    plan_carte_desc:"1 krediet = 1 volledige analyse in Live AI.",
    plan_pop:"Populair", plan_pro_desc:"10 analyses/dag + Telegram Pro + Live AI.",
    plan_pro_btn:"Abonneren — €9,90/maand",
    plan_elite_desc:"30 analyses/dag + Telegram Elite VIP + prioriteitstoegang.",
    plan_elite_btn:"Abonneren — €19,90/maand",
    sec_how_eye:"Methode", sec_how_title:"Het Concilie raadt niet.",
    step1_title:"Geverifieerde data om 6u", step2_title:"4 gespecialiseerde agents + 1 Chief",
    step3_title:"Publicatie om 7u", step4_title:"Resultaten bijgehouden, model verbeterd",
    foot_text:"AI-ondersteunde sportanalyse · Geverifieerde data · 0 verzonnen wedstrijden",
    pf_won:"GEWONNEN", pf_lost:"VERLOREN", pf_live_now:"Wedstrijd bezig →",
    pf_kickoff:"Aftrap over", pf_next:"VOLGENDE PICK",
    pf_preview_txt:"Het Concilie analyseerde deze wedstrijd grondig",
    pf_preview_lock:"Aanbeveling alleen voor leden",
    pf_btn:"🔮 Concilie Analyse ophalen →",
    pf_hint:"⚡ Toegang vanaf €1 · Per krediet of maandabonnement",
    login_required:"E-mail en code vereist.", login_checking:"Controleren...",
    login_invalid:"Ongeldige code.", login_error:"Serverfout. Probeer opnieuw.",
    match_done:"Afgelopen",
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
    no_pick_today:"Bugün pick yok", pick_won:"KAZANAN PİCK", pick_lost:"KAYBEDEN PİCK",
    final_score:"Final skoru", live_today:"Bugün canlı", upcoming:"Yakında",
    locked_votes:"Üyelere özel oylar", pick_analysis_lbl:"Konsey Analizi",
    consensus:"konsensüs", avg_odds:"Ortalama oran", stake:"Bahis", bet_type:"Bahis türü", bet_at:"Bahis yap",
    subscribe_cta:"Abone ol →", see_verdict:"🔒 Sonucu gör →",
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
    no_pick_today:"Нет пика сегодня", pick_won:"ВЫИГРЫШНЫЙ ПИК", pick_lost:"ПРОИГРЫШНЫЙ ПИК",
    final_score:"Финальный счёт", live_today:"Сейчас в прямом эфире", upcoming:"Скоро",
    locked_votes:"Голоса только для участников", pick_analysis_lbl:"Анализ Совета",
    consensus:"консенсус", avg_odds:"Средний коэффициент", stake:"Ставка", bet_type:"Тип ставки", bet_at:"Делать ставку на",
    subscribe_cta:"Подписаться →", see_verdict:"🔒 Посмотреть вердикт →",
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
    no_pick_today:"今天没有Pick", pick_won:"获胜PICK", pick_lost:"失败PICK",
    final_score:"最终比分", live_today:"今天直播", upcoming:"即将进行",
    locked_votes:"仅会员可见投票", pick_analysis_lbl:"委员会分析",
    consensus:"共识", avg_odds:"平均赔率", stake:"投注", bet_type:"投注类型", bet_at:"在此下注",
    subscribe_cta:"订阅 →", see_verdict:"🔒 查看裁决 →",
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
    no_pick_today:"لا اختيار اليوم", pick_won:"اختيار رابح", pick_lost:"اختيار خاسر",
    final_score:"النتيجة النهائية", live_today:"مباشر اليوم", upcoming:"قادم",
    locked_votes:"التصويت للأعضاء فقط", pick_analysis_lbl:"تحليل المجلس",
    consensus:"إجماع", avg_odds:"متوسط المعامل", stake:"رهان", bet_type:"نوع الرهان", bet_at:"راهن على",
    subscribe_cta:"اشترك →", see_verdict:"🔒 انظر الحكم →",
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
    if(typeof renderNavAuth === "function") renderNavAuth();
    if(typeof renderPick === "function") renderPick();
    if(typeof renderPicksFeed === "function") renderPicksFeed();
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
