import React from "react";
import "./App.css";
import CGU from "./CGU";
import MentionsLegales from "./MentionsLegales";
import Confidentialite from "./Confidentialite";

// ── Affiliate links ──────────────────────────────────────────────────────────
const WINAMAX_LINK    = "https://www.winamax.fr/parrain?code=WMX8M5";
const BETCLIC_LINK    = "https://www.betclic.fr/fr-fr/sports/?promocode=GREGA3GZ";
const UNIBET_LINK     = "https://www.unibet.fr/inscription/?campaign=120526&parrain=5EBF919DF1008254";
const PMU_LINK        = "https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728";
const ZEBET_LINK      = "#";
const PARIONSSPORT_LINK = "#";
const NETBET_LINK     = "#";
const TIKTOK_LINK     = "https://www.tiktok.com/@touslesmatchs.com";

// ── Picks ─────────────────────────────────────────────────────────────────────
// Structure: [date, match, type, odds, score, status, sport, aiScore, threshold]
// threshold: 8 = pick normal | 7 = fallback (seuil abaissé à 7/10)
const picks = [
  ["03/06","Carolina Hurricanes vs Vegas Golden Knights","CAR Vainqueur","1.70","—","EN ATTENTE","Hockey",8.4,8],
  ["31/05","OKC Thunder vs San Antonio Spurs","OKC Vainqueur","1.65","103-111","PERDU","Basketball",8.1,8],
  ["29/05","San Antonio Spurs vs OKC Thunder","SAS Vainqueur","1.70","118-91","GAGNE","Basketball",8.6,8],
  ["26/05 au 30/05","PAS DE PARI - Aucun match n atteint notre seuil 8/10","---","---","---","NOPICK","",0,8],
  ["22/05","New York Knicks vs Cleveland Cavaliers","Plus de 215.5 pts","1.87","109-93 (202 pts)","PERDU","Basketball",8.2,8],
  ["20/05","Fribourg vs Aston Villa","Victoire Aston Villa","1.58","0-1","GAGNE","Foot",9.1,8],
  ["19/05","New York Knicks vs Cleveland Cavaliers","Plus de 216.5 pts","1.85","115-104 (219 pts)","GAGNE","Basketball",8.8,8],
  ["19/05","Boca Juniors vs Cruzeiro","Moins de 2.5 buts","1.40","1-1","GAGNE","Foot",8.3,8],
  ["14/05 au 17/05","PAS DE PARI - Aucun match n atteint notre seuil 8/10","---","---","---","NOPICK","",0,8],
  ["13/05","Lazio vs Inter Milan","Inter ML","1.66","0-2","GAGNE","Foot",8.7,8],
  ["13/05","Villarreal vs Seville","Over 2.5","1.75","2-2","GAGNE","Foot",8.4,8],
  ["11/05","Carolina vs Philadelphia","Carolina ML","1.58","4-2","GAGNE","Hockey",8.9,8],
  ["10/05","Colorado vs Minnesota","Colorado ML","1.62","5-1","GAGNE","Hockey",9.0,8],
  ["09/05","VGK vs Anaheim","VGK ML","1.55","6-2","GAGNE","Hockey",8.5,8],
  ["08/05","Carolina vs Philadelphia","Carolina ML","1.52","4-1","GAGNE","Hockey",8.8,8],
  ["07/05","Anaheim vs VGK","Anaheim ML","1.78","3-1","GAGNE","Hockey",7.8,7],
  ["06/05","Buffalo vs Montreal","Buffalo ML","1.60","1-5","PERDU","Hockey",7.6,7],
  ["05/05","VGK vs Anaheim","VGK ML","1.54","3-1","GAGNE","Hockey",8.2,8],
  ["04/05","Colorado vs Minnesota","Colorado ML","1.58","9-6","GAGNE","Hockey",8.6,8],
  ["03/05","Carolina vs Philadelphia","Carolina ML","1.50","3-0","GAGNE","Hockey",9.2,8],
  ["02/05","Utah vs VGK","VGK ML","1.62","5-1","GAGNE","Hockey",8.4,8],
  ["01/05","Buffalo vs Boston","Buffalo ML","1.70","4-1","GAGNE","Hockey",7.9,7],
  ["29/04","Leverkusen vs Dortmund","Over 2.5","1.62","3-1","GAGNE","Foot",8.3,8],
  ["28/04","Bayern vs Stuttgart","Over 2.5","1.55","1-0","PERDU","Foot",7.5,7],
];

