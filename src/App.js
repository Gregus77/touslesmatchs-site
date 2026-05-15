import React, { useState } from "react";

var BREVO_API_KEY = process.env.REACT_APP_BREVO_API_KEY;
var WINAMAX_LINK = "https://www.winamax.fr/parrain?code=WMX8M5";
var BETCLIC_LINK = "https://www.betclic.fr/affiliation-TONLIEN";
var UNIBET_LINK = "https://www.unibet.fr/affiliation-TONLIEN";
var PMU_LINK = "https://www.pmu.fr/affiliation-TONLIEN";
var ZEBET_LINK = "https://www.zebet.fr/affiliation-TONLIEN";
var PARIONSSPORT_LINK = "https://www.parionssport.fdj.fr/affiliation-TONLIEN";
var NETBET_LINK = "https://www.netbet.fr/affiliation-TONLIEN";
var TIKTOK_LINK = "https://www.tiktok.com/@touslesmatchs.com";

var picks = [
  ["17/05","Brentford vs Crystal Palace","Brentford ML","1.64","?-?","EN COURS","Foot"],
  ["15/05","PAS DE PARI - Aucun match n atteint notre seuil 8/10","---","---","---","NOPICK",""],
  ["14/05","PAS DE PARI - Aucun match n atteint notre seuil 8/10","---","---","---","NOPICK",""],
  ["13/05","Lazio vs Inter Milan","Inter ML","1.66","0-2","GAGNE","Foot"],
  ["13/05","Villarreal vs Seville","Over 2.5","1.75","2-2","GAGNE","Foot"],
  ["11/05","Carolina vs Philadelphia","Carolina ML","1.58","4-2","GAGNE","Hockey"],
  ["10/05","Colorado vs Minnesota","Colorado ML","1.62","5-1","GAGNE","Hockey"],
  ["09/05","VGK vs Anaheim","VGK ML","1.55","6-2","GAGNE","Hockey"],
  ["08/05","Carolina vs Philadelphia","Carolina ML","1.52","4-1","GAGNE","Hockey"],
  ["07/05","Anaheim vs VGK","Anaheim ML","1.78","3-1","GAGNE","Hockey"],
  ["06/05","Buffalo vs Montreal","Buffalo ML","1.60","1-5","PERDU","Hockey"],
  ["05/05","VGK vs Anaheim","VGK ML","1.54","3-1","GAGNE","Hockey"],
  ["04/05","Colorado vs Minnesota","Colorado ML","1.58","9-6","GAGNE","Hockey"],
  ["03/05","Carolina vs Philadelphia","Carolina ML","1.50","3-0","GAGNE","Hockey"],
  ["02/05","Utah vs VGK","VGK ML","1.62","5-1","GAGNE","Hockey"],
  ["01/05","Buffalo vs Boston","Buffalo ML","1.70","4-1","GAGNE","Hockey"],
  ["29/04","Leverkusen vs Dortmund","Over 2.5","1.62","3-1","GAGNE","Foot"],
  ["28/04","Bayern vs Stuttgart","Over 2.5","1.55","1-0","PERDU","Foot"]
];

var preuves = [
  {date:"13/05/2026", match:"Villarreal victoire vs Seville", gain:"+8.80 EUR", img:"/preuves/preuve_villarreal_13mai.jpg"},
  {date:"12/05/2026", match:"Colorado Avalanche victoire vs Minnesota", gain:"+7.80 EUR", img:"/preuves/preuve_colorado_12mai.jpg"},
  {date:"07/05/2026", match:"Buffalo Sabres victoire vs Montreal", gain:"+7.60 EUR", img:"/preuves/preuve_buffalo_07mai.jpg"},
  {date:"04/05/2026", match:"Colorado Avalanche victoire vs Minnesota", gain:"+5.40 EUR", img:"/preuves/preuve_colorado_04mai.jpg"},
  {date:"13/05/2026", match:"Inter Milan victoire vs Lazio", gain:"+4.60 EUR", img:""},
  {date:"11/05/2026", match:"Carolina Hurricanes victoire", gain:"+5.00 EUR", img:""},
  {date:"10/05/2026", match:"Colorado Avalanche victoire", gain:"+7.80 EUR", img:""}
];

var bookmakers = [
  {nom:"Winamax", badge:"PARTENAIRE N°1", bonus:"Bonus jusqu'à 200 EUR", desc:"Le bookmaker français numéro 1. Cotes excellentes, interface top, retraits rapides.", link:WINAMAX_LINK},
  {nom:"Betclic", badge:"TOP COTES", bonus:"Bonus bienvenue 100 EUR", desc:"Cotes très compétitives surtout sur le foot européen. Appli mobile excellente.", link:BETCLIC_LINK},
  {nom:"Unibet", badge:"FIABLE", bonus:"Mise remboursée 100 EUR", desc:"Bookmaker international solide. Large choix de sports et de marchés.", link:UNIBET_LINK},
  {nom:"PMU", badge:"100% FRANÇAIS", bonus:"Bonus 150 EUR", desc:"L'historique des paris en France. Idéal pour le foot et les courses hippiques.", link:PMU_LINK},
  {nom:"ZEbet", badge:"COTES ELEVEES", bonus:"Remboursement 100 EUR", desc:"Spécialiste des cotes boostées. Souvent les meilleures cotes sur certains marchés.", link:ZEBET_LINK},
  {nom:"ParionsSport", badge:"FDJ", bonus:"Bonus 100 EUR", desc:"Le bookmaker de la FDJ. Réseau de points de vente partout en France.", link:PARIONSSPORT_LINK},
  {nom:"NetBet", badge:"SIMPLE", bonus:"Bonus 50 EUR", desc:"Interface simple et efficace. Bon choix pour les débutants.", link:NETBET_LINK}
];

