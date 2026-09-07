/* TousLesMatchs — traduction intégrale des interfaces publiques.
 * Traduit aussi les libellés injectés après les réponses API.
 * Les noms d’équipes, nombres, scores et marques restent inchangés.
 */
(function () {
  "use strict";
  var LANGS = ["fr", "en", "es", "pt", "ru", "zh"];
  var NAMES = {fr:"Français",en:"English",es:"Español",pt:"Português",ru:"Русский",zh:"中文"};
  var LANGUAGE_LABELS = {
    fr:{fr:"Français",en:"Anglais",es:"Espagnol",pt:"Portugais",ru:"Russe",zh:"Chinois"},
    en:{fr:"French",en:"English",es:"Spanish",pt:"Portuguese",ru:"Russian",zh:"Chinese"},
    es:{fr:"Francés",en:"Inglés",es:"Español",pt:"Portugués",ru:"Ruso",zh:"Chino"},
    pt:{fr:"Francês",en:"Inglês",es:"Espanhol",pt:"Português",ru:"Russo",zh:"Chinês"},
    ru:{fr:"Французский",en:"Английский",es:"Испанский",pt:"Португальский",ru:"Русский",zh:"Китайский"},
    zh:{fr:"法语",en:"英语",es:"西班牙语",pt:"葡萄牙语",ru:"俄语",zh:"中文"}
  };
  var LOCALES = {fr:"fr-FR",en:"en-GB",es:"es-ES",pt:"pt-BR",ru:"ru-RU",zh:"zh-CN"};

  /* [français, anglais, espagnol, portugais, russe, chinois] */
  var rows = [
    ["Analyses","Analyses","Análisis","Análises","Аналитика","分析"],
    ["Live IA — TousLesMatchs","Live AI — TousLesMatchs","IA en directo — TousLesMatchs","IA ao vivo — TousLesMatchs","ИИ в прямом эфире — TousLesMatchs","AI 实时 — TousLesMatchs"],
    ["Performances du Conseil IA — TousLesMatchs","AI Council performance — TousLesMatchs","Rendimiento del Consejo IA — TousLesMatchs","Desempenho do Conselho de IA — TousLesMatchs","Результаты Совета ИИ — TousLesMatchs","AI 评议会表现 — TousLesMatchs"],
    ["Gestion de capital — TousLesMatchs","Capital management — TousLesMatchs","Gestión de capital — TousLesMatchs","Gestão de capital — TousLesMatchs","Управление капиталом — TousLesMatchs","资金管理 — TousLesMatchs"],
    ["Mon espace — TousLesMatchs","My account — TousLesMatchs","Mi espacio — TousLesMatchs","A minha área — TousLesMatchs","Мой кабинет — TousLesMatchs","我的账户 — TousLesMatchs"],
    ["TousLesMatchs — Conseil IA","TousLesMatchs — AI Council","TousLesMatchs — Consejo IA","TousLesMatchs — Conselho de IA","TousLesMatchs — Совет ИИ","TousLesMatchs — AI 评议会"],
    ["FAQ — TousLesMatchs","FAQ — TousLesMatchs","Preguntas frecuentes — TousLesMatchs","Perguntas frequentes — TousLesMatchs","Вопросы и ответы — TousLesMatchs","常见问题 — TousLesMatchs"],
    ["Live IA","Live AI","IA en directo","IA ao vivo","ИИ в прямом эфире","AI 实时"],
    ["Résultats","Results","Resultados","Resultados","Результаты","战绩"],
    ["Bankroll","Bankroll","Bankroll","Bankroll","Банкролл","资金管理"],
    ["Méthode","Method","Método","Método","Метод","方法"],
    ["Tarifs","Pricing","Precios","Preços","Тарифы","价格"],
    ["Accueil","Home","Inicio","Início","Главная","首页"],
    ["Se connecter","Log in","Iniciar sesión","Entrar","Войти","登录"],
    ["Créer mon compte gratuit","Create free account","Crear cuenta gratis","Criar conta grátis","Создать бесплатный аккаунт","免费注册"],
    ["Déconnexion","Log out","Cerrar sesión","Sair","Выйти","退出"],
    ["Voir les abonnements","View subscriptions","Ver suscripciones","Ver assinaturas","Посмотреть подписки","查看订阅"],
    ["Mentions légales","Legal notice","Aviso legal","Aviso legal","Правовая информация","法律声明"],
    ["Confidentialité","Privacy","Privacidad","Privacidade","Конфиденциальность","隐私"],
    ["Contact","Contact","Contacto","Contacto","Контакты","联系我们"],
    ["Ce site utilise des données de navigation pour mesurer son audience et améliorer votre expérience. Aucun cookie publicitaire tiers. En savoir plus","This site uses browsing data to measure its audience and improve your experience. No third-party advertising cookies. Learn more","Este sitio utiliza datos de navegación para medir su audiencia y mejorar tu experiencia. Sin cookies publicitarias de terceros. Más información","Este site utiliza dados de navegação para medir a audiência e melhorar a sua experiência. Sem cookies publicitários de terceiros. Saber mais","Сайт использует данные навигации для измерения аудитории и улучшения работы. Сторонних рекламных cookies нет. Подробнее","本站使用浏览数据衡量访问量并改善体验，不使用第三方广告 Cookie。了解更多"],
    ["Ce site utilise des données de navigation pour mesurer son audience et améliorer votre expérience. Aucun cookie publicitaire tiers.","This site uses browsing data to measure its audience and improve your experience. No third-party advertising cookies.","Este sitio utiliza datos de navegación para medir su audiencia y mejorar tu experiencia. Sin cookies publicitarias de terceros.","Este site utiliza dados de navegação para medir a audiência e melhorar a sua experiência. Sem cookies publicitários de terceiros.","Сайт использует данные навигации для измерения аудитории и улучшения работы. Сторонних рекламных cookies нет.","本站使用浏览数据衡量访问量并改善体验，不使用第三方广告 Cookie。"],
    ["En savoir plus","Learn more","Más información","Saber mais","Подробнее","了解更多"],
    ["J'ai compris","I understand","Entendido","Compreendi","Понятно","我明白了"],
    ["Chargement…","Loading…","Cargando…","A carregar…","Загрузка…","加载中…"],
    ["Chargement...","Loading...","Cargando...","A carregar...","Загрузка...","加载中..."],
    ["Actualiser","Refresh","Actualizar","Atualizar","Обновить","刷新"],
    ["Fermer","Close","Cerrar","Fechar","Закрыть","关闭"],
    ["Voir","View","Ver","Ver","Открыть","查看"],
    ["Tous","All","Todos","Todos","Все","全部"],
    ["En attente","Pending","Pendiente","Pendente","Ожидание","等待中"],
    ["Pending","Pending","Pendiente","Pendente","Ожидание","等待中"],
    ["En direct","Live","En directo","Ao vivo","В эфире","直播"],
    ["IN_PLAY","IN PLAY","EN JUEGO","EM JOGO","В ИГРЕ","进行中"],
    ["Verdict","Verdict","Veredicto","Veredito","Вердикт","结论"],
    ["Vote du signal","Signal vote","Voto de la señal","Voto do sinal","Голос по сигналу","信号投票"],
    ["Votes du signal","Signal votes","Votos de la señal","Votos do sinal","Голоса по сигналу","信号投票"],
    ["Over du Concile","Council Over","Más del Consejo","Mais do Conselho","Тотал больше Совета","评议会大球"],
    ["Under du Concile","Council Under","Menos del Consejo","Menos do Conselho","Тотал меньше Совета","评议会小球"],
    ["Over 2,5 du Concile","Council Over 2.5","Más de 2,5 del Consejo","Mais de 2,5 do Conselho","Тотал больше 2,5 Совета","评议会大于 2.5 球"],
    ["Under 2,5 du Concile","Council Under 2.5","Menos de 2,5 del Consejo","Menos de 2,5 do Conselho","Тотал меньше 2,5 Совета","评议会小于 2.5 球"],
    ["Statistiques","Statistics","Estadísticas","Estatísticas","Статистика","统计"],
    ["Match","Match","Partido","Jogo","Матч","比赛"],
    ["Cote","Odds","Cuota","Odd","Коэффициент","赔率"],
    ["Confiance","Confidence","Confianza","Confiança","Уверенность","置信度"],
    ["Gagné","Won","Acertada","Certa","Выиграно","命中"],
    ["Perdu","Lost","Fallada","Errada","Проиграно","未命中"],
    ["Gagnées","Won","Acertadas","Certas","Выиграно","命中"],
    ["Perdues","Lost","Falladas","Erradas","Проиграно","未命中"],
    ["En attente d'accord","Waiting for agreement","Esperando consenso","A aguardar consenso","Ожидание согласия","等待共识"],
    ["En attente des IA","Waiting for the AIs","Esperando a las IA","A aguardar as IA","Ожидание ИИ","等待 AI"],
    ["Analyse IA en cours","AI analysis in progress","Análisis IA en curso","Análise IA em curso","ИИ-анализ выполняется","AI 分析进行中"],
    ["Recherche du direct","Searching for a live match","Buscando un partido en directo","A procurar um jogo ao vivo","Поиск матча в эфире","正在查找直播比赛"],
    ["Aucun match en direct","No live match","No hay partido en directo","Nenhum jogo ao vivo","Нет матчей в эфире","暂无直播比赛"],
    ["Aucun match dans la fenêtre 15–45 min","No match in the 15–45 min window","Ningún partido en la ventana 15–45 min","Nenhum jogo na janela de 15–45 min","Нет матчей в окне 15–45 мин","15–45 分钟窗口内暂无比赛"],
    ["Fenêtre d’analyse terminée","Analysis window closed","Ventana de análisis cerrada","Janela de análise encerrada","Окно анализа закрыто","分析窗口已关闭"],
    ["Votes antérieurs · aucune nouvelle sélection","Earlier votes · no new selection","Votos anteriores · ninguna selección nueva","Votos anteriores · nenhuma nova seleção","Ранее поданные голоса · нового выбора нет","此前投票 · 无新推荐"],
    ["Votes IA Over/Under 2,5","AI votes: Over/Under 2.5","Votos IA: Más/Menos 2,5","Votos das IA: Mais/Menos 2,5","Голоса ИИ: тотал больше/меньше 2,5","AI 投票：大/小 2.5 球"],
    ["Conseil IA · Over/Under 2,5","AI Council · Over/Under 2.5","Consejo IA · Más/Menos 2,5","Conselho de IA · Mais/Menos 2,5","Совет ИИ · Тотал больше/меньше 2,5","AI 评议会 · 大/小 2.5 球"],
    ["IA validées","validated AIs","IA validadas","IA validadas","ИИ с ответом","已响应 AI"],
    ["Aucun vote enregistré pour le moment","No vote recorded yet","Aún no hay votos registrados","Ainda não há votos registados","Голосов пока нет","暂未记录投票"],
    ["Aucun signal validé — ne pas jouer","No validated signal — do not play","Sin señal validada — no jugar","Nenhum sinal validado — não jogar","Нет подтверждённого сигнала — не играть","无已验证信号 — 请勿参与"],
    ["Analyse indisponible : minute inconnue ou non numérique.","Analysis unavailable: unknown or non-numeric minute.","Análisis no disponible: minuto desconocido o no numérico.","Análise indisponível: minuto desconhecido ou não numérico.","Анализ недоступен: минута неизвестна или указана не числом.","分析不可用：分钟未知或不是数字。"],
    ["Analyse indisponible avant la 15e minute.","Analysis unavailable before minute 15.","Análisis no disponible antes del minuto 15.","Análise indisponível antes do minuto 15.","Анализ недоступен до 15-й минуты.","第 15 分钟前不可分析。"],
    ["Analyse indisponible après la 45e minute.","Analysis unavailable after minute 45.","Análisis no disponible después del minuto 45.","Análise indisponível após o minuto 45.","Анализ недоступен после 45-й минуты.","第 45 分钟后不可分析。"],
    ["Débloquer l'analyse","Unlock the analysis","Desbloquear el análisis","Desbloquear a análise","Открыть анализ","解锁分析"],
    ["Voir le signal gratuit","View the free signal","Ver la señal gratuita","Ver o sinal gratuito","Посмотреть бесплатный сигнал","查看免费信号"],
    ["Voir les offres","View plans","Ver planes","Ver planos","Посмотреть тарифы","查看套餐"],
    ["Signal","Signal","Señal","Sinal","Сигнал","信号"],
    ["Direct","Live","Directo","Ao vivo","Эфир","直播"],
    ["Compte","Account","Cuenta","Conta","Аккаунт","账户"],
    ["Mon compte","My account","Mi cuenta","A minha conta","Мой аккаунт","我的账户"],
    ["Football · Analyse live","Football · Live analysis","Fútbol · Análisis en directo","Futebol · Análise ao vivo","Футбол · Анализ в эфире","足球 · 实时分析"],
    ["Votre signal Over ou Under 2,5.","Your Over or Under 2.5 signal.","Tu señal Más o Menos de 2,5.","O seu sinal Mais ou Menos de 2,5.","Ваш сигнал на тотал больше или меньше 2,5.","您的大于或小于 2.5 球信号。"],
    ["Décidé avant la mi-temps.","Decided before half-time.","Decidida antes del descanso.","Decidido antes do intervalo.","Определяется до перерыва.","半场前作出决定。"],
    ["Les équipes, les logos, le score et les drapeaux ci-dessous viennent du match réellement en cours.","The teams, logos, score and flags below come from the actual live match.","Los equipos, logotipos, marcador y banderas proceden del partido realmente en curso.","As equipas, logótipos, resultado e bandeiras abaixo vêm do jogo realmente em curso.","Команды, эмблемы, счёт и флаги ниже относятся к матчу, который действительно идёт сейчас.","下方的球队、队徽、比分和旗帜均来自真实进行中的比赛。"],
    ["Surveillance live","Live monitoring","Seguimiento en directo","Monitorização ao vivo","Мониторинг в эфире","实时监控"],
    ["Matchs de football réellement en cours, avec logos, score, minute et drapeau du championnat.","Football matches actually in progress, with logos, score, minute and league flag.","Partidos de fútbol realmente en curso, con logotipos, marcador, minuto y bandera de la liga.","Jogos de futebol realmente em curso, com logótipos, resultado, minuto e bandeira da liga.","Реальные текущие футбольные матчи с эмблемами, счётом, минутой и флагом лиги.","真实进行中的足球比赛，显示队徽、比分、分钟和联赛旗帜。"],
    ["Résultats Over / Under 2,5","Over / Under 2.5 results","Resultados Más / Menos 2,5","Resultados Mais / Menos 2,5","Результаты тотала больше / меньше 2,5","大 / 小 2.5 球结果"],
    ["Historique des analyses. Les envois Telegram vérifiés sont distingués de l’ancien système.","Analysis history. Verified Telegram deliveries are separated from the former system.","Historial de análisis. Los envíos de Telegram verificados se distinguen del sistema anterior.","Histórico de análises. Os envios Telegram verificados são separados do sistema anterior.","История анализов. Подтверждённые отправки в Telegram отделены от прежней системы.","分析历史。已验证的 Telegram 发送记录与旧系统分开显示。"],
    ["Connecte-toi avec l'email et le code reçus après paiement.","Log in with the email and code received after payment.","Inicia sesión con el email y el código recibidos tras el pago.","Entra com o email e o código recebidos após o pagamento.","Войдите с email и кодом, полученными после оплаты.","使用付款后收到的邮箱和访问码登录。"],
    ["🟢 Signal prêt","🟢 Signal ready","🟢 Señal lista","🟢 Sinal pronto","🟢 Сигнал готов","🟢 信号已就绪"],
    ["Signal disponible","Signal available","Señal disponible","Sinal disponível","Сигнал доступен","信号可用"],
    ["Une sélection validée vient d’être détectée.","A validated selection has just been detected.","Se acaba de detectar una selección validada.","Foi detetada uma seleção validada.","Обнаружен подтверждённый выбор.","刚刚检测到一条已验证推荐。"],
    ["Matchs en direct analysés par le Conseil IA. Analyses automatiques et statistiques en temps réel.","Live matches analysed by the AI Council. Automated analyses and real-time statistics.","Partidos en directo analizados por el Consejo IA. Análisis automáticos y estadísticas en tiempo real.","Jogos ao vivo analisados pelo Conselho de IA. Análises automáticas e estatísticas em tempo real.","Матчи в эфире анализирует Совет ИИ. Автоматический анализ и статистика в реальном времени.","AI 评议会分析直播比赛，提供自动分析和实时统计。"],
    ["Comparer la cote chez un bookmaker agréé ANJ","Compare odds with an ANJ-licensed operator","Comparar la cuota con un operador autorizado por la ANJ","Comparar a odd num operador autorizado pela ANJ","Сравнить коэффициент у оператора с лицензией ANJ","在 ANJ 持牌平台比较赔率"],
    ["Connecte-toi pour analyser les matchs","Log in to analyse matches","Inicia sesión para analizar partidos","Entra para analisar jogos","Войдите для анализа матчей","登录以分析比赛"],
    ["Connexion","Log in","Conexión","Entrar","Вход","登录"],
    ["Classement des agents IA","AI agent ranking","Clasificación de agentes IA","Classificação dos agentes de IA","Рейтинг ИИ-агентов","AI 模型排名"],
    ["Fiable","Reliable","Fiable","Fiável","Надёжно","可靠"],
    ["Bon","Good","Bueno","Bom","Хорошо","良好"],
    ["Risqué","Risky","Arriesgado","Arriscado","Рискованно","风险较高"],
    ["Prudence","Caution","Prudencia","Prudência","Осторожно","谨慎"],
    ["Dernière mise à jour :","Last updated:","Última actualización:","Última atualização:","Последнее обновление:","最后更新："],
    ["Chargement des matchs en direct...","Loading live matches...","Cargando partidos en directo...","A carregar jogos ao vivo...","Загрузка матчей в эфире...","正在加载直播比赛..."],
    ["Connexion Live IA","Live AI login","Acceso IA en directo","Acesso IA ao vivo","Вход в ИИ-эфир","AI 实时登录"],
    ["Entre ton email et ton code d'accès reçu après paiement.","Enter your email and the access code received after payment.","Introduce tu email y el código de acceso recibido tras el pago.","Introduz o teu email e o código de acesso recebido após o pagamento.","Введите email и код доступа, полученный после оплаты.","请输入邮箱和付款后收到的访问码。"],
    ["Email","Email","Email","Email","Email","邮箱"],
    ["Code d'accès","Access code","Código de acceso","Código de acesso","Код доступа","访问码"],
    ["Accéder →","Continue →","Acceder →","Aceder →","Войти →","继续 →"],
    ["Pas encore de code d'accès ?","No access code yet?","¿Aún no tienes código de acceso?","Ainda não tens código de acesso?","Ещё нет кода доступа?","还没有访问码？"],
    ["Choisir Standard — dès 4,90 €/mois","Choose Standard — from €4.90/month","Elegir Standard — desde 4,90 €/mes","Escolher Standard — desde 4,90 €/mês","Выбрать Standard — от 4,90 €/месяц","选择 Standard — 每月 4.90 欧元起"],
    ["Historique des analyses","Analysis history","Historial de análisis","Histórico de análises","История анализов","分析历史"],
    ["Charger plus d'analyses","Load more analyses","Cargar más análisis","Carregar mais análises","Загрузить ещё анализы","加载更多分析"],
    ["Analyse sportive assistée par IA · Données vérifiées · 0 match inventé","AI-assisted sports analysis · Verified data · 0 fabricated matches","Análisis deportivo asistido por IA · Datos verificados · 0 partidos inventados","Análise desportiva assistida por IA · Dados verificados · 0 jogos inventados","Спортивный анализ с ИИ · Проверенные данные · 0 вымышленных матчей","AI 辅助体育分析 · 数据已验证 · 0 场虚构比赛"],
    ["Performances du Concile","Council performance","Rendimiento del Consejo","Desempenho do Conselho","Результаты Совета","评议会表现"],
    ["L'historique antérieur est conservé. La journée défectueuse du 26 août a été retraitée avec les bons critères. Depuis le 27 août 2026, chaque nouveau signal Over/Under 2,5 est associé à une preuve d'envoi Telegram.","Earlier history is retained. The faulty data from 26 August was processed again with the correct criteria. Since 27 August 2026, every new Over/Under 2.5 signal includes proof of Telegram delivery.","Se conserva el historial anterior. Los datos defectuosos del 26 de agosto se reprocesaron con los criterios correctos. Desde el 27 de agosto de 2026, cada nueva señal Más/Menos 2,5 incluye una prueba de envío por Telegram.","O histórico anterior é mantido. Os dados defeituosos de 26 de agosto foram processados novamente com os critérios corretos. Desde 27 de agosto de 2026, cada novo sinal Mais/Menos 2,5 inclui prova de envio pelo Telegram.","Предыдущая история сохранена. Ошибочные данные за 26 августа обработаны повторно по правильным критериям. С 27 августа 2026 года каждый новый сигнал на тотал 2,5 содержит подтверждение отправки в Telegram.","此前的历史记录予以保留。8 月 26 日的错误数据已按正确标准重新处理。自 2026 年 8 月 27 日起，每条新的大/小 2.5 球信号都附有 Telegram 发送凭证。"],
    ["Pick du jour","Daily pick","Selección del día","Seleção do dia","Выбор дня","每日推荐"],
    ["Les critères de diffusion en vigueur sont chargés depuis le serveur.","Current delivery criteria are loaded from the server.","Los criterios de difusión actuales se cargan desde el servidor.","Os critérios de envio atuais são carregados do servidor.","Действующие критерии отправки загружаются с сервера.","当前发送标准由服务器加载。"],
    ["Winrate","Success rate","Tasa de acierto","Taxa de acerto","Доля успешных","命中率"],
    ["Cote moyenne","Average odds","Cuota media","Odd média","Средний коэффициент","平均赔率"],
    ["Bénéfice (10€/mise)","Profit (€10 base)","Beneficio (base 10 €)","Lucro (base 10 €)","Результат (база 10 €)","收益（以 10 欧元为基准）"],
    ["Historique daté","Dated history","Historial fechado","Histórico datado","История по датам","按日期记录"],
    ["Diffusable","Eligible","Publicable","Elegível","Можно отправлять","可发送"],
    ["Statistiques calculées en temps réel à chaque chargement de cette page, directement depuis notre base de données — pas de mise à jour différée, aucun chiffre mis en cache.","Statistics are calculated in real time whenever this page loads, directly from our database. No delayed update and no cached figures.","Las estadísticas se calculan en tiempo real al cargar esta página, directamente desde nuestra base de datos. Sin actualización diferida ni cifras en caché.","As estatísticas são calculadas em tempo real sempre que esta página é carregada, diretamente da nossa base de dados. Sem atualização diferida nem valores em cache.","Статистика рассчитывается в реальном времени при каждой загрузке страницы прямо из базы данных. Без задержек и кэшированных показателей.","每次加载本页时，统计数据都会直接从数据库实时计算，不延迟更新，也不使用缓存数字。"],
    ["Depuis le 27 août : signaux Telegram vérifiés. Les lignes « Ancien système » ou « Livraison non prouvée » sont conservées séparément et ne prouvent pas un envoi.","Since 27 August: verified Telegram signals. Rows marked “Former system” or “Unproven delivery” are kept separately and do not prove delivery.","Desde el 27 de agosto: señales de Telegram verificadas. Las filas «Sistema anterior» o «Entrega no probada» se conservan aparte y no prueban un envío.","Desde 27 de agosto: sinais Telegram verificados. As linhas «Sistema anterior» ou «Entrega não comprovada» são mantidas separadamente e não provam um envio.","С 27 августа: подтверждённые сигналы Telegram. Строки «Прежняя система» или «Доставка не подтверждена» хранятся отдельно и не доказывают отправку.","自 8 月 27 日起：Telegram 信号均需验证。“旧系统”或“发送未证实”的记录单独保留，不能作为已发送的证明。"],
    ["Charger plus","Load more","Cargar más","Carregar mais","Загрузить ещё","加载更多"],
    ["Gestion intelligente du capital","Smart capital management","Gestión inteligente del capital","Gestão inteligente do capital","Разумное управление капиталом","智能资金管理"],
    ["Ma bankroll.","My bankroll.","Mi bankroll.","A minha bankroll.","Мой банкролл.","我的资金。"],
    ["Maîtriser le risque.","Control risk.","Controlar el riesgo.","Controlar o risco.","Контроль риска.","控制风险。"],
    ["Ajustez votre capital et la cote pour obtenir trois niveaux de mise clairs. L’objectif n’est pas de miser plus, mais de garder une méthode cohérente et lisible.","Adjust your capital and the odds to obtain three clear allocation levels. The aim is to keep a consistent, readable method.","Ajusta tu capital y la cuota para obtener tres niveles de asignación claros. El objetivo es mantener un método coherente y legible.","Ajuste o seu capital e a odd para obter três níveis de alocação claros. O objetivo é manter um método coerente e fácil de entender.","Укажите капитал и коэффициент, чтобы получить три понятных уровня распределения. Цель — сохранить последовательный и понятный метод.","调整资金和赔率，获得三个清晰的分配级别，保持一致且易懂的方法。"],
    ["Calcul instantané","Instant calculation","Cálculo instantáneo","Cálculo instantâneo","Мгновенный расчёт","即时计算"],
    ["Capital enregistré","Saved capital","Capital guardado","Capital guardado","Сохранённый капитал","已保存资金"],
    ["Suivi gains et pertes","Track gains and losses","Seguimiento de ganancias y pérdidas","Acompanhamento de ganhos e perdas","Учёт результатов","盈亏跟踪"],
    ["Outil pédagogique 18+","Educational tool 18+","Herramienta educativa 18+","Ferramenta educativa 18+","Обучающий инструмент 18+","教学工具 18+"],
    ["Espace membre","Member area","Área de miembros","Área de membro","Личный кабинет","会员专区"],
    ["Connexion sécurisée","Secure login","Conexión segura","Acesso seguro","Безопасный вход","安全登录"],
    ["Retrouvez votre capital et votre historique personnel.","Access your capital and personal history.","Consulta tu capital y tu historial personal.","Consulte o seu capital e histórico pessoal.","Откройте свой капитал и личную историю.","查看您的资金和个人记录。"],
    ["Accéder à mon espace →","Open my account →","Acceder a mi espacio →","Aceder à minha área →","Открыть кабинет →","进入我的账户 →"],
    ["Pas encore de code ?","No code yet?","¿Aún no tienes código?","Ainda não tens código?","Ещё нет кода?","还没有访问码？"],
    ["Étape 1","Step 1","Paso 1","Etapa 1","Шаг 1","第 1 步"],
    ["Étape 2","Step 2","Paso 2","Etapa 2","Шаг 2","第 2 步"],
    ["Étape 3","Step 3","Paso 3","Etapa 3","Шаг 3","第 3 步"],
    ["Capital de référence","Reference capital","Capital de referencia","Capital de referência","Исходный капитал","参考资金"],
    ["Montant utilisé uniquement pour calculer les repères de mise.","Amount used only to calculate allocation guidelines.","Importe utilizado solo para calcular las referencias de asignación.","Montante usado apenas para calcular as referências de alocação.","Сумма используется только для расчёта ориентиров.","该金额仅用于计算分配参考。"],
    ["Modifier le capital","Change capital","Modificar capital","Alterar capital","Изменить капитал","修改资金"],
    ["Enregistrer","Save","Guardar","Guardar","Сохранить","保存"],
    ["Annuler","Cancel","Cancelar","Cancelar","Отмена","取消"],
    ["Cote du bookmaker","Operator odds","Cuota del operador","Odd do operador","Коэффициент оператора","平台赔率"],
    ["Une cote élevée réduit automatiquement la mise proposée.","Higher odds automatically reduce the suggested allocation.","Una cuota alta reduce automáticamente la asignación sugerida.","Uma odd mais alta reduz automaticamente a alocação sugerida.","Более высокий коэффициент автоматически уменьшает рекомендуемую сумму.","赔率越高，建议分配金额会自动降低。"],
    ["Choisissez votre niveau de prudence","Choose your caution level","Elige tu nivel de prudencia","Escolha o seu nível de prudência","Выберите уровень осторожности","选择谨慎程度"],
    ["Trois repères simples, calculés à partir de votre capital et de la cote sélectionnée.","Three simple guidelines calculated from your capital and selected odds.","Tres referencias sencillas calculadas según tu capital y la cuota elegida.","Três referências simples calculadas a partir do seu capital e da odd escolhida.","Три простых ориентира, рассчитанных по капиталу и выбранному коэффициенту.","根据您的资金和所选赔率计算三个简单参考。"],
    ["Prudent","Cautious","Prudente","Prudente","Осторожный","谨慎"],
    ["Équilibré","Balanced","Equilibrado","Equilibrado","Сбалансированный","均衡"],
    ["Offensif","Aggressive","Ofensivo","Ofensivo","Активный","进取"],
    ["Exposition minimale pour préserver le capital.","Minimum exposure to preserve capital.","Exposición mínima para preservar el capital.","Exposição mínima para preservar o capital.","Минимальная нагрузка для сохранения капитала.","最低风险敞口，以保护资金。"],
    ["Compromis entre prudence et potentiel.","Balance between caution and potential.","Equilibrio entre prudencia y potencial.","Equilíbrio entre prudência e potencial.","Баланс осторожности и потенциала.","兼顾谨慎与潜力。"],
    ["Exposition plus forte et variance plus élevée.","Higher exposure and greater variance.","Mayor exposición y variación.","Maior exposição e variação.","Более высокая нагрузка и изменчивость.","更高风险敞口和波动。"],
    ["Tableau personnel","Personal dashboard","Panel personal","Painel pessoal","Личная таблица","个人面板"],
    ["Résultat gagnant","Winning result","Resultado acertado","Resultado certo","Успешный результат","命中结果"],
    ["Résultat perdant","Losing result","Resultado fallado","Resultado errado","Неуспешный результат","未命中结果"],
    ["Solde net","Net balance","Saldo neto","Saldo líquido","Чистый баланс","净余额"],
    ["Réussite","Success rate","Acierto","Taxa de acerto","Успешность","命中率"],
    ["Mon espace","My account","Mi espacio","A minha área","Мой кабинет","我的账户"],
    ["Entre ton email pour recevoir un code de connexion","Enter your email to receive a login code","Introduce tu email para recibir un código de acceso","Introduz o teu email para receber um código de acesso","Введите email, чтобы получить код входа","输入邮箱以接收登录码"],
    ["Recevoir mon code →","Send my code →","Recibir mi código →","Receber o meu código →","Получить код →","获取登录码 →"],
    ["Code reçu par email","Code received by email","Código recibido por email","Código recebido por email","Код из письма","邮件中的访问码"],
    ["Se connecter →","Log in →","Iniciar sesión →","Entrar →","Войти →","登录 →"],
    ["← Changer d'email / renvoyer un code","← Change email / resend code","← Cambiar email / reenviar código","← Alterar email / reenviar código","← Изменить email / отправить код снова","← 更换邮箱 / 重新发送访问码"],
    ["📩 Rejoindre le canal Telegram","📩 Join the Telegram channel","📩 Unirse al canal de Telegram","📩 Entrar no canal Telegram","📩 Вступить в Telegram-канал","📩 加入 Telegram 频道"],
    ["⚙️ Gérer / résilier mon abonnement","⚙️ Manage / cancel my subscription","⚙️ Gestionar / cancelar mi suscripción","⚙️ Gerir / cancelar a minha assinatura","⚙️ Управление / отмена подписки","⚙️ 管理 / 取消订阅"],
    ["↗️ Changer d'offre","↗️ Change plan","↗️ Cambiar plan","↗️ Alterar plano","↗️ Сменить тариф","↗️ 更换套餐"],
    ["Analyses restantes / jour","Analyses remaining / day","Análisis restantes / día","Análises restantes / dia","Осталось анализов / день","今日剩余分析"],
    ["Analyses utilisées / jour","Analyses used / day","Análisis utilizados / día","Análises utilizadas / dia","Использовано анализов / день","今日已用分析"],
    ["Membre depuis","Member since","Miembro desde","Membro desde","Участник с","加入日期"],
    ["Parraine un ami","Invite a friend","Invita a un amigo","Convida um amigo","Пригласить друга","邀请好友"],
    ["30 jours gratuits à chacun","30 free days each","30 días gratis para cada uno","30 dias grátis para cada um","По 30 бесплатных дней каждому","双方各获 30 天免费使用"],
    ["Copier","Copy","Copiar","Copiar","Копировать","复制"],
    ["Performance par formule","Performance by plan","Rendimiento por plan","Desempenho por plano","Результаты по тарифам","各套餐表现"],
    ["Mes derniers résultats","My latest results","Mis últimos resultados","Os meus últimos resultados","Мои последние результаты","我的最新结果"],
    ["Passe au niveau supérieur","Upgrade your plan","Mejora tu plan","Suba de plano","Перейти на следующий тариф","升级套餐"],
    ["Débloque plus d'analyses par jour et les alertes Signal Fort.","Unlock more daily analyses and Strong Signal alerts.","Desbloquea más análisis diarios y alertas de Señal Fuerte.","Desbloqueie mais análises diárias e alertas de Sinal Forte.","Получайте больше анализов в день и уведомления «Сильный сигнал».","解锁更多每日分析和强信号提醒。"],
    ["Questions fréquentes","Frequently asked questions","Preguntas frecuentes","Perguntas frequentes","Частые вопросы","常见问题"],
    ["Tout ce que tu dois savoir sur le Conseil IA, les abonnements et la méthode d'analyse.","Everything you need to know about the AI Council, subscriptions and the analysis method.","Todo lo que debes saber sobre el Consejo IA, las suscripciones y el método de análisis.","Tudo o que precisa de saber sobre o Conselho de IA, assinaturas e método de análise.","Всё о Совете ИИ, подписках и методе анализа.","关于 AI 评议会、订阅和分析方法的一切信息。"],
    ["Qui est le Conseil IA ?","What is the AI Council?","¿Qué es el Consejo IA?","O que é o Conselho de IA?","Что такое Совет ИИ?","什么是 AI 评议会？"],
    ["Comment est choisie l'analyse du jour ?","How is the daily analysis selected?","¿Cómo se elige el análisis del día?","Como é escolhida a análise do dia?","Как выбирается анализ дня?","如何选择每日分析？"],
    ["Les résultats affichés sont-ils réels ?","Are the displayed results real?","¿Los resultados mostrados son reales?","Os resultados apresentados são reais?","Реальны ли показанные результаты?","显示的结果真实吗？"],
    ["Comment fonctionnent les abonnements ?","How do subscriptions work?","¿Cómo funcionan las suscripciones?","Como funcionam as assinaturas?","Как работают подписки?","订阅如何运作？"],
    ["Quand les analyses sont-elles publiées ?","When are analyses published?","¿Cuándo se publican los análisis?","Quando são publicadas as análises?","Когда публикуются анализы?","分析何时发布？"],
    ["Pourquoi certains matchs en direct ne sont-ils pas analysables ?","Why can some live matches not be analysed?","¿Por qué no se pueden analizar algunos partidos en directo?","Porque é que alguns jogos ao vivo não podem ser analisados?","Почему некоторые матчи в эфире нельзя анализировать?","为什么有些直播比赛无法分析？"],
    ["Quels sports sont analysés ?","Which sports are analysed?","¿Qué deportes se analizan?","Que desportos são analisados?","Какие виды спорта анализируются?","分析哪些运动？"],
    ["Est-ce que TousLesMatchs garantit des gains ?","Does TousLesMatchs guarantee returns?","¿TousLesMatchs garantiza ganancias?","O TousLesMatchs garante ganhos?","Гарантирует ли TousLesMatchs результат?","TousLesMatchs 保证收益吗？"],
    ["Comment fonctionne Hermès","How Hermès works","Cómo funciona Hermès","Como funciona o Hermès","Как работает Hermès","Hermès 如何运作"],
    ["Le Concile ne devine pas. Voici sa méthode en 4 étapes.","The Council does not guess. Here is its four-step method.","El Consejo no adivina. Este es su método en cuatro pasos.","O Conselho não adivinha. Este é o seu método em quatro etapas.","Совет не гадает. Его метод состоит из четырёх этапов.","评议会不靠猜测。其方法分为四步。"],
    ["Collecte vérifiée","Verified data collection","Recopilación verificada","Recolha verificada","Проверенный сбор данных","经验证的数据采集"],
    ["Publication et diffusion","Publication and delivery","Publicación y difusión","Publicação e envio","Публикация и отправка","发布和发送"],
    ["Résultats tracés, modèle amélioré","Recorded results, improved model","Resultados registrados, modelo mejorado","Resultados registados, modelo melhorado","Учёт результатов и улучшение модели","记录结果并改进模型"],
    ["Pourquoi nous faire confiance ?","Why trust us?","¿Por qué confiar en nosotros?","Porquê confiar em nós?","Почему нам доверяют?","为什么信任我们？"],
    ["Résultats gagnés et perdus affichés","Won and lost results displayed","Resultados acertados y fallados visibles","Resultados certos e errados apresentados","Показаны успешные и неуспешные результаты","公开命中与未命中结果"],
    ["Historique daté et vérifiable","Dated, verifiable history","Historial fechado y verificable","Histórico datado e verificável","История по датам с возможностью проверки","按日期记录且可核查"],
    ["Paiement sécurisé par Stripe","Secure payment with Stripe","Pago seguro con Stripe","Pagamento seguro com Stripe","Безопасная оплата через Stripe","Stripe 安全付款"],
    ["Abonnement sans engagement","No-commitment subscription","Suscripción sin compromiso","Assinatura sem compromisso","Подписка без обязательств","订阅无长期承诺"],
    ["Données personnelles protégées","Personal data protected","Datos personales protegidos","Dados pessoais protegidos","Персональные данные защищены","个人数据受保护"],
    ["Critères de sélection transparents","Transparent selection criteria","Criterios de selección transparentes","Critérios de seleção transparentes","Прозрачные критерии отбора","透明的筛选标准"],
    ["Prêt à tester Hermès ?","Ready to try Hermès?","¿Listo para probar Hermès?","Pronto para experimentar o Hermès?","Готовы попробовать Hermès?","准备体验 Hermès？"],
    ["Accès membre","Member access","Acceso de miembro","Acesso de membro","Вход для участников","会员登录"],
    ["Entre ton email et ton code d'accès reçu par email après paiement.","Enter your email and the access code received after payment.","Introduce tu email y el código de acceso recibido tras el pago.","Introduz o teu email e o código de acesso recebido após o pagamento.","Введите email и код доступа, полученный после оплаты.","请输入邮箱和付款后收到的访问码。"],
    ["Performance par formule","Performance by plan","Rendimiento por plan","Desempenho por plano","Результаты по тарифам","各套餐表现"],
    ["Suivi des gains et pertes","Gain and loss tracking","Seguimiento de ganancias y pérdidas","Acompanhamento de ganhos e perdas","Учёт результатов","盈亏跟踪"],
    ["Les stratégies de mise restent gratuites. La sauvegarde de vos résultats personnels nécessite une connexion.","Capital allocation strategies remain free. Saving your personal results requires you to log in.","Las estrategias de asignación siguen siendo gratuitas. Para guardar tus resultados personales debes iniciar sesión.","As estratégias de alocação continuam gratuitas. Para guardar os seus resultados pessoais, é necessário iniciar sessão.","Стратегии распределения капитала остаются бесплатными. Для сохранения личных результатов необходимо войти.","资金分配策略保持免费。保存个人结果需要登录。"],
    ["Découvrir les offres →","Discover plans →","Descubrir planes →","Descobrir planos →","Посмотреть тарифы →","查看套餐 →"],
    ["Enregistrez chaque résultat pour suivre l’évolution réelle de votre capital.","Record each result to track the actual change in your capital.","Registra cada resultado para seguir la evolución real de tu capital.","Registe cada resultado para acompanhar a evolução real do seu capital.","Записывайте каждый результат, чтобы видеть реальное изменение капитала.","记录每次结果，跟踪资金的真实变化。"],
    ["Chaque ami qui s'abonne grâce à ton lien vous offre","Each friend who subscribes through your link gives you both","Cada amigo que se suscriba con tu enlace os ofrece","Cada amigo que assine pelo teu link oferece a ambos","Каждый друг, оформивший подписку по вашей ссылке, дарит вам обоим","每位通过您的链接订阅的好友都会让双方获得"],
    ["Invité","Guest","Invitado","Convidado","Гость","访客"],
    ["Équipe à domicile","Home team","Equipo local","Equipa da casa","Хозяева","主队"],
    ["Équipe à l'extérieur","Away team","Equipo visitante","Equipa visitante","Гости","客队"],
    ["⚠️ Hors ligne — données de la dernière consultation.","⚠️ Offline — data from the last visit.","⚠️ Sin conexión — datos de la última consulta.","⚠️ Offline — dados da última consulta.","⚠️ Нет сети — данные последнего просмотра.","⚠️ 离线 — 显示上次访问的数据。"],
    ["Analyse sportive assistée par IA","AI-assisted sports analysis","Análisis deportivo asistido por IA","Análise desportiva assistida por IA","Спортивный анализ с ИИ","AI 辅助体育分析"],
    ["LES JEUX D'ARGENT ET DE HASARD PEUVENT ETRE DANGEREUX : pertes d'argent, conflits familiaux, addiction.","GAMBLING CAN BE DANGEROUS: financial loss, family conflict and addiction.","LOS JUEGOS DE AZAR PUEDEN SER PELIGROSOS: pérdidas económicas, conflictos familiares y adicción.","OS JOGOS DE AZAR PODEM SER PERIGOSOS: perdas financeiras, conflitos familiares e dependência.","АЗАРТНЫЕ ИГРЫ МОГУТ БЫТЬ ОПАСНЫ: финансовые потери, семейные конфликты и зависимость.","博彩可能造成危害：经济损失、家庭矛盾和成瘾。"],
    ["LES JEUX D'ARGENT ET DE HASARD PEUVENT ÊTRE DANGEREUX : pertes d'argent, conflits familiaux, addiction.","GAMBLING CAN BE DANGEROUS: financial loss, family conflict and addiction.","LOS JUEGOS DE AZAR PUEDEN SER PELIGROSOS: pérdidas económicas, conflictos familiares y adicción.","OS JOGOS DE AZAR PODEM SER PERIGOSOS: perdas financeiras, conflitos familiares e dependência.","АЗАРТНЫЕ ИГРЫ МОГУТ БЫТЬ ОПАСНЫ: финансовые потери, семейные конфликты и зависимость.","博彩可能造成危害：经济损失、家庭矛盾和成瘾。"],
    ["LES JEUX D'ARGENT ET DE HASARD PEUVENT ÊTRE DANGEREUX : pertes d'argent, conflits familiaux, addiction. Conseils sur joueurs-info-service.fr — 09 74 75 13 13.","GAMBLING CAN BE DANGEROUS: financial loss, family conflict and addiction. Help: joueurs-info-service.fr · +33 9 74 75 13 13.","LOS JUEGOS DE AZAR PUEDEN SER PELIGROSOS: pérdidas económicas, conflictos familiares y adicción. Ayuda: joueurs-info-service.fr · +33 9 74 75 13 13.","OS JOGOS DE AZAR PODEM SER PERIGOSOS: perdas financeiras, conflitos familiares e dependência. Ajuda: joueurs-info-service.fr · +33 9 74 75 13 13.","АЗАРТНЫЕ ИГРЫ МОГУТ БЫТЬ ОПАСНЫ: финансовые потери, семейные конфликты и зависимость. Помощь: joueurs-info-service.fr · +33 9 74 75 13 13.","博彩可能造成危害：经济损失、家庭矛盾和成瘾。帮助：joueurs-info-service.fr · +33 9 74 75 13 13。"],
    ["Conseils sur joueurs-info-service.fr - 09 74 75 13 13, appel non surtaxé.","Help: joueurs-info-service.fr · +33 9 74 75 13 13, standard call rates.","Ayuda: joueurs-info-service.fr · +33 9 74 75 13 13, llamada sin recargo.","Ajuda: joueurs-info-service.fr · +33 9 74 75 13 13, chamada sem custo adicional.","Помощь: joueurs-info-service.fr · +33 9 74 75 13 13, без повышенной тарификации.","帮助：joueurs-info-service.fr · +33 9 74 75 13 13，按普通通话收费。"],
    ["Conseils sur joueurs-info-service.fr — 09 74 75 13 13 (appel non surtaxé).","Help: joueurs-info-service.fr · +33 9 74 75 13 13, standard call rates.","Ayuda: joueurs-info-service.fr · +33 9 74 75 13 13, llamada sin recargo.","Ajuda: joueurs-info-service.fr · +33 9 74 75 13 13, chamada sem custo adicional.","Помощь: joueurs-info-service.fr · +33 9 74 75 13 13, без повышенной тарификации.","帮助：joueurs-info-service.fr · +33 9 74 75 13 13，按普通通话收费。"],
    ["18+ · TousLesMatchs ne garantit aucun gain · Analyses informatives","18+ · TousLesMatchs guarantees no return · Informational analyses","18+ · TousLesMatchs no garantiza ganancias · Análisis informativos","18+ · O TousLesMatchs não garante ganhos · Análises informativas","18+ · TousLesMatchs не гарантирует результат · Информационная аналитика","18+ · TousLesMatchs 不保证收益 · 仅供信息参考"],
    ["18+ · TousLesMatchs ne garantit aucun gain · Analyses informatives.","18+ · TousLesMatchs guarantees no return · Informational analyses.","18+ · TousLesMatchs no garantiza ganancias · Análisis informativos.","18+ · O TousLesMatchs não garante ganhos · Análises informativas.","18+ · TousLesMatchs не гарантирует результат · Информационная аналитика.","18+ · TousLesMatchs 不保证收益 · 仅供信息参考。"],
    ["18+ · TousLesMatchs ne garantit aucun gain · Analyses informatives · Jouez uniquement ce que vous pouvez perdre.","18+ · TousLesMatchs guarantees no return · Informational analyses · Risk only what you can afford to lose.","18+ · TousLesMatchs no garantiza ganancias · Análisis informativos · Arriesga solo lo que puedas permitirte perder.","18+ · O TousLesMatchs não garante ganhos · Análises informativas · Arrisque apenas o que pode perder.","18+ · TousLesMatchs не гарантирует результат · Информационная аналитика · Рискуйте только доступной суммой.","18+ · TousLesMatchs 不保证收益 · 仅供信息参考 · 仅承担您能承受的损失。"],
    ["⚠️ 18+ · Cet outil est un simulateur pédagogique de gestion de capital. Il ne constitue ni un conseil, ni une incitation, ni une garantie de gain. Jouer comporte des risques : endettement, isolement, dépendance. Appelez le 09 74 75 13 13 —","⚠️ 18+ · This capital-management simulator is for educational purposes. It is not advice, encouragement or a guarantee. Gambling carries risks including debt, isolation and addiction. Call +33 9 74 75 13 13 —","⚠️ 18+ · Este simulador de gestión de capital es educativo. No constituye consejo, incentivo ni garantía. El juego implica riesgos: endeudamiento, aislamiento y adicción. Llame al +33 9 74 75 13 13 —","⚠️ 18+ · Este simulador de gestão de capital é educativo. Não constitui conselho, incentivo ou garantia. O jogo envolve riscos: dívida, isolamento e dependência. Ligue +33 9 74 75 13 13 —","⚠️ 18+ · Этот симулятор управления капиталом предназначен для обучения. Это не совет, призыв или гарантия. Азартные игры несут риск долгов, изоляции и зависимости. Телефон помощи: +33 9 74 75 13 13 —","⚠️ 18+ · 本资金管理模拟器仅用于教学，不构成建议、诱导或任何保证。博彩可能导致债务、孤立和成瘾。求助电话：+33 9 74 75 13 13 —"],
    ["18+ · Jeu responsable ·","18+ · Responsible gambling ·","18+ · Juego responsable ·","18+ · Jogo responsável ·","18+ · Ответственная игра ·","18+ · 负责任博彩 ·"],
    ["LES JEUX D'ARGENT ET DE HASARD PEUVENT ÊTRE DANGEREUX : pertes d'argent, conflits","GAMBLING CAN BE DANGEROUS: financial loss and family conflict","LOS JUEGOS DE AZAR PUEDEN SER PELIGROSOS: pérdidas económicas y conflictos familiares","OS JOGOS DE AZAR PODEM SER PERIGOSOS: perdas financeiras e conflitos familiares","АЗАРТНЫЕ ИГРЫ МОГУТ БЫТЬ ОПАСНЫ: финансовые потери и семейные конфликты","博彩可能造成危害：经济损失和家庭矛盾"],
    ["familiaux, addiction. Conseils sur","and addiction. Help:","y adicción. Ayuda:","e dependência. Ajuda:","и зависимость. Помощь:","以及成瘾。帮助："],
    ["— 09 74 75 13 13, appel non surtaxé.","— +33 9 74 75 13 13, standard call rates.","— +33 9 74 75 13 13, llamada sin recargo.","— +33 9 74 75 13 13, chamada sem custo adicional.","— +33 9 74 75 13 13, без повышенной тарификации.","— +33 9 74 75 13 13，按普通通话收费。"],
    ["Oui, à 100%. Tous les résultats sont publics sur la","Yes. Every result is public on the","Sí. Todos los resultados son públicos en la","Sim. Todos os resultados são públicos na","Да. Все результаты опубликованы на","是的。所有结果都公开在"],
    ["page Performances","Performance page","página de Rendimiento","página de Desempenho","странице результатов","表现页面"],
    [". Nous ne cachons aucun pick perdu. Les statistiques (winrate, profit) sont calculées automatiquement depuis la base de données, sans modification manuelle.",". We do not hide losing selections. Success-rate and profit figures are calculated automatically from the database without manual changes.",". No ocultamos selecciones falladas. La tasa de acierto y el beneficio se calculan automáticamente desde la base de datos, sin cambios manuales.",". Não ocultamos seleções erradas. A taxa de acerto e o lucro são calculados automaticamente a partir da base de dados, sem alterações manuais.",". Мы не скрываем проигрышные выборы. Доля успеха и результат рассчитываются автоматически по базе данных без ручных изменений.","。我们不会隐藏未命中的推荐。命中率和收益由数据库自动计算，不进行人工修改。"],
    ["Seuil actuel de diffusion :","Current delivery threshold:","Umbral actual de envío:","Limite atual de envio:","Текущий порог отправки:","当前发送门槛："],
    [", avec au moins 3 votes concordants sur 5. Cote bookmaker réelle entre 1,30 et 2,10.",", with at least three matching votes out of five. Verified operator odds between 1.30 and 2.10.",", con al menos tres votos coincidentes de cinco. Cuota real del operador entre 1,30 y 2,10.",", com pelo menos três votos concordantes em cinco. Odd real do operador entre 1,30 e 2,10.",", минимум три совпадающих голоса из пяти. Реальный коэффициент оператора от 1,30 до 2,10.","，至少五票中三票一致。经验证的平台赔率在 1.30 至 2.10 之间。"],
    ["— jusqu'à 3 signaux/jour, Telegram Standard.","— up to three signals per day via Standard Telegram.","— hasta tres señales al día por Telegram Standard.","— até três sinais por dia no Telegram Standard.","— до трёх сигналов в день в Standard Telegram.","— 每天最多三条信号，通过 Standard Telegram 发送。"],
    ["— jusqu'à 10 signaux/jour, Telegram Premium, inclut Standard.","— up to ten signals per day via Premium Telegram, including Standard.","— hasta diez señales al día por Telegram Premium, incluido Standard.","— até dez sinais por dia no Telegram Premium, incluindo Standard.","— до десяти сигналов в день в Premium Telegram, включая Standard.","— 每天最多十条信号，通过 Premium Telegram 发送，并包含 Standard。"],
    ["Voir les tarifs à jour sur la","See current pricing on the","Consulta los precios actuales en la","Consulte os preços atuais na","Актуальные тарифы указаны на","最新价格请见"],
    ["page d'accueil","home page","página de inicio","página inicial","главной странице","首页"],
    [". Paiement sécurisé par Stripe. Annulation possible à tout moment.",". Secure payment with Stripe. Cancel at any time.",". Pago seguro con Stripe. Cancela cuando quieras.",". Pagamento seguro com Stripe. Cancele a qualquer momento.",". Безопасная оплата через Stripe. Отмена в любое время.","。Stripe 安全付款，可随时取消。"],
    ["Non. Les analyses sont fournies à titre informatif uniquement. TousLesMatchs ne garantit aucun gain. Les jeux d'argent et de hasard comportent des risques. Jouez uniquement ce que vous pouvez perdre. Conseils :","No. Analyses are informational only. TousLesMatchs guarantees no return. Gambling carries risks. Risk only what you can afford to lose. Help:","No. Los análisis son solo informativos. TousLesMatchs no garantiza ganancias. El juego implica riesgos. Arriesga solo lo que puedas permitirte perder. Ayuda:","Não. As análises são apenas informativas. O TousLesMatchs não garante ganhos. O jogo envolve riscos. Arrisque apenas o que pode perder. Ajuda:","Нет. Аналитика носит только информационный характер. TousLesMatchs не гарантирует результат. Азартные игры связаны с риском. Рискуйте только доступной суммой. Помощь:","不。分析仅供参考，TousLesMatchs 不保证收益。博彩存在风险，请仅承担您能承受的损失。帮助："],
    ["Le Concile combine 5 IA indépendantes. Chaque IA vote séparément à partir des statistiques live, de l'historique, de la dynamique et des probabilités. Le signal est mis en avant seulement si les votes convergent. Si la convergence est faible, aucun signal n'est forcé.","The Council combines five independent AIs. Each AI votes separately using live statistics, history, match dynamics and probabilities. A signal is highlighted only when the votes converge. No signal is forced when agreement is weak.","El Consejo reúne cinco IA independientes. Cada IA vota por separado usando estadísticas en directo, historial, dinámica y probabilidades. Solo se destaca una señal cuando los votos convergen. Si el acuerdo es débil, no se fuerza ninguna señal.","O Conselho reúne cinco IA independentes. Cada IA vota separadamente com base em estatísticas ao vivo, histórico, dinâmica e probabilidades. Um sinal só é destacado quando os votos convergem. Se o acordo for fraco, nenhum sinal é forçado.","Совет объединяет пять независимых ИИ. Каждый голосует отдельно на основе текущей статистики, истории, динамики и вероятностей. Сигнал выделяется только при совпадении голосов. При слабом согласии сигнал не формируется.","评议会由五个独立 AI 组成。每个 AI 根据实时统计、历史、比赛走势和概率分别投票。只有投票趋同时才突出显示信号；共识较弱时不会强行发布。"],
    ["Le Conseil IA compare le consensus entre agents, la value (écart entre probabilité estimée et cote du marché), les objections soulevées, les données manquantes et le niveau de risque propre au sport. Si le doute reste trop fort, c'est NO BET — aucune analyse n'est publiée plutôt que de forcer un pick fragile.","The AI Council compares agreement between agents, the gap between estimated probability and market odds, objections, missing data and sport-specific risk. If uncertainty remains too high, no analysis is published.","El Consejo IA compara el consenso, la diferencia entre probabilidad estimada y cuota de mercado, las objeciones, los datos ausentes y el riesgo propio del deporte. Si la incertidumbre sigue siendo alta, no se publica ningún análisis.","O Conselho de IA compara o consenso, a diferença entre a probabilidade estimada e a odd do mercado, objeções, dados em falta e o risco específico do desporto. Se a incerteza continuar elevada, nenhuma análise é publicada.","Совет ИИ сравнивает согласие агентов, разницу между расчётной вероятностью и рыночным коэффициентом, возражения, недостающие данные и риск конкретного вида спорта. При высокой неопределённости анализ не публикуется.","AI 评议会会比较模型共识、估算概率与市场赔率的差距、反对意见、缺失数据以及该运动的特定风险。如果不确定性仍然过高，则不发布分析。"],
    ["Le pick gratuit est publié lorsqu'une sélection gratuite est disponible. En Live IA, le produit football se concentre sur la 15e à la 45e minute, avec Over/Under 2,5 et un accord minimum de 3 IA sur 5.","The free pick is published when a free selection is available. Live AI focuses on football between minutes 15 and 45, with Over/Under 2.5 and agreement from at least three of five AIs.","La selección gratuita se publica cuando está disponible. La IA en directo se centra en el fútbol entre los minutos 15 y 45, con Más/Menos 2,5 y el acuerdo de al menos tres de cinco IA.","A seleção gratuita é publicada quando está disponível. A IA ao vivo foca-se no futebol entre os minutos 15 e 45, com Mais/Menos 2,5 e acordo de pelo menos três de cinco IA.","Бесплатный выбор публикуется, когда он доступен. ИИ-анализ в эфире работает с футбольными матчами с 15-й по 45-ю минуту, для тотала 2,5 требуется согласие минимум трёх из пяти ИИ.","有免费推荐时才会发布。AI 实时分析专注于足球比赛第 15 至 45 分钟的大/小 2.5 球市场，并要求至少五个 AI 中有三个达成一致。"],
    ["Un match peut être écarté s'il est hors périmètre, hors de la fenêtre 15e-45e minute, si les données sont insuffisantes ou si le Concile n'obtient pas au moins 4 votes sur 5 sur Over/Under 2,5.","A match may be excluded when it is outside scope or the 15–45 minute window, when data is insufficient, or when the Council does not obtain at least three matching votes out of five on Over/Under 2.5.","Un partido puede excluirse si está fuera del ámbito o de la ventana de los minutos 15–45, si faltan datos o si el Consejo no obtiene al menos tres votos coincidentes de cinco en Más/Menos 2,5.","Um jogo pode ser excluído se estiver fora do âmbito ou da janela de 15–45 minutos, se os dados forem insuficientes ou se o Conselho não obtiver pelo menos três votos concordantes em cinco em Mais/Menos 2,5.","Матч исключается, если он вне охвата или окна 15–45 минут, если данных недостаточно либо Совет не получил минимум три совпадающих голоса из пяти по тоталу 2,5.","如果比赛不在范围内或不在第 15–45 分钟窗口、数据不足，或评议会未在大/小 2.5 球上获得至少五票中的三票一致，则会排除该比赛。"],
    ["Le football uniquement.","Football only.","Solo fútbol.","Apenas futebol.","Только футбол.","仅限足球。"],
    ["Hermès collecte les matchs via API-Sports, puis vérifie chaque donnée sur 3 sources indépendantes. Aucun match non confirmé n'est analysé.","Hermès collects matches through API-Sports, then checks every data point against three independent sources. Unconfirmed matches are not analysed.","Hermès recopila los partidos mediante API-Sports y verifica cada dato en tres fuentes independientes. No se analiza ningún partido sin confirmar.","O Hermès recolhe os jogos através da API-Sports e verifica cada dado em três fontes independentes. Jogos não confirmados não são analisados.","Hermès получает матчи через API-Sports и проверяет каждый показатель по трём независимым источникам. Неподтверждённые матчи не анализируются.","Hermès 通过 API-Sports 获取比赛，并用三个独立来源核对每项数据。未确认的比赛不会被分析。"],
    ["Chaque IA analyse stats, dynamique, historique, value et marchés selon le sport. 5/5 = signal unanime, 4/5 = signal renforcé, 3/5 = signal validé. À 2/5 ou moins, aucun signal client n’est diffusé.","Each AI analyses statistics, dynamics, history and markets. 5/5 means unanimous, 4/5 reinforced and 3/5 validated. With 2/5 or less, no client signal is sent.","Cada IA analiza estadísticas, dinámica, historial y mercados. 5/5 significa unanimidad, 4/5 señal reforzada y 3/5 señal validada. Con 2/5 o menos, no se envía ninguna señal.","Cada IA analisa estatísticas, dinâmica, histórico e mercados. 5/5 significa unanimidade, 4/5 sinal reforçado e 3/5 sinal validado. Com 2/5 ou menos, nenhum sinal é enviado.","Каждый ИИ анализирует статистику, динамику, историю и рынки. 5/5 — единогласно, 4/5 — усиленный сигнал, 3/5 — подтверждённый. При 2/5 и ниже сигнал клиентам не отправляется.","每个 AI 分析统计、走势、历史和市场。5/5 表示全票一致，4/5 表示强化信号，3/5 表示验证通过；2/5 或更低时不向客户发送信号。"],
    ["Le pick est publié sur le site, envoyé par email et notifié sur Telegram. Les abonnés Standard et Premium reçoivent les signaux validés en temps réel sur Telegram.","The selection is published on the site, sent by email and announced on Telegram. Standard and Premium members receive validated signals in real time on Telegram.","La selección se publica en el sitio, se envía por email y se anuncia en Telegram. Los miembros Standard y Premium reciben las señales validadas en tiempo real.","A seleção é publicada no site, enviada por email e anunciada no Telegram. Os membros Standard e Premium recebem os sinais validados em tempo real.","Выбор публикуется на сайте, отправляется по email и в Telegram. Участники Standard и Premium получают подтверждённые сигналы в Telegram в реальном времени.","推荐会发布在网站上，并通过邮件和 Telegram 通知。Standard 和 Premium 会员会在 Telegram 实时收到已验证信号。"],
    ["Chaque résultat est enregistré et intégré. Les stats sont réelles, mises à jour après chaque match. Le Concile apprend — pick après pick.","Every result is recorded and included. Statistics are real and updated after each match. The Council learns from each selection.","Cada resultado se registra y se integra. Las estadísticas son reales y se actualizan después de cada partido. El Consejo aprende con cada selección.","Cada resultado é registado e integrado. As estatísticas são reais e atualizadas após cada jogo. O Conselho aprende com cada seleção.","Каждый результат сохраняется и учитывается. Статистика реальна и обновляется после каждого матча. Совет учится на каждом выборе.","每个结果都会记录并纳入统计。统计数据真实，并在每场比赛后更新。评议会会从每次推荐中学习。"],
    ["Rejoins le Concile dès 4,90€/mois. Tu vois ce que 5 IA pensent vraiment.","Join the Council from €4.90/month and see what five AIs actually conclude.","Únete al Consejo desde 4,90 €/mes y descubre qué concluyen realmente cinco IA.","Junte-se ao Conselho desde 4,90 €/mês e veja o que cinco IA realmente concluem.","Присоединяйтесь к Совету от 4,90 € в месяц и смотрите выводы пяти ИИ.","每月 4.90 欧元起加入评议会，查看五个 AI 的真实结论。"],

    /* Variantes historiques et contenus injectés par l'accueil, l'app et les résultats. */
    ["TousLesMatchs — Le Conseil IA sportif","TousLesMatchs — The AI Sports Council","TousLesMatchs — El Consejo IA deportivo","TousLesMatchs — O Conselho de IA desportivo","TousLesMatchs — Спортивный Совет ИИ","TousLesMatchs — AI 体育评议会"],
    ["Votre signal","Your signal","Tu señal","O seu sinal","Ваш сигнал","您的信号"],
    ["Over ou Under 2,5.","Over or Under 2.5.","Más o Menos de 2,5.","Mais ou Menos de 2,5.","Тотал больше или меньше 2,5.","大于或小于 2.5 球。"],
    ["Entre la 15e et la 45e minute, 5 IA analysent le match. Vous recevez uniquement les signaux validés par au moins 3 IA sur 5.","Between minutes 15 and 45, five AIs analyse the match. You receive only signals validated by at least three of five AIs.","Entre los minutos 15 y 45, cinco IA analizan el partido. Solo recibes señales validadas por al menos tres de cinco IA.","Entre os minutos 15 e 45, cinco IA analisam o jogo. Recebe apenas sinais validados por pelo menos três de cinco IA.","С 15-й по 45-ю минуту матч анализируют пять ИИ. Вы получаете только сигналы, подтверждённые минимум тремя из пяти ИИ.","第 15 至 45 分钟，五个 AI 分析比赛。您只会收到至少五个 AI 中三个验证的信号。"],
    ["Football uniquement","Football only","Solo fútbol","Apenas futebol","Только футбол","仅限足球"],
    ["3 IA / 5 minimum","At least 3 of 5 AIs","Mínimo 3 de 5 IA","Mínimo 3 de 5 IA","Минимум 3 ИИ из 5","至少 3/5 AI"],
    ["Analyse sportive informative · Aucun résultat n'est garanti.","Informational sports analysis · No result is guaranteed.","Análisis deportivo informativo · Ningún resultado está garantizado.","Análise desportiva informativa · Nenhum resultado é garantido.","Спортивная аналитика носит информационный характер · Результат не гарантирован.","体育分析仅供参考 · 不保证任何结果。"],
    ["Recherche du match en direct","Searching for a live match","Buscando un partido en directo","A procurar um jogo ao vivo","Поиск матча в эфире","正在查找直播比赛"],
    ["MATCH NON ANALYSÉ","MATCH NOT ANALYSED","PARTIDO NO ANALIZADO","JOGO NÃO ANALISADO","МАТЧ НЕ ПРОАНАЛИЗИРОВАН","比赛未分析"],
    ["Aucun vote IA exploitable reçu.","No usable AI vote received.","No se recibió ningún voto IA utilizable.","Nenhum voto de IA utilizável recebido.","Не получено ни одного пригодного голоса ИИ.","未收到可用的 AI 投票。"],
    ["Méthode transparente","Transparent method","Método transparente","Método transparente","Прозрачный метод","透明方法"],
    ["Aucun résultat promis.","No result is promised.","No se promete ningún resultado.","Nenhum resultado é prometido.","Никаких обещаний результата.","不承诺任何结果。"],
    ["Données en temps réel","Real-time data","Datos en tiempo real","Dados em tempo real","Данные в реальном времени","实时数据"],
    ["Équipes, scores et minutes actualisés.","Teams, scores and minutes updated.","Equipos, marcadores y minutos actualizados.","Equipas, resultados e minutos atualizados.","Команды, счёт и минуты обновляются.","球队、比分和分钟实时更新。"],
    ["5 IA indépendantes","Five independent AIs","Cinco IA independientes","Cinco IA independentes","Пять независимых ИИ","五个独立 AI"],
    ["Accord minimum de 3 sur 5.","At least three of five must agree.","Acuerdo mínimo de tres de cinco.","Concordância mínima de três em cinco.","Минимум три совпадающих голоса из пяти.","至少五个中三个达成一致。"],
    ["Sécurisé et privé","Secure and private","Seguro y privado","Seguro e privado","Безопасно и конфиденциально","安全且私密"],
    ["Vos données restent confidentielles.","Your data remains private.","Tus datos siguen siendo confidenciales.","Os seus dados permanecem confidenciais.","Ваши данные остаются конфиденциальными.","您的数据保持私密。"],
    ["Voir tous les matchs →","See all matches →","Ver todos los partidos →","Ver todos os jogos →","Посмотреть все матчи →","查看所有比赛 →"],
    ["HISTORIQUE VÉRIFIABLE","VERIFIABLE HISTORY","HISTORIAL VERIFICABLE","HISTÓRICO VERIFICÁVEL","ПРОВЕРЯЕМАЯ ИСТОРИЯ","可核验历史"],
    ["Historique des diffusions enregistrées, sans cacher les défaites","Recorded delivery history, including losses","Historial de envíos registrados, incluidas las derrotas","Histórico de envios registados, incluindo derrotas","История зарегистрированных отправок, включая проигрыши","已记录的发送历史，包括未命中"],
    ["Avant le 27 août, les envois proviennent des marqueurs archivés. Depuis le 27 août, une preuve Telegram est obligatoire.","Before 27 August, deliveries come from archived markers. Since 27 August, Telegram proof is required.","Antes del 27 de agosto, los envíos proceden de marcadores archivados. Desde el 27 de agosto, se exige una prueba de Telegram.","Antes de 27 de agosto, os envios provêm de marcadores arquivados. Desde 27 de agosto, é obrigatória uma prova do Telegram.","До 27 августа отправки подтверждаются архивными отметками. С 27 августа обязательно подтверждение Telegram.","8 月 27 日前的发送记录来自归档标记；自 8 月 27 日起必须提供 Telegram 发送证明。"],
    ["Voir l’historique complet →","View full history →","Ver historial completo →","Ver histórico completo →","Посмотреть полную историю →","查看完整历史 →"],
    ["Diffusions résolues","Resolved deliveries","Envíos resueltos","Envios resolvidos","Завершённые отправки","已结算发送"],
    ["Gagnées / Perdues diffusées","Winning / Losing deliveries","Envíos acertados / fallados","Envios certos / errados","Выигрышные / проигрышные отправки","命中 / 未命中发送"],
    ["Taux des diffusions","Delivery success rate","Tasa de acierto de envíos","Taxa de sucesso dos envios","Доля успешных отправок","发送命中率"],
    ["Simulation des diffusions (10€)","Delivery simulation (€10)","Simulación de envíos (10 €)","Simulação dos envios (10 €)","Симуляция отправок (10 €)","发送模拟（10 欧元）"],
    ["Diffusions archivées / vérifiées","Archived / verified deliveries","Envíos archivados / verificados","Envios arquivados / verificados","Архивные / подтверждённые отправки","已归档 / 已验证发送"],
    ["Jours avec résultat mesuré","Days with measured results","Días con resultados medidos","Dias com resultados medidos","Дни с измеренным результатом","有统计结果的天数"],
    ["Les observations non diffusées ne sont pas présentées comme des signaux reçus. Les performances passées ne garantissent pas les résultats futurs.","Undelivered observations are not presented as received signals. Past performance does not guarantee future results.","Las observaciones no enviadas no se presentan como señales recibidas. El rendimiento pasado no garantiza resultados futuros.","As observações não enviadas não são apresentadas como sinais recebidos. O desempenho passado não garante resultados futuros.","Неразосланные наблюдения не выдаются за полученные сигналы. Прошлые результаты не гарантируют будущих.","未发送的观察不会计作已收到的信号。过去表现不保证未来结果。"],
    ["Historique complet depuis le 1er août","Full history since 1 August","Historial completo desde el 1 de agosto","Histórico completo desde 1 de agosto","Полная история с 1 августа","自 8 月 1 日起的完整历史"],
    ["Aucun pick gratuit disponible pour l'instant aujourd'hui.","No free selection is available yet today.","Aún no hay una selección gratuita disponible hoy.","Ainda não há uma seleção gratuita disponível hoje.","Сегодня бесплатный выбор пока недоступен.","今天暂时没有免费推荐。"],
    ["Le Concile n'a pas encore identifié de sélection correspondant à nos critères — reviens plus tard dans la journée.","The Council has not yet found a selection matching our criteria — check again later today.","El Consejo aún no ha encontrado una selección que cumpla nuestros criterios — vuelve más tarde.","O Conselho ainda não encontrou uma seleção que cumpra os critérios — volte mais tarde.","Совет пока не нашёл выбор, соответствующий нашим критериям — проверьте позже сегодня.","评议会尚未找到符合条件的推荐——请稍后再查看。"],
    ["Sans engagement","No commitment","Sin compromiso","Sem compromisso","Без обязательств","无长期承诺"],
    ["Comment ça fonctionne ?","How does it work?","¿Cómo funciona?","Como funciona?","Как это работает?","如何运作？"],
    ["Voir la méthode","See the method","Ver el método","Ver o método","Посмотреть метод","查看方法"],
    ["Résultats récents","Recent results","Resultados recientes","Resultados recentes","Недавние результаты","近期结果"],
    ["Voir tout →","See all →","Ver todo →","Ver tudo →","Посмотреть всё →","查看全部 →"],
    ["Créer un compte gratuit","Create a free account","Crear una cuenta gratis","Criar uma conta grátis","Создать бесплатный аккаунт","创建免费账户"],
    ["Gérer mon abonnement","Manage my subscription","Gestionar mi suscripción","Gerir a minha assinatura","Управлять подпиской","管理订阅"],
    ["Pronostic IA, comment ça marche","How AI analysis works","Cómo funciona el análisis IA","Como funciona a análise de IA","Как работает ИИ-анализ","AI 分析如何运作"],
    ["Les jeux d'argent et de hasard comportent des risques : isolement, endettement… Appelez le 09 74 75 13 13 (appel non surtaxé).","Gambling carries risks including isolation and debt. Call +33 9 74 75 13 13 at standard rates.","El juego implica riesgos como aislamiento y endeudamiento. Llame al +33 9 74 75 13 13 sin recargo.","O jogo envolve riscos como isolamento e endividamento. Ligue +33 9 74 75 13 13 sem custo adicional.","Азартные игры связаны с риском изоляции и долгов. Телефон помощи: +33 9 74 75 13 13, без повышенной тарификации.","博彩存在孤立和债务等风险。求助电话：+33 9 74 75 13 13，按普通通话收费。"],
    ["18+ · Interdit aux mineurs. TousLesMatchs fournit des analyses statistiques à titre informatif et ne garantit aucun gain.","18+ · Minors prohibited. TousLesMatchs provides statistical analysis for information only and guarantees no return.","18+ · Prohibido a menores. TousLesMatchs ofrece análisis estadísticos informativos y no garantiza ganancias.","18+ · Proibido a menores. O TousLesMatchs fornece análises estatísticas informativas e não garante ganhos.","18+ · Несовершеннолетним запрещено. TousLesMatchs предоставляет статистическую аналитику только в информационных целях и не гарантирует выигрыш.","18+ · 未成年人禁止参与。TousLesMatchs 仅提供统计分析，不保证收益。"],
    ["ANALYSE NON LANCÉE","ANALYSIS NOT STARTED","ANÁLISIS NO INICIADO","ANÁLISE NÃO INICIADA","АНАЛИЗ НЕ ЗАПУЩЕН","分析未启动"],
    ["Analyse non lancée","Analysis not started","Análisis no iniciado","Análise não iniciada","Анализ не запущен","分析未启动"],
    ["Analyse en attente de cote","Analysis waiting for odds","Análisis a la espera de cuota","Análise a aguardar odd","Анализ ожидает коэффициент","分析等待赔率"],
    ["Cote bookmaker O/U 2,5 indisponible dans la plage requise.","Bookmaker O/U 2.5 odds unavailable in the required range.","Cuota de la casa O/U 2,5 no disponible en el rango requerido.","Odd da casa O/U 2,5 indisponível no intervalo exigido.","Коэффициент букмекера на тотал 2,5 недоступен в требуемом диапазоне.","所需范围内暂无博彩公司大/小 2.5 赔率。"],
    ["DÉJÀ ABONNÉ ?","ALREADY SUBSCRIBED?","¿YA ESTÁS SUSCRITO?","JÁ É ASSINANTE?","УЖЕ ЕСТЬ ПОДПИСКА?","已经订阅？"],
    ["Retrouve ton accès","Recover your access","Recupera tu acceso","Recupere o seu acesso","Восстановить доступ","找回访问权限"],
    ["Entre l’email de ton abonnement et le code reçu après paiement. L’app gardera ensuite ta session et tes préférences.","Enter your subscription email and the code received after payment. The app will then keep your session and preferences.","Introduce el email de tu suscripción y el código recibido tras el pago. La app conservará tu sesión y preferencias.","Introduza o email da assinatura e o código recebido após o pagamento. A aplicação guardará a sessão e as preferências.","Введите email подписки и код, полученный после оплаты. Приложение сохранит вашу сессию и настройки.","输入订阅邮箱和付款后收到的代码。应用会保存您的会话和偏好。"],
    ["Recevoir mon code par email","Receive my code by email","Recibir mi código por email","Receber o meu código por email","Получить код по электронной почте","通过邮箱接收代码"],
    ["Crée ton compte gratuit","Create your free account","Crea tu cuenta gratis","Crie a sua conta grátis","Создайте бесплатный аккаунт","创建免费账户"],
    ["Découvre le pick gratuit du jour et les résultats publics, sans carte bancaire.","Discover today's free selection and public results, with no bank card.","Descubre la selección gratuita del día y los resultados públicos, sin tarjeta.","Descubra a seleção gratuita do dia e os resultados públicos, sem cartão.","Получите бесплатный выбор дня и открытые результаты без банковской карты.","无需银行卡即可查看今日免费推荐和公开结果。"],
    ["Les sélections Over / Under 2,5 et les alertes membres sont disponibles à partir de 4,90€/mois.","Over / Under 2.5 selections and member alerts are available from €4.90/month.","Las selecciones Más / Menos 2,5 y las alertas para miembros están disponibles desde 4,90 €/mes.","As seleções Mais / Menos 2,5 e os alertas para membros estão disponíveis desde 4,90 €/mês.","Выборы на тотал больше / меньше 2,5 и уведомления доступны от 4,90 € в месяц.","大/小 2.5 球推荐和会员提醒每月 4.90 欧元起。"],
    ["Victoire extérieur","Away win","Victoria visitante","Vitória fora","Победа гостей","客胜"],
    ["Performances","Performance","Rendimiento","Desempenho","Результаты","表现"],
    ["EMAIL","EMAIL","EMAIL","EMAIL","ЭЛЕКТРОННАЯ ПОЧТА","邮箱"],
    ["Football IA","Football AI","IA de fútbol","IA de futebol","Футбольный ИИ","足球 AI"],
    ["Football","Football","Fútbol","Futebol","Футбол","足球"],
    ["Over 2.5 buts","Over 2.5 goals","Más de 2,5 goles","Mais de 2,5 golos","Тотал больше 2,5","大于 2.5 球"],
    ["Under 2.5 buts","Under 2.5 goals","Menos de 2,5 goles","Menos de 2,5 golos","Тотал меньше 2,5","小于 2.5 球"],
    ["Sél.","Sel.","Sel.","Sel.","Выбор","推荐"],
    ["Rés.","Result","Res.","Res.","Итог","结果"],
    ["Français","French","Francés","Francês","Французский","法语"],
    ["English","English","Inglés","Inglês","Английский","英语"],
    ["Español","Spanish","Español","Espanhol","Испанский","西班牙语"],
    ["Português","Portuguese","Portugués","Português","Португальский","葡萄牙语"],
    ["Русский","Russian","Ruso","Russo","Русский","俄语"],
    ["中文","Chinese","Chino","Chinês","Китайский","中文"],
    ["Argentina","Argentina","Argentina","Argentina","Аргентина","阿根廷"],
    ["Brazil","Brazil","Brasil","Brasil","Бразилия","巴西"],
    ["Denmark","Denmark","Dinamarca","Dinamarca","Дания","丹麦"],
    ["Egypt","Egypt","Egipto","Egito","Египет","埃及"],
    ["England","England","Inglaterra","Inglaterra","Англия","英格兰"],
    ["Finland","Finland","Finlandia","Finlândia","Финляндия","芬兰"],
    ["France","France","Francia","França","Франция","法国"],
    ["Italy","Italy","Italia","Itália","Италия","意大利"],
    ["Malaysia","Malaysia","Malasia","Malásia","Малайзия","马来西亚"],
    ["Netherlands","Netherlands","Países Bajos","Países Baixos","Нидерланды","荷兰"],
    ["Portugal","Portugal","Portugal","Portugal","Португалия","葡萄牙"],
    ["Saudi-Arabia","Saudi Arabia","Arabia Saudí","Arábia Saudita","Саудовская Аравия","沙特阿拉伯"],
    ["South-Korea","South Korea","Corea del Sur","Coreia do Sul","Южная Корея","韩国"],
    ["Spain","Spain","España","Espanha","Испания","西班牙"],
    ["Turkey","Turkey","Turquía","Turquia","Турция","土耳其"],
    ["World","World","Mundo","Mundo","Мир","世界"],
    ["Liga Profesional Argentina","Argentine Primera División","Liga Profesional Argentina","Liga Profesional Argentina","Профессиональная лига Аргентины","阿根廷职业联赛"],
    ["Serie A","Serie A","Serie A","Serie A","Серия A","意甲"],
    ["Serie B","Serie B","Serie B","Serie B","Серия B","意乙"],
    ["Superliga","Superliga","Superliga","Superliga","Суперлига","超级联赛"],
    ["Premier League","Premier League","Premier League","Premier League","Премьер-лига","英超"],
    ["FA Cup","FA Cup","FA Cup","FA Cup","Кубок Англии","足总杯"],
    ["Championship","Championship","Championship","Championship","Чемпионшип","英冠"],
    ["Veikkausliiga","Veikkausliiga","Veikkausliiga","Veikkausliiga","Вейккауслига","芬兰超级联赛"],
    ["Eredivisie","Eredivisie","Eredivisie","Eredivisie","Эредивизи","荷甲"],
    ["Primeira Liga","Primeira Liga","Primeira Liga","Primeira Liga","Примейра-лига","葡超"],
    ["Pro League","Pro League","Pro League","Pro League","Про-лига","职业联赛"],
    ["K League 1","K League 1","K League 1","K League 1","Кей-лига 1","K 联赛 1"],
    ["La Liga","La Liga","La Liga","La Liga","Ла Лига","西甲"],
    ["Süper Lig","Süper Lig","Süper Lig","Süper Lig","Суперлига Турции","土超"],
    ["CONCACAF Caribbean Club Championship","CONCACAF Caribbean Club Championship","Campeonato de Clubes del Caribe CONCACAF","Campeonato de Clubes do Caribe da CONCACAF","Клубный чемпионат Карибского бассейна КОНКАКАФ","中北美及加勒比海俱乐部锦标赛"],
    ["UEFA Champions League","UEFA Champions League","Liga de Campeones de la UEFA","Liga dos Campeões da UEFA","Лига чемпионов УЕФА","欧洲冠军联赛"],
    ["Règle actuelle Standard et Premium : football de championnat entre la 15e et la 45e minute, majorité minimale 3/5, confiance ≥77/100 et cote ANJ réelle entre 1,30 et 2,10. Les autres critères de qualité restent applicables.","Current Standard and Premium rule: league football between minutes 15 and 45, at least 3/5 agreement, confidence ≥77/100 and verified ANJ odds from 1.30 to 2.10. Other quality criteria still apply.","Regla actual Standard y Premium: fútbol de liga entre los minutos 15 y 45, mayoría mínima de 3/5, confianza ≥77/100 y cuota ANJ real entre 1,30 y 2,10. Se mantienen los demás criterios de calidad.","Regra atual Standard e Premium: futebol de liga entre os minutos 15 e 45, maioria mínima de 3/5, confiança ≥77/100 e odd ANJ real entre 1,30 e 2,10. Mantêm-se os restantes critérios de qualidade.","Текущее правило Standard и Premium: матчи чемпионатов с 15-й по 45-ю минуту, минимум 3/5 совпадающих голосов, уверенность ≥77/100 и реальный коэффициент ANJ от 1,30 до 2,10. Остальные критерии качества сохраняются.","当前 Standard 和 Premium 规则：联赛第 15 至 45 分钟，至少 3/5 多数，置信度 ≥77/100，真实 ANJ 赔率在 1.30 至 2.10 之间。其他质量标准仍然适用。"],
    ["BON","GOOD","BUENO","BOM","ХОРОШО","良好"],
    ["FIABLE","RELIABLE","FIABLE","FIÁVEL","НАДЁЖНО","可靠"],
    ["TELEGRAM VÉRIFIÉ","TELEGRAM VERIFIED","TELEGRAM VERIFICADO","TELEGRAM VERIFICADO","TELEGRAM ПОДТВЕРЖДЁН","TELEGRAM 已验证"],
    ["ANCIEN SYSTÈME","FORMER SYSTEM","SISTEMA ANTERIOR","SISTEMA ANTERIOR","СТАРАЯ СИСТЕМА","旧系统"],
    ["LIVRAISON NON PROUVÉE","DELIVERY UNPROVEN","ENVÍO NO PROBADO","ENVIO NÃO COMPROVADO","ОТПРАВКА НЕ ПОДТВЕРЖДЕНА","发送未证实"],
    ["Match non analysé","Match not analysed","Partido no analizado","Jogo não analisado","Матч не проанализирован","比赛未分析"],
    ["Historique vérifiable","Verifiable history","Historial verificable","Histórico verificável","Проверяемая история","可验证的历史"],
    ["Telegram vérifié","Telegram verified","Telegram verificado","Telegram verificado","Telegram подтверждён","Telegram 已验证"],
    ["Ancien système","Former system","Sistema anterior","Sistema anterior","Старая система","旧系统"],
    ["Livraison non prouvée","Delivery unproven","Entrega no probada","Envio não comprovado","Отправка не подтверждена","发送未证实"],
    ["Déjà abonné ?","Already subscribed?","¿Ya estás suscrito?","Já é assinante?","Уже есть подписка?","已经订阅？"],
    ["Me connecter","Log in","Iniciar sesión","Entrar","Войти","登录"],
    ["Email de ton abonnement","Your subscription email","Email de tu suscripción","Email da sua assinatura","Эл. почта подписки","订阅邮箱"],
    ["Code d’accès","Access code","Código de acceso","Código de acesso","Код доступа","访问码"],
    ["Ton email","Your email","Tu email","O seu email","Ваша эл. почта","您的邮箱"],
    ["Origine non autorisée.","Unauthorised origin.","Origen no autorizado.","Origem não autorizada.","Недопустимый источник.","来源未获授权。"],
    ["Connectez-vous avant d'activer les notifications.","Log in before enabling notifications.","Inicia sesión antes de activar las notificaciones.","Entre antes de ativar as notificações.","Войдите перед включением уведомлений.","启用通知前请先登录。"],
    ["Permission de notification refusée.","Notification permission denied.","Permiso de notificación denegado.","Permissão de notificações recusada.","Разрешение на уведомления отклонено.","通知权限被拒绝。"],
    ["Impossible d'obtenir le jeton Firebase.","Unable to obtain the Firebase token.","No se pudo obtener el token de Firebase.","Não foi possível obter o token Firebase.","Не удалось получить токен Firebase.","无法获取 Firebase 令牌。"],
    ["Notifications activées, même application fermée.","Notifications enabled, even when the app is closed.","Notificaciones activadas, incluso con la aplicación cerrada.","Notificações ativadas, mesmo com a aplicação fechada.","Уведомления включены, даже когда приложение закрыто.","通知已启用，应用关闭时也会接收。"],
    ["Session ou abonnement non valide.","Invalid session or subscription.","Sesión o suscripción no válida.","Sessão ou assinatura inválida.","Недействительный сеанс или подписка.","会话或订阅无效。"],
    ["Connexion Firebase impossible.","Unable to connect to Firebase.","No se pudo conectar con Firebase.","Não foi possível ligar ao Firebase.","Не удалось подключиться к Firebase.","无法连接 Firebase。"],
    ["Aucun résultat diffusé enregistré","No delivered result recorded","No hay resultados enviados registrados","Nenhum resultado enviado registado","Нет зарегистрированных отправленных результатов","没有已记录的发送结果"],
    ["/mois","/month","/mes","/mês","/месяц","/月"],
    ["LES JEUX D'ARGENT ET DE HASARD PEUVENT ÊTRE DANGEREUX : pertes d'argent, conflits familiaux, addiction. Conseils sur joueurs-info-service.fr — +33 9 74 75 13 13, без повышенной тарификации.","GAMBLING CAN BE DANGEROUS: financial loss, family conflict and addiction. Help: joueurs-info-service.fr · +33 9 74 75 13 13, standard call rates.","LOS JUEGOS DE AZAR PUEDEN SER PELIGROSOS: pérdidas económicas, conflictos familiares y adicción. Ayuda: joueurs-info-service.fr · +33 9 74 75 13 13, llamada sin recargo.","OS JOGOS DE AZAR PODEM SER PERIGOSOS: perdas financeiras, conflitos familiares e dependência. Ajuda: joueurs-info-service.fr · +33 9 74 75 13 13, chamada sem custo adicional.","АЗАРТНЫЕ ИГРЫ МОГУТ БЫТЬ ОПАСНЫ: финансовые потери, семейные конфликты и зависимость. Помощь: joueurs-info-service.fr · +33 9 74 75 13 13, без повышенной тарификации.","博彩可能造成危害：经济损失、家庭矛盾和成瘾。帮助：joueurs-info-service.fr · +33 9 74 75 13 13，按普通通话收费。"],
    ["LES JEUX D'ARGENT ET DE HASARD PEUVENT ÊTRE DANGEREUX : pertes d'argent, conflits familiaux, addiction. Conseils sur","GAMBLING CAN BE DANGEROUS: financial loss, family conflict and addiction. Help:","LOS JUEGOS DE AZAR PUEDEN SER PELIGROSOS: pérdidas económicas, conflictos familiares y adicción. Ayuda:","OS JOGOS DE AZAR PODEM SER PERIGOSOS: perdas financeiras, conflitos familiares e dependência. Ajuda:","АЗАРТНЫЕ ИГРЫ МОГУТ БЫТЬ ОПАСНЫ: финансовые потери, семейные конфликты и зависимость. Помощь:","博彩可能造成危害：经济损失、家庭矛盾和成瘾。帮助："]
  ];

  var maps={fr:{},en:{},es:{},pt:{},ru:{},zh:{}};
  rows.forEach(function(row){for(var i=0;i<LANGS.length;i++)maps[LANGS[i]][row[0]]=row[i];});
  var originals=new WeakMap(), attributeOriginals=new WeakMap(), selfChanged=new WeakSet(), selfAttrs=new WeakMap(), changing=false, originalTitle=document.title;
  function language(){
    if(window.i18n&&typeof window.i18n.current==="function"){
      var current=window.i18n.current();if(LANGS.indexOf(current)>=0)return current;
    }
    try{var x=localStorage.getItem("tlm_lang");return LANGS.indexOf(x)>=0?x:"fr";}catch(e){return "fr";}
  }
  function translateDynamic(text,lang){
    if(lang==="fr")return text;
    var exact=maps[lang][text]; if(exact!==undefined)return exact;
    var compact=String(text||"").replace(/\s+/g," ").trim();
    if(compact!==text){
      var compactExact=maps[lang][compact];
      if(compactExact!==undefined)return compactExact;
      text=compact;
    }
    var prefixed=text.match(/^(\s*[^\p{L}\p{N}]*)([\p{L}\p{N}].*)$/u);
    if(prefixed&&prefixed[1]){
      var translatedCore=maps[lang][prefixed[2]];
      if(translatedCore!==undefined)return prefixed[1]+translatedCore;
    }
    var months={
      en:{janvier:"January",février:"February",mars:"March",avril:"April",mai:"May",juin:"June",juillet:"July",août:"August",septembre:"September",octobre:"October",novembre:"November",décembre:"December"},
      es:{janvier:"enero",février:"febrero",mars:"marzo",avril:"abril",mai:"mayo",juin:"junio",juillet:"julio",août:"agosto",septembre:"septiembre",octobre:"octubre",novembre:"noviembre",décembre:"diciembre"},
      pt:{janvier:"janeiro",février:"fevereiro",mars:"março",avril:"abril",mai:"maio",juin:"junho",juillet:"julho",août:"agosto",septembre:"setembro",octobre:"outubro",novembre:"novembro",décembre:"dezembro"},
      ru:{janvier:"января",février:"февраля",mars:"марта",avril:"апреля",mai:"мая",juin:"июня",juillet:"июля",août:"августа",septembre:"сентября",octobre:"октября",novembre:"ноября",décembre:"декабря"},
      zh:{janvier:"1 月",février:"2 月",mars:"3 月",avril:"4 月",mai:"5 月",juin:"6 月",juillet:"7 月",août:"8 月",septembre:"9 月",octobre:"10 月",novembre:"11 月",décembre:"12 月"}
    };
    var date=text.match(/^(\d{1,2}) (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) (\d{4})$/i);
    if(date){var month=months[lang][date[2].toLowerCase()];return lang==="en"?month+" "+date[1]+", "+date[3]:lang==="zh"?date[3]+" 年 "+month+" "+date[1]+" 日":date[1]+" "+month+" "+date[3];}
    var weekdays={
      en:{lundi:"Monday",mardi:"Tuesday",mercredi:"Wednesday",jeudi:"Thursday",vendredi:"Friday",samedi:"Saturday",dimanche:"Sunday"},
      es:{lundi:"lunes",mardi:"martes",mercredi:"miércoles",jeudi:"jueves",vendredi:"viernes",samedi:"sábado",dimanche:"domingo"},
      pt:{lundi:"segunda-feira",mardi:"terça-feira",mercredi:"quarta-feira",jeudi:"quinta-feira",vendredi:"sexta-feira",samedi:"sábado",dimanche:"domingo"},
      ru:{lundi:"понедельник",mardi:"вторник",mercredi:"среда",jeudi:"четверг",vendredi:"пятница",samedi:"суббота",dimanche:"воскресенье"},
      zh:{lundi:"星期一",mardi:"星期二",mercredi:"星期三",jeudi:"星期四",vendredi:"星期五",samedi:"星期六",dimanche:"星期日"}
    };
    var shortDays={
      en:{"lun.":"Mon.","mar.":"Tue.","mer.":"Wed.","jeu.":"Thu.","ven.":"Fri.","sam.":"Sat.","dim.":"Sun."},
      es:{"lun.":"lun.","mar.":"mar.","mer.":"mié.","jeu.":"jue.","ven.":"vie.","sam.":"sáb.","dim.":"dom."},
      pt:{"lun.":"seg.","mar.":"ter.","mer.":"qua.","jeu.":"qui.","ven.":"sex.","sam.":"sáb.","dim.":"dom."},
      ru:{"lun.":"пн.","mar.":"вт.","mer.":"ср.","jeu.":"чт.","ven.":"пт.","sam.":"сб.","dim.":"вс."},
      zh:{"lun.":"周一", "mar.":"周二", "mer.":"周三", "jeu.":"周四", "ven.":"周五", "sam.":"周六", "dim.":"周日"}
    };
    var dayDate=text.match(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)$/i);
    if(dayDate){var dayName=weekdays[lang][dayDate[1].toLowerCase()],monthName=months[lang][dayDate[3].toLowerCase()];return lang==="en"?dayName+" "+monthName+" "+dayDate[2]:lang==="zh"?monthName+dayDate[2]+" 日 "+dayName:dayName+" "+dayDate[2]+" "+monthName;}
    var dayMonth=text.match(/^(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)$/i);
    if(dayMonth){var translatedMonth=months[lang][dayMonth[2].toLowerCase()];return lang==="en"?translatedMonth+" "+dayMonth[1]:lang==="zh"?translatedMonth+dayMonth[1]+" 日":dayMonth[1]+" "+translatedMonth;}
    var countMatches=text.match(/^(\d+)\s+matchs?$/i);
    if(countMatches)return lang==="en"?countMatches[1]+(countMatches[1]==="1"?" match":" matches"):lang==="es"?countMatches[1]+(countMatches[1]==="1"?" partido":" partidos"):lang==="pt"?countMatches[1]+(countMatches[1]==="1"?" jogo":" jogos"):lang==="ru"?countMatches[1]+(countMatches[1]==="1"?" матч":" матчей"):countMatches[1]+" 场比赛";
    var wonDay=text.match(/^(\d+)\/(\d+)\s+gagnés\s+·\s+([+-]\d+)€$/i);
    if(wonDay)return lang==="en"?wonDay[1]+"/"+wonDay[2]+" won · "+wonDay[3]+"€":lang==="es"?wonDay[1]+"/"+wonDay[2]+" acertados · "+wonDay[3]+"€":lang==="pt"?wonDay[1]+"/"+wonDay[2]+" certos · "+wonDay[3]+"€":lang==="ru"?wonDay[1]+"/"+wonDay[2]+" выиграно · "+wonDay[3]+"€":wonDay[1]+"/"+wonDay[2]+" 命中 · "+wonDay[3]+"€";
    var analysesDay=text.match(/^(\d+)\s+analyses\s+·\s+(\d+)\s+résolues$/i);
    if(analysesDay)return lang==="en"?analysesDay[1]+" analyses · "+analysesDay[2]+" resolved":lang==="es"?analysesDay[1]+" análisis · "+analysesDay[2]+" resueltos":lang==="pt"?analysesDay[1]+" análises · "+analysesDay[2]+" resolvidas":lang==="ru"?analysesDay[1]+" анализов · "+analysesDay[2]+" завершено":analysesDay[1]+" 次分析 · "+analysesDay[2]+" 次已结算";
    var netGain=text.match(/^gain net\s*:\s*([+-]\d+[,.]\d+)\s*€$/i);
    if(netGain)return lang==="en"?"net result: "+netGain[1]+" €":lang==="es"?"resultado neto: "+netGain[1]+" €":lang==="pt"?"resultado líquido: "+netGain[1]+" €":lang==="ru"?"чистый результат: "+netGain[1]+" €":"净结果："+netGain[1]+" €";
    var perfSummary=text.match(/^Sur (\d+) résultats résolus — (\d+) gagnées, (\d+) perdues\. Bénéfice simulé à 10 € la mise : ([+-]?\d+)€ \(ROI ([+-]?\d+(?:[.,]\d+)?) %\)\.$/i);
    if(perfSummary)return lang==="en"?"Across "+perfSummary[1]+" resolved results — "+perfSummary[2]+" won, "+perfSummary[3]+" lost. Simulated result at €10 per selection: "+perfSummary[4]+"€ (ROI "+perfSummary[5]+"%).":lang==="es"?"Sobre "+perfSummary[1]+" resultados resueltos — "+perfSummary[2]+" acertados y "+perfSummary[3]+" fallados. Resultado simulado con 10 € por selección: "+perfSummary[4]+"€ (ROI "+perfSummary[5]+"%).":lang==="pt"?"Em "+perfSummary[1]+" resultados resolvidos — "+perfSummary[2]+" certos e "+perfSummary[3]+" errados. Resultado simulado com 10 € por seleção: "+perfSummary[4]+"€ (ROI "+perfSummary[5]+"%).":lang==="ru"?"Из "+perfSummary[1]+" завершённых результатов: "+perfSummary[2]+" выиграно, "+perfSummary[3]+" проиграно. Симуляция при 10 € на выбор: "+perfSummary[4]+"€ (ROI "+perfSummary[5]+"%).":"在 "+perfSummary[1]+" 个已结算结果中："+perfSummary[2]+" 个命中，"+perfSummary[3]+" 个未命中。每次 10 欧元的模拟结果："+perfSummary[4]+"€（ROI "+perfSummary[5]+"%）。";
    var qualityLine=text.match(/^(\d+)\/100\s+·\s+(BON|FIABLE)(.*)$/i);
    if(qualityLine){var q=maps[lang][qualityLine[2].toUpperCase()]||qualityLine[2],tail=qualityLine[3].replace(/TELEGRAM VÉRIFIÉ/gi,maps[lang]["TELEGRAM VÉRIFIÉ"]).replace(/ANCIEN SYSTÈME/gi,maps[lang]["ANCIEN SYSTÈME"]).replace(/LIVRAISON NON PROUVÉE/gi,maps[lang]["LIVRAISON NON PROUVÉE"]);return qualityLine[1]+"/100 · "+q+tail;}
    var m=text.match(/^IA (\d+)$/); if(m)return lang==="en"?"AI "+m[1]:lang==="ru"?"ИИ "+m[1]:lang==="zh"?"AI "+m[1]:text;
    m=text.match(/^(\d+)\s*\/\s*5 IA$/); if(m)return lang==="en"?m[1]+"/5 AIs":lang==="es"?m[1]+"/5 IA":lang==="pt"?m[1]+"/5 IA":lang==="ru"?m[1]+"/5 ИИ":m[1]+"/5 AI";
    m=text.match(/^(\d+) Over · (\d+) Under$/); if(m)return lang==="en"?m[1]+" Over · "+m[2]+" Under":lang==="es"?m[1]+" Más · "+m[2]+" Menos":lang==="pt"?m[1]+" Mais · "+m[2]+" Menos":lang==="ru"?m[1]+" Больше · "+m[2]+" Меньше":m[1]+" 大 · "+m[2]+" 小";
    m=text.match(/^(Over|Under) 2[,.]5 · (\d+)%$/i);
    if(m){var direction=m[1].toLowerCase()==="over"?(lang==="es"?"Más":lang==="pt"?"Mais":lang==="ru"?"Больше":lang==="zh"?"大":"Over"):(lang==="es"||lang==="pt"?"Menos":lang==="ru"?"Меньше":lang==="zh"?"小":"Under");return direction+" 2.5 · "+m[2]+"%";}
    m=text.match(/^(\d+)\/5 signal valide O\/U 2[,.]5\s*:\s*(\d+) des 5 sieges votent (Over|Under) 2[,.]5 buts\.?$/i);
    if(m){var dir=m[3].toLowerCase()==="over"?(lang==="es"?"Más":lang==="pt"?"Mais":lang==="ru"?"больше":lang==="zh"?"大球":"Over"):(lang==="es"||lang==="pt"?"Menos":lang==="ru"?"меньше":lang==="zh"?"小球":"Under");return lang==="en"?m[1]+"/5 valid O/U 2.5 signal: "+m[2]+" of 5 seats vote "+dir+" 2.5.":lang==="es"?"Señal O/U 2,5 validada "+m[1]+"/5: "+m[2]+" de 5 puestos votan "+dir+" 2,5.":lang==="pt"?"Sinal O/U 2,5 validado "+m[1]+"/5: "+m[2]+" de 5 lugares votam "+dir+" 2,5.":lang==="ru"?"Сигнал тотала 2,5 подтверждён "+m[1]+"/5: "+m[2]+" из 5 голосуют за "+dir+" 2,5.":"大/小 2.5 球信号以 "+m[1]+"/5 验证：五个席位中有 "+m[2]+" 个选择"+dir+"。";}
    m=text.match(/^Direction \? · (\d+)\/5 d’accord · forfait actif requis$/);
    if(m)return lang==="en"?"Direction ? · "+m[1]+"/5 agree · active plan required":lang==="es"?"Dirección ? · "+m[1]+"/5 de acuerdo · se requiere un plan activo":lang==="pt"?"Direção ? · "+m[1]+"/5 de acordo · plano ativo necessário":lang==="ru"?"Направление ? · согласны "+m[1]+"/5 · нужен активный тариф":"方向 ? · "+m[1]+"/5 达成一致 · 需要有效套餐";
    m=text.match(/^([<>≥]?\d+(?:[-–]\d+)?\/100)\s+(.+)$/);
    if(m)return m[1]+" "+(maps[lang][m[2]]!==undefined?maps[lang][m[2]]:m[2]);
    if(text.indexOf(" · ")>=0){
      var changed=false;
      var pieces=text.split(" · ").map(function(piece){
        if(maps[lang][piece]!==undefined){changed=true;return maps[lang][piece];}
        var scheduled=piece.match(/^(lun\.|mar\.|mer\.|jeu\.|ven\.|sam\.|dim\.)\s+(\d{2}\/\d{2})$/i);
        if(scheduled){changed=true;return shortDays[lang][scheduled[1].toLowerCase()]+" "+scheduled[2];}
        return piece;
      });
      if(changed)return pieces.join(" · ");
    }
    return text;
  }
  function translateTextNode(node,lang){
    if(!node||node.nodeType!==3||!node.parentElement)return;
    if(/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE|PRE)$/.test(node.parentElement.tagName))return;
    if(node.parentElement.closest&&node.parentElement.closest(".brand"))return;
    if(node.parentElement.closest&&node.parentElement.closest("[data-i18n],[data-i18n-html]"))return;
    var raw=originals.has(node)?originals.get(node):node.nodeValue;
    if(!originals.has(node))originals.set(node,raw);
    var lead=(raw.match(/^\s*/)||[""])[0],tail=(raw.match(/\s*$/)||[""])[0],core=raw.trim();
    if(!core)return;
    var next=translateDynamic(core,lang);
    var value=lead+next+tail;
    if(node.nodeValue!==value){selfChanged.add(node);node.nodeValue=value;}
  }
  function translateAttrs(el,lang){
    if(!el||el.nodeType!==1)return;
    ["placeholder","title","aria-label"].forEach(function(attr){
      if(!el.hasAttribute(attr))return;
      var saved=attributeOriginals.get(el)||{}; if(saved[attr]===undefined)saved[attr]=el.getAttribute(attr); attributeOriginals.set(el,saved);
      var value=translateDynamic(saved[attr],lang);
      if(el.getAttribute(attr)!==value){var own=selfAttrs.get(el)||new Set();own.add(attr);selfAttrs.set(el,own);el.setAttribute(attr,value);}
    });
  }
  function walk(root,lang){
    if(!root)return;
    if(root.nodeType===3){translateTextNode(root,lang);return;}
    translateAttrs(root,lang);
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);var node;
    while((node=walker.nextNode()))translateTextNode(node,lang);
    if(root.querySelectorAll)root.querySelectorAll("[placeholder],[title],[aria-label]").forEach(function(el){translateAttrs(el,lang);});
  }
  function addSelector(lang){
    var labels=LANGUAGE_LABELS[lang]||NAMES;
    var existing=document.getElementById("tlm-language-universal"); if(existing){Array.from(existing.options).forEach(function(o){o.textContent=labels[o.value]||NAMES[o.value]||o.value;});existing.value=lang;return;}
    if(document.getElementById("lang-current"))return;
    var select=document.createElement("select");select.id="tlm-language-universal";select.setAttribute("aria-label",maps[lang]["Langue"]||"Language");
    LANGS.forEach(function(code){var o=document.createElement("option");o.value=code;o.textContent=labels[code]||NAMES[code];select.appendChild(o);});
    select.value=lang;select.addEventListener("change",function(){if(window.i18n&&i18n.setLang)i18n.setLang(select.value);else{try{localStorage.setItem("tlm_lang",select.value);}catch(e){}location.reload();}});
    var style=document.createElement("style");style.textContent="#tlm-language-universal{margin-left:auto;max-width:132px;padding:8px 10px;border:1px solid rgba(120,130,210,.35);border-radius:10px;background:#0b1030;color:#eef2ff;font:600 13px system-ui;cursor:pointer} @media(max-width:720px){#tlm-language-universal{max-width:104px;padding:7px 6px}}";
    document.head.appendChild(style);
    var host=document.querySelector("header nav, nav.navlinks, .nav-links, header, .app-header")||document.body;host.appendChild(select);
  }
  function applyAll(){
    if(changing)return;changing=true;
    var lang=language();document.documentElement.lang=lang==="pt"?"pt-BR":lang==="zh"?"zh-CN":lang;
    walk(document.body,lang);addSelector(lang);
    document.title=translateDynamic(originalTitle,lang);
    changing=false;
  }
  function init(){
    applyAll();
    new MutationObserver(function(changes){if(changing)return;var lang=language();changing=true;changes.forEach(function(c){
      c.addedNodes.forEach(function(n){walk(n,lang);});
      if(c.type==="characterData"){
        if(selfChanged.has(c.target)){selfChanged.delete(c.target);return;}
        originals.set(c.target,c.target.nodeValue);translateTextNode(c.target,lang);
      }
      if(c.type==="attributes"){
        var own=selfAttrs.get(c.target);if(own&&own.has(c.attributeName)){own.delete(c.attributeName);return;}
        var saved=attributeOriginals.get(c.target)||{};saved[c.attributeName]=c.target.getAttribute(c.attributeName);attributeOriginals.set(c.target,saved);translateAttrs(c.target,lang);
      }
    });changing=false;}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["placeholder","title","aria-label"]});
  }
  document.addEventListener("tlm-language-change",applyAll);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
  window.TLMI18nAuto={translate:translateDynamic,apply:applyAll,languages:LANGS.slice()};
})();