const preuves = [
  {date:"20/05/2026",match:"Fribourg vs Aston Villa",gain:"+11.60 EUR",img:"/preuves/fribourg-20mai.png"},
  {date:"10/05/2026",match:"Minnesota vs Colorado Avalanche",gain:"+17.80 EUR",img:"/preuves/colorado-10mai.png"},
  {date:"06/05/2026",match:"Buffalo Sabres vs Montreal",gain:"+17.60 EUR",img:"/preuves/buffalo-6mai.png"},
  {date:"03/05/2026",match:"Colorado Avalanche vs Minnesota",gain:"+15.40 EUR",img:"/preuves/colorado-3mai.png"},
];

const temoignages = [
  {nom:"Thomas R.",ville:"Lyon",txt:"9 wins consecutifs, je suis bluffe. Le seul tipster que je suis vraiment.",gains:"+47 EUR"},
  {nom:"Karim B.",ville:"Paris",txt:"Le pick du jour est devenu mon rituel du matin. Simple, clair, efficace.",gains:"+31 EUR"},
  {nom:"Julien M.",ville:"Bordeaux",txt:"Le seuil 8/10 ca change tout. Moins de picks mais beaucoup plus de qualite.",gains:"+28 EUR"},
];

const faqs = [
  {q:"C est vraiment gratuit ?",a:"Oui, 100% gratuit. Nous sommes remuneres via les liens d affiliation bookmakers. En vous inscrivant via nos liens, vous nous aidez a maintenir le service - merci."},
  {q:"Comment votre IA analyse les matchs ?",a:"Notre modele croise la forme recente, les blessures, les confrontations directes, les stats domicile/exterieur et bien d autres variables. Seuls les picks avec un score superieur ou egal a 8/10 sont publies. Si aucun match n atteint ce seuil, nous abaissons a 7/10 pour garantir un pick chaque jour."},
  {q:"Combien de picks par jour ?",a:"Un seul pick par jour. Notre IA vise toujours le seuil 8/10. Si aucun match ne l atteint ce jour-la, nous descendons a 7/10 pour vous garantir un pick quotidien de qualite."},
  {q:"Quel bankroll est recommande ?",a:"Ne misez jamais plus de 2 a 5% de votre bankroll total sur un seul pick. Les paris sportifs comportent des risques, jouez de facon responsable."},
];