function App() {
  const [email, setEmail] = useState("");
  const [msgEnvoi, setMsgEnvoi] = useState("");

  const validPicks = picks.filter(p => p[5] !== "NOPICK" && p[5] !== "EN COURS");
  const wins = validPicks.filter(p => p[5] === "GAGNE");
  const winRate = validPicks.length > 0 ? Math.round((wins.length / validPicks.length) * 100) : 0;

  const handleSubscribe = async () => {
    if (!email) { setMsgEnvoi("Entrez un email valide."); return; }
    try {
      const res = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": BREVO_API_KEY,
          "content-type": "application/json"
        },
        body: JSON.stringify({ email: email, listIds: [2], updateEnabled: true })
      });
      if (res.status === 201 || res.status === 204) {
        setMsgEnvoi("✅ Inscription réussie ! Vous recevrez nos picks par email.");
        setEmail("");
      } else {
        setMsgEnvoi("❌ Erreur. Veuillez réessayer.");
      }
    } catch {
      setMsgEnvoi("❌ Erreur réseau. Veuillez réessayer.");
    }
  };

  const getBgColor = (statut) => {
    if (statut === "GAGNE") return "#d4edda";
    if (statut === "PERDU") return "#f8d7da";
    if (statut === "EN COURS") return "#fff3cd";
    return "#f9f9f9";
  };

  const getEmoji = (statut) => {
    if (statut === "GAGNE") return "✅";
    if (statut === "PERDU") return "❌";
    if (statut === "EN COURS") return "⏳";
    return "—";
  };

  return (
    <div style={{fontFamily:"Arial, sans-serif", maxWidth:"960px", margin:"0 auto", padding:"20px", color:"#222"}}>

      {/* HEADER */}
      <div style={{textAlign:"center", padding:"30px 0", borderBottom:"2px solid #eee", marginBottom:"30px"}}>
        <h1 style={{fontSize:"2.2em", margin:"0 0 5px 0"}}>⚽ TousLesMatchs</h1>
        <p style={{color:"#666", margin:"0 0 15px 0"}}>Picks sportifs journaliers — Seuil minimum 8/10 garanti</p>
        <a href={TIKTOK_LINK} target="_blank" rel="noreferrer"
           style={{background:"#000", color:"#fff", padding:"10px 20px", borderRadius:"25px", textDecoration:"none", fontWeight:"bold"}}>
          🎵 Suivez-nous sur TikTok
        </a>
      </div>

      {/* STATS */}
      <div style={{display:"flex", justifyContent:"center", gap:"20px", marginBottom:"35px", flexWrap:"wrap"}}>
        <div style={{textAlign:"center", padding:"20px 30px", background:"#f0f0f0", borderRadius:"12px", minWidth:"100px"}}>
          <div style={{fontSize:"2.5em", fontWeight:"bold"}}>{validPicks.length}</div>
          <div style={{color:"#666"}}>Paris joués</div>
        </div>
        <div style={{textAlign:"center", padding:"20px 30px", background:"#d4edda", borderRadius:"12px", minWidth:"100px"}}>
          <div style={{fontSize:"2.5em", fontWeight:"bold", color:"#28a745"}}>{wins.length}</div>
          <div style={{color:"#666"}}>Gagnés</div>
        </div>
        <div style={{textAlign:"center", padding:"20px 30px", background:"#cce5ff", borderRadius:"12px", minWidth:"100px"}}>
          <div style={{fontSize:"2.5em", fontWeight:"bold", color:"#007bff"}}>{winRate}%</div>
          <div style={{color:"#666"}}>Win Rate</div>
        </div>
      </div>

      {/* PICKS */}
      <h2 style={{borderLeft:"4px solid #007bff", paddingLeft:"12px"}}>📋 Nos Picks</h2>
      <div style={{overflowX:"auto", marginBottom:"35px"}}>
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#222", color:"#fff"}}>
              <th style={{padding:"12px 8px"}}>Date</th>
              <th style={{padding:"12px 8px", textAlign:"left"}}>Match</th>
              <th style={{padding:"12px 8px"}}>Pari</th>
              <th style={{padding:"12px 8px"}}>Cote</th>
              <th style={{padding:"12px 8px"}}>Score</th>
              <th style={{padding:"12px 8px"}}>Sport</th>
              <th style={{padding:"12px 8px"}}>Résultat</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((p, i) => (
              <tr key={i} style={{background:getBgColor(p[5]), borderBottom:"1px solid #ddd"}}>
                <td style={{padding:"10px 8px", textAlign:"center", whiteSpace:"nowrap"}}>{p[0]}</td>
                <td style={{padding:"10px 8px"}}>{p[1]}</td>
                <td style={{padding:"10px 8px", textAlign:"center"}}>{p[2]}</td>
                <td style={{padding:"10px 8px", textAlign:"center", fontWeight:"bold"}}>{p[3]}</td>
                <td style={{padding:"10px 8px", textAlign:"center"}}>{p[4]}</td>
                <td style={{padding:"10px 8px", textAlign:"center"}}>{p[6]}</td>
                <td style={{padding:"10px 8px", textAlign:"center", fontSize:"1.3em"}}>{getEmoji(p[5])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PREUVES */}
      <h2 style={{borderLeft:"4px solid #28a745", paddingLeft:"12px"}}>🏆 Preuves de Gains</h2>
      <p style={{color:"#666", marginBottom:"20px"}}>Captures Winamax authentiques — nos picks paient.</p>
      <div style={{display:"flex", flexWrap:"wrap", gap:"15px", marginBottom:"35px"}}>
        {preuves.map((p, i) => (
          <div key={i} style={{width:"190px", background:"#fff", border:"1px solid #ddd", borderRadius:"12px", overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.1)"}}>
            {p.img ? (
              <img src={p.img} alt={p.match} style={{width:"100%", height:"160px", objectFit:"cover"}} />
            ) : (
              <div style={{width:"100%", height:"160px", background:"#f0f0f0", display:"flex", alignItems:"center", justifyContent:"center", color:"#aaa"}}>📷</div>
            )}
            <div style={{padding:"10px"}}>
              <div style={{fontWeight:"bold", fontSize:"0.85em", marginBottom:"4px"}}>{p.match}</div>
              <div style={{color:"#28a745", fontWeight:"bold", fontSize:"1.1em"}}>{p.gain}</div>
              <div style={{color:"#999", fontSize:"0.78em"}}>{p.date}</div>
            </div>
          </div>
        ))}
      </div>

      {/* INSCRIPTION */}
      <h2 style={{borderLeft:"4px solid #fd7e14", paddingLeft:"12px"}}>📧 Recevoir Nos Picks</h2>
      <div style={{background:"#fff8f0", padding:"25px", borderRadius:"12px", marginBottom:"35px", border:"1px solid #ffd", }}>
        <p style={{margin:"0 0 15px 0"}}>Inscrivez-vous pour recevoir nos picks chaque jour directement par email. Gratuit.</p>
        <div style={{display:"flex", gap:"10px", flexWrap:"wrap"}}>
          <input
            type="email"
            placeholder="votre@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{flex:"1", minWidth:"200px", padding:"12px", borderRadius:"8px", border:"1px solid #ddd", fontSize:"1em"}}
          />
          <button
            onClick={handleSubscribe}
            style={{padding:"12px 24px", background:"#fd7e14", color:"#fff", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"bold", fontSize:"1em"}}>
            S'inscrire gratuitement
          </button>
        </div>
        {msgEnvoi && <p style={{marginTop:"12px", fontWeight:"bold"}}>{msgEnvoi}</p>}
      </div>

      {/* BOOKMAKERS */}
      <h2 style={{borderLeft:"4px solid #6f42c1", paddingLeft:"12px"}}>📚 Bookmakers Recommandés</h2>
      <div style={{display:"flex", flexWrap:"wrap", gap:"15px", marginBottom:"35px"}}>
        {bookmakers.map((b, i) => (
          <div key={i} style={{flex:"1", minWidth:"220px", padding:"18px", border:"1px solid #ddd", borderRadius:"12px", background:"#fff", boxShadow:"0 2px 5px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px"}}>
              <strong style={{fontSize:"1.1em"}}>{b.nom}</strong>
              <span style={{background:"#6f42c1", color:"#fff", padding:"2px 8px", borderRadius:"10px", fontSize:"0.72em"}}>{b.badge}</span>
            </div>
            <div style={{color:"#28a745", fontWeight:"bold", marginBottom:"6px"}}>{b.bonus}</div>
            <div style={{color:"#666", fontSize:"0.84em", marginBottom:"12px"}}>{b.desc}</div>
            <a href={b.link} target="_blank" rel="noreferrer"
               style={{display:"block", textAlign:"center", background:"#28a745", color:"#fff", padding:"9px", borderRadius:"7px", textDecoration:"none", fontWeight:"bold"}}>
              Ouvrir un compte →
            </a>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div style={{textAlign:"center", color:"#aaa", fontSize:"0.82em", paddingTop:"20px", borderTop:"1px solid #eee"}}>
        <p>© 2026 TousLesMatchs.com — Paris responsables. 18+ uniquement.</p>
        <a href={TIKTOK_LINK} target="_blank" rel="noreferrer" style={{color:"#000", textDecoration:"none", fontWeight:"bold"}}>🎵 @touslesmatchs.com sur TikTok</a>
      </div>

    </div>
  );
}

export default App;