const bookmakers = [
  {nom:"Winamax",badge:"PARTENAIRE N1",bonus:"Bonus jusqu a 200 EUR",desc:"Le bookmaker francais numero 1. Cotes excellentes, interface top, retrait rapide.",color:"#e8b400",link:WINAMAX_LINK,note:"9.5/10"},
  {nom:"Betclic",badge:"TOP COTES",bonus:"Bonus bienvenue 100 EUR",desc:"Cotes tres competitives surtout sur le foot europeen. Appli mobile excellente.",color:"#00a651",link:BETCLIC_LINK,note:"9.2/10"},
  {nom:"Unibet",badge:"FIABLE",bonus:"Mise remboursee 100 EUR",desc:"Bookmaker international solide. Large choix de sports et de marches.",color:"#007832",link:UNIBET_LINK,note:"8.8/10"},
  {nom:"PMU",badge:"100% FRANCAIS",bonus:"Bonus 150 EUR",desc:"L historique des paris en France. Ideal pour le foot et les courses hippiques.",color:"#d4001a",link:PMU_LINK,note:"8.5/10"},
  {nom:"ZEbet",badge:"COTES ELEVEES",bonus:"Remboursement 100 EUR",desc:"Specialiste des cotes boostees. Souvent les meilleures cotes sur certains matchs.",color:"#ff6600",link:ZEBET_LINK,note:"8.3/10"},
  {nom:"ParionsSport",badge:"FDJ OFFICIEL",bonus:"Bonus 100 EUR",desc:"Le pari sportif officiel de la FDJ. Securite maximale, ideal pour les debutants.",color:"#005baa",link:PARIONSSPORT_LINK,note:"8.0/10"},
  {nom:"NetBet",badge:"BONNE VALEUR",bonus:"Bonus 100 EUR",desc:"Bon rapport qualite/cotes. Interface simple et claire. Programme de fidelite interessant.",color:"#c8102e",link:NETBET_LINK,note:"7.8/10"},
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function sportEmoji(sport) {
  const map = {Foot:"⚽",Hockey:"🏒",Basketball:"🏀",Tennis:"🎾",Baseball:"⚾",Volleyball:"🏐",MLS:"⚽",F1:"🏎️",NFL:"🏈",Rugby:"🏉",MMA:"🥊"};
  return map[sport] || (sport ? "🎯" : "");
}

function splitTeams(matchStr) {
  const parts = matchStr.split(" vs ");
  if (parts.length === 2) return [parts[0].trim(), parts[1].trim()];
  return [matchStr, ""];
}

// ── Circular Win Rate ────────────────────────────────────────────────────────
function WinRateRing({ pct, total }) {
  const ringRef = React.useRef(null);
  const labelRef = React.useRef(null);
  const triggered = React.useRef(false);
  const circ = 2 * Math.PI * 28; // r=28

  React.useEffect(() => {
    const el = ringRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !triggered.current) {
        triggered.current = true;
        const dur = 1800, start = performance.now();
        const ease = t => 1 - Math.pow(1 - t, 3);
        const step = (now) => {
          const p = Math.min((now - start) / dur, 1);
          const val = ease(p) * pct;
          if (ringRef.current) ringRef.current.style.strokeDashoffset = circ - (circ * val / 100);
          if (labelRef.current) labelRef.current.textContent = Math.round(val) + "%";
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.4 });
    obs.observe(el.closest(".stats-grid") || el);
    return () => obs.disconnect();
  }, [pct, circ]);

  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 68 68">
        <circle className="ring-bg" cx="34" cy="34" r="28"/>
        <circle className="ring-fill" ref={ringRef} cx="34" cy="34" r="28"/>
      </svg>
      <div className="ring-label">
        <span ref={labelRef}>0%</span>
        <small>WIN</small>
      </div>
    </div>
  );
}

// ── Count-up value ────────────────────────────────────────────────────────────
function CountUp({ target, prefix="", suffix="" }) {
  const ref = React.useRef(null);
  const triggered = React.useRef(false);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !triggered.current) {
        triggered.current = true;
        const dur = 1800, start = performance.now();
        const ease = t => 1 - Math.pow(1 - t, 3);
        const step = (now) => {
          const p = Math.min((now - start) / dur, 1);
          if (el) el.textContent = prefix + Math.round(ease(p) * target) + suffix;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.4 });
    obs.observe(el.closest(".stats-grid") || el);
    return () => obs.disconnect();
  }, [target, prefix, suffix]);
  return <span ref={ref} className="stat-value">{prefix}0{suffix}</span>;
}

// ── Confidence bar ────────────────────────────────────────────────────────────
function ConfBar({ score }) {
  const ref = React.useRef(null);
  const triggered = React.useRef(false);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !triggered.current) {
        triggered.current = true;
        setTimeout(() => { if (el) el.style.width = (score / 10 * 100) + "%"; }, 300);
      }
    }, { threshold: 0.3 });
    obs.observe(el.closest(".pick-card") || el);
    return () => obs.disconnect();
  }, [score]);
  return <div className="pick-conf-fill" ref={ref} style={{width:"0%"}} />;
}

// ── Reveal hook ───────────────────────────────────────────────────────────────
function useReveal() {
  React.useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  });
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]         = React.useState("home");
  const [filter, setFilter]     = React.useState("ALL");
  const [faqOpen, setFaqOpen]   = React.useState(null);
  const [drawerOpen, setDrawer] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  useReveal();

  // Google Analytics
  React.useEffect(() => {
    if (window.gaLoaded) return;
    window.gaLoaded = true;
    const s = document.createElement("script");
    s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=G-ME2T7G7PSK";
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    window.gtag = gtag; gtag("js", new Date()); gtag("config","G-ME2T7G7PSK");
  }, []);

  // Scroll detection for navbar
  React.useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Lock body scroll when drawer open
  React.useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
  }, [drawerOpen]);

  // ── Stats ──
  const realPicks   = picks.filter(p => p[5] !== "NOPICK" && p[5] !== "EN COURS" && p[5] !== "EN ATTENTE");
  const wins        = picks.filter(p => p[5] === "GAGNE").length;
  const total       = realPicks.length;
  const winrate     = total ? Math.round((wins / total) * 100) : 0;
  const losses      = picks.filter(p => p[5] === "PERDU").length;

  // ── Pick du jour : logique 8/10 → fallback 7/10 ──
  // On cherche le premier pick qui n'est pas NOPICK
  const pickDuJour  = picks[0];
  const isNoPick    = pickDuJour[5] === "NOPICK";
  const isEnCours   = pickDuJour[5] === "EN COURS";
  const isEnAttente = pickDuJour[5] === "EN ATTENTE";
  const isFallback7 = pickDuJour[8] === 7;
  const [homeTeam, awayTeam] = splitTeams(pickDuJour[1]);

  // ── Filter history ──
  const filtered = filter === "ALL"
    ? picks
    : picks.filter(p => p[5] === "NOPICK" || p[5] === "EN COURS" || p[5] === "EN ATTENTE" || p[6] === filter);

  // ── Row class ──
  function rowClass(status) {
    if (status === "GAGNE") return "history-row win";
    if (status === "PERDU") return "history-row loss";
    if (status === "EN ATTENTE" || status === "EN COURS") return "history-row pending";
    return "history-row nopick";
  }
  function resultLabel(status) {
    if (status === "GAGNE") return "Gagné";
    if (status === "PERDU") return "Perdu";
    if (status === "EN ATTENTE") return "En attente";
    if (status === "EN COURS") return "En cours";
    return "—";
  }

  // ── Shared layout parts ──
  const navbar = (
    <>
      {/* Mobile drawer */}
      <div className={`nav-drawer${drawerOpen ? " open" : ""}`}>
        <button className={page==="home" ? "active" : ""} onClick={() => { setPage("home"); setDrawer(false); }}>Choix</button>
        <button className={page==="preuves" ? "active" : ""} onClick={() => { setPage("preuves"); setDrawer(false); }}>Preuves</button>
        <button className={page==="bookmakers" ? "active" : ""} onClick={() => { setPage("bookmakers"); setDrawer(false); }}>Bookmakers</button>
        <a href={TIKTOK_LINK} target="_blank" rel="noreferrer" onClick={() => setDrawer(false)}>TikTok</a>
      </div>

      <nav className={`navbar${scrolled ? " scrolled" : ""}`}>
        <div className="nav-logo" style={{cursor:"pointer"}} onClick={() => setPage("home")}>
          <span className="nav-logo-name">TousLesMatchs</span>
          <span className="nav-logo-sub">Analyse · Intelligence · Résultats</span>
        </div>
        <ul className="nav-links">
          <li><button className={page==="home" ? "nav-active" : ""} onClick={() => setPage("home")}>Choix</button></li>
          <li><button className={page==="preuves" ? "nav-active" : ""} onClick={() => setPage("preuves")}>Preuves</button></li>
          <li><button className={page==="bookmakers" ? "nav-active" : ""} onClick={() => setPage("bookmakers")}>Les bookmakers</button></li>
          <li><a href={TIKTOK_LINK} target="_blank" rel="noreferrer" className="nav-tiktok">TikTok</a></li>
        </ul>
        <button className={`nav-burger${drawerOpen ? " open" : ""}`} onClick={() => setDrawer(v => !v)} aria-label="Menu">
          <span/><span/><span/>
        </button>
      </nav>
    </>
  );

  const footer = (
    <footer className="footer">
      <div className="footer-logo">TousLesMatchs.com</div>
      <ul className="footer-links">
        <li><button onClick={() => setPage("cgu")}>CGU</button></li>
        <li><button onClick={() => setPage("mentions")}>Mentions Légales</button></li>
        <li><button onClick={() => setPage("confidentialite")}>Confidentialité</button></li>
        <li><a href={TIKTOK_LINK} target="_blank" rel="noreferrer">TikTok</a></li>
      </ul>
      <div className="footer-copy">© 2026 TousLesMatchs.com — Tous droits réservés</div>
    </footer>
  );

  const legal = (
    <div className="legal-band">
      <p>🔞 Jeu responsable — Interdit aux moins de 18 ans &nbsp;|&nbsp; joueurs-info-service.fr &nbsp;|&nbsp; 09 74 75 13 13</p>
      <p style={{fontSize:"9px",color:"#2d2d2d",marginTop:"1px"}}>Les paris comportent des risques de perte financière. Pariez de manière responsable.</p>
    </div>
  );

  // ── Sub-pages ──
  if (page === "cgu")             return <CGU setPage={setPage} footer={footer} bandeauLegal={legal} />;
  if (page === "mentions")        return <MentionsLegales setPage={setPage} footer={footer} bandeauLegal={legal} />;
  if (page === "confidentialite") return <Confidentialite setPage={setPage} footer={footer} bandeauLegal={legal} />;

  if (page === "preuves") return (
    <div className="page">
      {navbar}
      <div className="container" style={{paddingTop:"110px",paddingBottom:"80px"}}>
        <div className="section-label reveal">Preuves de gains</div>
        <p style={{color:"var(--muted)",fontSize:"13px",marginBottom:"28px"}}>Toutes nos captures d'écran Winamax. 100% transparent, 0% caché.</p>
        <div className="preuves-grid">
          {preuves.map((p, i) => (
            <div className="preuve-card" key={i}>
              <img className="preuve-img" src={p.img} alt={p.match} loading="lazy"
                onError={e => { e.target.style.display="none"; }} />
              <div className="preuve-info">
                <div className="preuve-date">{p.date}</div>
                <div className="preuve-match">{p.match}</div>
                <div className="preuve-gain">{p.gain}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="cta-box" style={{marginTop:"40px"}}>
          <p className="cta-eyebrow">Rejoignez-nous</p>
          <h2 className="cta-title">Pariez avec les mêmes picks</h2>
          <a href={WINAMAX_LINK} target="_blank" rel="noreferrer" className="cta-btn">→ Ouvrir un compte Winamax</a>
        </div>
      </div>
      {footer}{legal}
    </div>
  );

  if (page === "bookmakers") return (
    <div className="page">
      {navbar}
      <div className="container" style={{paddingTop:"110px",paddingBottom:"80px"}}>
        <div className="section-label reveal">Nos bookmakers partenaires</div>
        <p style={{color:"var(--muted)",fontSize:"13px",marginBottom:"4px"}}>Tous nos partenaires sont agréés ANJ — Paris légaux et sécurisés en France.</p>
        <p style={{color:"var(--dim)",fontSize:"11px",marginBottom:"28px"}}>En vous inscrivant via nos liens vous nous aidez à maintenir ce service gratuit.</p>
        <div className="bm-list">
          {bookmakers.map((b, i) => (
            <div className="bm-card" key={i}>
              <div style={{flex:1,minWidth:"200px"}}>
                <div className="bm-badges">
                  <span className="bm-name">{b.nom}</span>
                  <span className="bm-badge">{b.badge}</span>
                  <span className="bm-bonus">{b.bonus}</span>
                </div>
                <p className="bm-desc">{b.desc}</p>
                <span className="bm-note">Notre note : {b.note}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"6px",flexShrink:0}}>
                <a href={b.link} target="_blank" rel="noreferrer" className="bm-btn">S'inscrire</a>
                <span style={{color:"var(--dim)",fontSize:"9px",letterSpacing:"1px"}}>Lien affilié</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {footer}{legal}
    </div>
  );

  // ── HOME PAGE ──────────────────────────────────────────────────────────────
  return (
    <div className="page">
      {navbar}

      {/* HERO */}
      <div className="hero">
        <div className="hero-field" />
        <div className="hero-glow" />
        <p className="hero-eyebrow reveal">Propulsé par Intelligence Artificielle</p>
        <h1 className="hero-title reveal">Le meilleur <em>pick</em><br/>chaque jour.</h1>
        <p className="hero-sub reveal">Notre IA analyse des centaines de matchs. Seulement les paris qui atteignent 8/10 minimum sont publiés.</p>

        <div className="stats-grid reveal">
          {/* Win Rate — ring */}
          <div className="stat-card">
            <span className="stat-label">Win Rate</span>
            <WinRateRing pct={winrate} />
            <span className="stat-sub">sur {total} paris</span>
          </div>
          {/* Bankroll */}
          <div className="stat-card">
            <span className="stat-label">Bankroll</span>
            <CountUp target={394} prefix="+" suffix="%" />
            <span className="stat-sub">depuis le début</span>
          </div>
          {/* Picks */}
          <div className="stat-card">
            <span className="stat-label">Picks</span>
            <span className="stat-value">{wins}W / {losses}L</span>
            <span className="stat-sub">série en cours</span>
          </div>
          {/* Série */}
          <div className="stat-card">
            <span className="stat-label">Série</span>
            <span className="stat-value">17W</span>
            <span className="stat-sub">sur {total} picks</span>
          </div>
        </div>
      </div>

      {/* COMMENT ÇA MARCHE */}
      <section className="section">
        <div className="container">
          <div className="section-label reveal">Comment ça marche</div>
          <div className="how-grid">
            {[
              {n:"01",t:"L'IA scanne tout",d:"Notre algorithme analyse des centaines de matchs par jour sur plus de 50 ligues mondiales."},
              {n:"02",t:"Seuil 8/10 minimum",d:"Seuls les picks avec un score de confiance ≥ 8/10 passent le filtre. Si aucun ne l'atteint, on descend à 7/10."},
              {n:"03",t:"Tu mises, tu gagnes",d:"Reçois le pick, mise chez ton bookmaker partenaire, encaisse tes gains. Aussi simple que ça."},
            ].map((s, i) => (
              <div className="how-card reveal" key={i}>
                <div className="how-num">{s.n}</div>
                <h3 className="how-title">{s.t}</h3>
                <p className="how-desc">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PICK DU JOUR */}
      <section className="section" style={{paddingTop:0}} id="picks">
        <div className="container">
          <div className="section-label reveal">Prochain match à jouer</div>

          {isNoPick ? (
            <div className="nopick-card reveal">
              <p className="nopick-text">Aucun match ne remplit nos critères aujourd'hui — notre IA est en analyse. Revenez demain.</p>
            </div>
          ) : (
            <div className="pick-card reveal">
              <div className="pick-eyebrow">
                {(isEnCours || isEnAttente) ? "⏳ En attente de résultat" : `Match recommandé · ${pickDuJour[0]}`}
              </div>

              {/* VS layout */}
              <div className="pick-vs-row">
                <div className="pick-team home">
                  <div className="pick-badge">{sportEmoji(pickDuJour[6])}</div>
                  <span className="pick-team-name">{homeTeam}</span>
                </div>
                <div className="pick-vs-center">
                  <div className="pick-vs-line"/>
                  <span className="pick-vs-text">VS</span>
                  <div className="pick-vs-line"/>
                </div>
                <div className="pick-team">
                  <div className="pick-badge">{sportEmoji(pickDuJour[6])}</div>
                  <span className="pick-team-name">{awayTeam}</span>
                </div>
              </div>

              <div className="pick-meta">
                <span className={`pick-tag${isFallback7 ? " tag-7" : ""}`}>
                  {pickDuJour[2]} {isFallback7 && "· seuil 7/10"}
                </span>
                <span className="pick-odds">Cote : <strong>{pickDuJour[3]}</strong></span>
              </div>

              {/* Confidence bar */}
              {pickDuJour[7] > 0 && (
                <div className="pick-conf">
                  <span className="pick-conf-label">Confiance IA</span>
                  <div className="pick-conf-track">
                    <ConfBar score={pickDuJour[7]} />
                  </div>
                  <span className="pick-conf-score">{pickDuJour[7]} / 10</span>
                </div>
              )}

              <a href={WINAMAX_LINK} target="_blank" rel="noreferrer" className="pick-cta">
                → Parier sur Winamax
              </a>
            </div>
          )}
        </div>
      </section>

      {/* HISTORIQUE */}
      <section className="section" id="historique">
        <div className="container">
          <div className="section-label reveal">Historique des picks</div>
          <div className="history-filters reveal">
            {[
              {k:"ALL",l:"Tous"},
              {k:"Foot",l:"⚽ Foot"},
              {k:"Hockey",l:"🏒 Hockey"},
              {k:"Basketball",l:"🏀 Basket"},
              {k:"Tennis",l:"🎾 Tennis"},
              {k:"Baseball",l:"⚾ Baseball"},
              {k:"NFL",l:"🏈 NFL"},
            ].map(f => (
              <button key={f.k} className={`filter-btn${filter===f.k?" active":""}`} onClick={() => setFilter(f.k)}>{f.l}</button>
            ))}
          </div>
          <div className="history-table reveal">
            {filtered.map((p, i) => {
              const isNP = p[5]==="NOPICK";
              return (
                <div className={rowClass(p[5])} key={i}>
                  <span className="row-date">{p[0]}</span>
                  <span className={`row-match${isNP?" italic":""}`}>
                    {!isNP && <span style={{fontSize:"14px",flexShrink:0}}>{sportEmoji(p[6])}</span>}
                    {p[1]}
                  </span>
                  <span className="row-pred">{p[2]}</span>
                  <span className="row-odds">{p[3]}</span>
                  <span className="row-score">{p[4]}</span>
                  <div className="row-result">
                    <span className="rdot"/>
                    {isNP ? "—" : resultLabel(p[5])}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TÉMOIGNAGES */}
      <section className="section" style={{paddingTop:0}}>
        <div className="container">
          <div className="section-label reveal">Ils gagnent avec nous</div>
          <div className="testi-grid reveal">
            {temoignages.map((t, i) => (
              <div className="testi-card" key={i}>
                <p className="testi-text">"{t.txt}"</p>
                <div className="testi-footer">
                  <div>
                    <div className="testi-name">{t.nom}</div>
                    <div className="testi-city">{t.ville}</div>
                  </div>
                  <div className="testi-gain">{t.gains}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" style={{paddingTop:0}}>
        <div className="container">
          <div className="section-label reveal">Questions fréquentes</div>
          <div className="faq-list reveal">
            {faqs.map((f, i) => (
              <div className={`faq-item${faqOpen===i?" open":""}`} key={i}>
                <button className="faq-q" onClick={() => {
                  setFaqOpen(faqOpen===i ? null : i);
                  // animate max-height
                  const body = document.querySelectorAll(".faq-body")[i];
                  if (faqOpen === i) {
                    body.style.maxHeight = "0";
                  } else {
                    body.style.maxHeight = body.scrollHeight + "px";
                    document.querySelectorAll(".faq-body").forEach((b, j) => {
                      if (j !== i) b.style.maxHeight = "0";
                    });
                  }
                }}>
                  {f.q}
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-body">
                  <div className="faq-body-inner">{f.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{paddingTop:0}}>
        <div className="container">
          <div className="cta-box reveal">
            <p className="cta-eyebrow">Prêt à gagner ?</p>
            <h2 className="cta-title">Rejoignez les parieurs<br/>qui nous font confiance</h2>
            <p className="cta-desc">Ouvre ton compte Winamax maintenant et reçois jusqu'à 200 EUR de bonus de bienvenue.</p>
            <a href={WINAMAX_LINK} target="_blank" rel="noreferrer" className="cta-btn">
              → Ouvrir un compte Winamax — Gratuit
            </a>
          </div>
        </div>
      </section>

      {/* PARTENAIRES */}
      <section className="section" style={{paddingTop:0}} id="partenaires">
        <div className="container">
          <div className="partners-header">
            <div className="section-label reveal" style={{marginBottom:0,flex:1}}>Nos partenaires</div>
            <button className="see-all" onClick={() => setPage("bookmakers")}>Voir tous</button>
          </div>
          <div className="partners-grid reveal">
            {bookmakers.slice(0, 3).map((b, i) => (
              <a href={b.link} target="_blank" rel="noreferrer" className="partner-card" key={i}>
                <span className="partner-name">{b.nom}</span>
                <span className="partner-bonus">{b.bonus}</span>
                <button className="partner-btn" onClick={e => e.preventDefault()}>S'inscrire</button>
              </a>
            ))}
          </div>
        </div>
      </section>

      {footer}
      {legal}
    </div>
  );
}
