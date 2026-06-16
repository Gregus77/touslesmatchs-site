import React from "react";

// ── Drapeaux pays / clubs ────────────────────────────────────────────────────
var FLAGS = {
  // Pays
  "france":"🇫🇷","england":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","germany":"🇩🇪","spain":"🇪🇸","italy":"🇮🇹",
  "portugal":"🇵🇹","netherlands":"🇳🇱","belgium":"🇧🇪","brazil":"🇧🇷","argentina":"🇦🇷",
  "usa":"🇺🇸","canada":"🇨🇦","japan":"🇯🇵","australia":"🇦🇺","russia":"🇷🇺",
  "switzerland":"🇨🇭","greece":"🇬🇷","turkey":"🇹🇷","croatia":"🇭🇷","denmark":"🇩🇰",
  "sweden":"🇸🇪","norway":"🇳🇴","poland":"🇵🇱","ukraine":"🇺🇦","serbia":"🇷🇸",
  "burkina faso":"🇧🇫","tunisia":"🇹🇳","morocco":"🇲🇦","senegal":"🇸🇳","uzbekistan":"🇺🇿",
  // Clubs foot
  "psg":"🔵","paris saint-germain":"🔵","marseille":"🔵","lyon":"🔴","monaco":"🔴",
  "nice":"🔴","lille":"🔴","rennes":"🔵","lens":"🟡","strasbourg":"🔵",
  "man city":"🔵","manchester city":"🔵","arsenal":"🔴","chelsea":"🔵",
  "liverpool":"🔴","man utd":"🔴","manchester united":"🔴","tottenham":"⚪",
  "newcastle":"⚫","aston villa":"🟣",
  "real madrid":"⚪","barcelona":"🔵","atletico madrid":"🔴","sevilla":"⚪",
  "villarreal":"🟡","betis":"🟢",
  "bayern":"🔴","bayern munich":"🔴","dortmund":"🟡","borussia dortmund":"🟡",
  "leverkusen":"🔴","leipzig":"🔴",
  "juventus":"⚫","inter milan":"🔵","ac milan":"🔴","napoli":"🔵","roma":"🟡","lazio":"🔵",
  "fribourg":"⚫","boca juniors":"🔵","cruzeiro":"🔵",
};

function getFlag(name) {
  if (!name) return "⚽";
  var key = name.toLowerCase();
  if (FLAGS[key]) return FLAGS[key];
  // Cherche correspondance partielle
  for (var k in FLAGS) {
    if (key.includes(k) || k.includes(key)) return FLAGS[k];
  }
  return "⚽";
}

// ── Agents IA du Conseil ─────────────────────────────────────────────────────
var AGENTS = [
  { id:"claude", name:"Claude", color:"#00FF41", bg:"rgba(0,255,65,0.12)", icon:"🧠" },
  { id:"gpt",    name:"GPT-4o", color:"#10a37f", bg:"rgba(16,163,127,0.12)", icon:"🤖" },
  { id:"gemini", name:"Gemini", color:"#4285F4", bg:"rgba(66,133,244,0.12)", icon:"💎" },
  { id:"mistral",name:"Mistral",color:"#FF7000", bg:"rgba(255,112,0,0.12)",  icon:"🌊" },
  { id:"groq",   name:"Groq",   color:"#F236F5", bg:"rgba(242,54,245,0.12)", icon:"⚡" },
];

// ── Matchs de démo (remplacer par /api/live-matches) ─────────────────────────
var DEMO_MATCHES = [
  {
    id:1, status:"LIVE", minute:"67", competition:"Ligue 1", flag:"🇫🇷",
    home:"PSG", away:"Lyon", score:"2-1",
    predictions:{
      btts:85, over25:72, home_win:78, draw:12, away_win:10,
      next_goal_before_80:63, cards_over35:55,
      conseil:"Victoire PSG + Over 2.5",
      confidence:88,
      agents:{
        claude:{ btts:87, over25:74, result:"Domicile", confidence:90, note:"Forte pression PSG, Lyon vulnérable défensivement" },
        gpt:   { btts:83, over25:71, result:"Domicile", confidence:86, note:"PSG surclasse en xG, Lyon en manque offensif" },
        gemini:{ btts:86, over25:73, result:"Domicile", confidence:89, note:"Historique H2H favorable PSG à domicile (7/8)" },
        mistral:{ btts:82, over25:69, result:"Domicile", confidence:84, note:"Forme PSG sur 5 derniers matchs : 4V 1N" },
        groq:  { btts:87, over25:75, result:"Domicile", confidence:91, note:"Momentum fort, ligne défensive Lyon affaiblie" },
      }
    }
  },
  {
    id:2, status:"UPCOMING", time:"21:00", competition:"Premier League", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    home:"Arsenal", away:"Man City", score:null,
    predictions:{
      btts:71, over25:65, home_win:42, draw:28, away_win:30,
      next_goal_before_80:null, cards_over35:48,
      conseil:"Les deux équipes marquent",
      confidence:76,
      agents:{
        claude:{ btts:73, over25:66, result:"Domicile", confidence:77, note:"Arsenal en grande forme à domicile, City offense redoutable" },
        gpt:   { btts:70, over25:63, result:"Nul",      confidence:74, note:"Affrontement équilibré, cote valeur sur le nul" },
        gemini:{ btts:72, over25:67, result:"Domicile", confidence:78, note:"Derniers 4 H2H : 3 fois BTTS, xG équilibrés" },
        mistral:{ btts:68, over25:62, result:"Extérieur",confidence:72, note:"City dominant en déplacement cette saison" },
        groq:  { btts:74, over25:68, result:"Domicile", confidence:79, note:"Emirates Stadium avantage fort pour Arsenal" },
      }
    }
  },
  {
    id:3, status:"LIVE", minute:"34", competition:"Bundesliga", flag:"🇩🇪",
    home:"Bayern", away:"Dortmund", score:"1-0",
    predictions:{
      btts:68, over25:79, home_win:65, draw:18, away_win:17,
      next_goal_before_80:71, cards_over35:62,
      conseil:"Over 2.5 buts + Victoire Bayern",
      confidence:82,
      agents:{
        claude:{ btts:70, over25:81, result:"Domicile", confidence:84, note:"Bayern 4.2 xG/match à domicile cette saison" },
        gpt:   { btts:65, over25:77, result:"Domicile", confidence:80, note:"Clasico allemand toujours prolifique (3.4 buts/match moy)" },
        gemini:{ btts:68, over25:80, result:"Domicile", confidence:83, note:"Dortmund marque toujours mais concède aussi" },
        mistral:{ btts:67, over25:78, result:"Domicile", confidence:81, note:"Bayern imprenable à Allianz Arena : 9V 0N 0D" },
        groq:  { btts:71, over25:82, result:"Domicile", confidence:85, note:"Score 1-0 + pression constante = Over très probable" },
      }
    }
  },
  {
    id:4, status:"UPCOMING", time:"18:45", competition:"Champions League", flag:"🏆",
    home:"Real Madrid", away:"Atletico Madrid", score:null,
    predictions:{
      btts:59, over25:54, home_win:52, draw:25, away_win:23,
      conseil:"Victoire Real Madrid",
      confidence:72,
      agents:{
        claude:{ btts:60, over25:55, result:"Domicile", confidence:73, note:"Real Madrid supérieur sur le plan individuel et collectif" },
        gpt:   { btts:57, over25:52, result:"Domicile", confidence:70, note:"Derby madrilène historiquement serré, Real à domicile avantage" },
        gemini:{ btts:61, over25:56, result:"Nul",      confidence:68, note:"Atletico défend très bien, attention au nul" },
        mistral:{ btts:58, over25:53, result:"Domicile", confidence:71, note:"Real Madrid : 78% victoire à domicile cette saison" },
        groq:  { btts:62, over25:57, result:"Domicile", confidence:74, note:"Mbappé en grande forme, 7 buts sur les 4 derniers matchs" },
      }
    }
  },
  {
    id:5, status:"LIVE", minute:"78", competition:"Serie A", flag:"🇮🇹",
    home:"Inter Milan", away:"Juventus", score:"1-1",
    predictions:{
      btts:92, over25:45, home_win:38, draw:41, away_win:21,
      next_goal_before_80:38, cards_over35:78,
      conseil:"BTTS confirmé — Nul probable",
      confidence:79,
      agents:{
        claude:{ btts:94, over25:47, result:"Nul",      confidence:80, note:"Score 1-1 à 78' — résultat très probable" },
        gpt:   { btts:91, over25:44, result:"Nul",      confidence:78, note:"Les deux équipes s'équilibrent, peu de temps restant" },
        gemini:{ btts:93, over25:46, result:"Domicile", confidence:77, note:"Inter pousse, petite chance renversement" },
        mistral:{ btts:90, over25:43, result:"Nul",      confidence:79, note:"78' : probabilité de 3e but très faible" },
        groq:  { btts:93, over25:48, result:"Nul",      confidence:81, note:"Pattern tactique défensif des deux équipes en fin de match" },
      }
    }
  },
  {
    id:6, status:"UPCOMING", time:"20:00", competition:"Ligue 1", flag:"🇫🇷",
    home:"Marseille", away:"Monaco", score:null,
    predictions:{
      btts:74, over25:68, home_win:48, draw:27, away_win:25,
      conseil:"Marseille gagne + BTTS",
      confidence:74,
      agents:{
        claude:{ btts:76, over25:70, result:"Domicile", confidence:75, note:"Vélodrome = forteresse, Marseille 6 victoires consécutives à domicile" },
        gpt:   { btts:73, over25:67, result:"Domicile", confidence:73, note:"Monaco en baisse de forme sur les 3 derniers matchs" },
        gemini:{ btts:75, over25:69, result:"Domicile", confidence:76, note:"Marseille meilleure attaque à domicile Ligue 1" },
        mistral:{ btts:71, over25:65, result:"Domicile", confidence:72, note:"Historique H2H : Marseille dominant cette décennie" },
        groq:  { btts:77, over25:71, result:"Domicile", confidence:77, note:"Mbemba de retour, défense renforcée pour Marseille" },
      }
    }
  },
  // 4 matchs supplémentaires (visibles premium seulement si free cap = 6)
  {
    id:7, status:"UPCOMING", time:"15:30", competition:"La Liga", flag:"🇪🇸",
    home:"Barcelona", away:"Sevilla", score:null,
    predictions:{
      btts:66, over25:71, home_win:68, draw:19, away_win:13,
      conseil:"Victoire Barcelone",
      confidence:80,
      agents:{
        claude:{ btts:67, over25:72, result:"Domicile", confidence:81 },
        gpt:   { btts:65, over25:70, result:"Domicile", confidence:79 },
        gemini:{ btts:68, over25:73, result:"Domicile", confidence:82 },
        mistral:{ btts:64, over25:69, result:"Domicile", confidence:78 },
        groq:  { btts:68, over25:74, result:"Domicile", confidence:83 },
      }
    }
  },
  {
    id:8, status:"LIVE", minute:"52", competition:"Ligue des Champions", flag:"🏆",
    home:"Liverpool", away:"Napoli", score:"2-0",
    predictions:{
      btts:42, over25:81, home_win:89, draw:7, away_win:4,
      conseil:"Liverpool domine — Over 2.5 certain",
      confidence:91,
      agents:{
        claude:{ btts:44, over25:83, result:"Domicile", confidence:92 },
        gpt:   { btts:41, over25:80, result:"Domicile", confidence:90 },
        gemini:{ btts:43, over25:82, result:"Domicile", confidence:91 },
        mistral:{ btts:40, over25:79, result:"Domicile", confidence:89 },
        groq:  { btts:45, over25:84, result:"Domicile", confidence:93 },
      }
    }
  },
  {
    id:9, status:"UPCOMING", time:"17:00", competition:"Bundesliga", flag:"🇩🇪",
    home:"Leverkusen", away:"Leipzig", score:null,
    predictions:{
      btts:71, over25:76, home_win:55, draw:24, away_win:21,
      conseil:"Over 2.5 + BTTS",
      confidence:77,
      agents:{
        claude:{ btts:72, over25:77, result:"Domicile", confidence:78 },
        gpt:   { btts:70, over25:75, result:"Domicile", confidence:76 },
        gemini:{ btts:73, over25:78, result:"Domicile", confidence:79 },
        mistral:{ btts:69, over25:74, result:"Domicile", confidence:75 },
        groq:  { btts:74, over25:79, result:"Domicile", confidence:80 },
      }
    }
  },
  {
    id:10, status:"UPCOMING", time:"22:00", competition:"MLS", flag:"🇺🇸",
    home:"LA Galaxy", away:"NYCFC", score:null,
    predictions:{
      btts:62, over25:67, home_win:51, draw:26, away_win:23,
      conseil:"LA Galaxy gagne à domicile",
      confidence:69,
      agents:{
        claude:{ btts:63, over25:68, result:"Domicile", confidence:70 },
        gpt:   { btts:61, over25:66, result:"Domicile", confidence:68 },
        gemini:{ btts:64, over25:69, result:"Domicile", confidence:71 },
        mistral:{ btts:60, over25:65, result:"Domicile", confidence:67 },
        groq:  { btts:65, over25:70, result:"Domicile", confidence:72 },
      }
    }
  },
];

// ── Sous-composants ───────────────────────────────────────────────────────────
function ProbBar({ value, color, height }) {
  return React.createElement("div", {
    style:{ background:"rgba(255,255,255,0.07)", borderRadius:"8px", height: height||"8px", overflow:"hidden" }
  },
    React.createElement("div", {
      style:{ width: value+"%", height:"100%", background: color||"#00FF41",
              borderRadius:"8px", transition:"width 1.2s ease" }
    })
  );
}

function AgentVote({ agent, data, matchHome, matchAway }) {
  var resultLabel = data.result === "Domicile" ? matchHome
                  : data.result === "Extérieur" ? matchAway
                  : "Nul";
  return React.createElement("div", {
    style:{ background: agent.bg, border:"1px solid "+agent.color+"33",
            borderRadius:"10px", padding:"12px 14px" }
  },
    React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px" } },
      React.createElement("span", { style:{ fontSize:"16px" } }, agent.icon),
      React.createElement("span", { style:{ color: agent.color, fontWeight:"700", fontSize:"13px" } }, agent.name),
      React.createElement("span", { style:{ marginLeft:"auto", background: agent.color+"22", color: agent.color,
        borderRadius:"20px", padding:"2px 8px", fontSize:"11px", fontWeight:"700" } },
        data.confidence+"%"
      )
    ),
    React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px", marginBottom:"8px" } },
      React.createElement("div", { style:{ background:"rgba(0,0,0,0.2)", borderRadius:"6px", padding:"6px 8px" } },
        React.createElement("div", { style:{ fontSize:"10px", color:"#888", marginBottom:"2px" } }, "BTTS"),
        React.createElement("span", { style:{ color:"#22C55E", fontWeight:"700", fontSize:"14px" } }, data.btts+"%")
      ),
      React.createElement("div", { style:{ background:"rgba(0,0,0,0.2)", borderRadius:"6px", padding:"6px 8px" } },
        React.createElement("div", { style:{ fontSize:"10px", color:"#888", marginBottom:"2px" } }, "Over 2.5"),
        React.createElement("span", { style:{ color:"#60A5FA", fontWeight:"700", fontSize:"14px" } }, data.over25+"%")
      )
    ),
    React.createElement("div", { style:{ display:"flex", alignItems:"center", justifyContent:"space-between" } },
      React.createElement("span", { style:{ fontSize:"11px", color:"#666" } }, "Vote final"),
      React.createElement("span", { style:{ color: agent.color, fontWeight:"700", fontSize:"12px" } }, resultLabel)
    ),
    data.note && React.createElement("div", {
      style:{ fontSize:"11px", color:"#555", marginTop:"6px", lineHeight:"1.5",
              borderTop:"1px solid rgba(255,255,255,0.05)", paddingTop:"6px" }
    }, data.note)
  );
}

function MatchCard({ match, isPremium, isLocked }) {
  var [expanded, setExpanded] = React.useState(false);
  var p = match.predictions;
  var homeFlag = getFlag(match.home);
  var awayFlag = getFlag(match.away);

  var consensusResult = (function() {
    var votes = Object.values(p.agents).map(function(a){ return a.result; });
    var counts = {};
    votes.forEach(function(v){ counts[v] = (counts[v]||0)+1; });
    return Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; })[0];
  })();

  var resultColor = { "Domicile":"#00FF41", "Nul":"#888", "Extérieur":"#60A5FA" };

  return React.createElement("div", {
    style:{
      background: isLocked ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
      border: isLocked ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,255,65,0.15)",
      borderRadius:"16px", marginBottom:"12px", overflow:"hidden",
      filter: isLocked ? "blur(2px)" : "none",
      pointerEvents: isLocked ? "none" : "auto",
      position:"relative",
      transition:"transform 0.2s, border-color 0.2s",
    }
  },
    // Header match
    React.createElement("div", {
      onClick: function(){ if(!isLocked) setExpanded(!expanded); },
      style:{ padding:"16px 18px", cursor: isLocked?"default":"pointer" }
    },
      // Ligne compétition
      React.createElement("div", { style:{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" } },
        React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"6px" } },
          React.createElement("span", { style:{ fontSize:"16px" } }, match.flag),
          React.createElement("span", { style:{ fontSize:"11px", color:"#888", fontWeight:"600", letterSpacing:"1px", textTransform:"uppercase" } }, match.competition)
        ),
        match.status === "LIVE"
          ? React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"6px" } },
              React.createElement("div", { style:{ width:"6px", height:"6px", background:"#EF4444", borderRadius:"50%",
                animation:"pulse-live 1.5s infinite" } }),
              React.createElement("span", { style:{ fontSize:"11px", color:"#EF4444", fontWeight:"700" } }, "LIVE "+match.minute+"'")
            )
          : React.createElement("span", { style:{ fontSize:"12px", color:"#60A5FA", fontWeight:"600" } }, match.time)
      ),

      // Teams + Score
      React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:"12px" } },
        React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"10px" } },
          React.createElement("span", { style:{ fontSize:"28px" } }, homeFlag),
          React.createElement("div", null,
            React.createElement("div", { style:{ fontWeight:"700", fontSize:"15px" } }, match.home),
            React.createElement("div", { style:{ fontSize:"11px", color:"#888" } }, "Domicile")
          )
        ),
        React.createElement("div", { style:{ textAlign:"center" } },
          match.score
            ? React.createElement("div", { style:{ fontFamily:"monospace", fontSize:"22px", fontWeight:"900", letterSpacing:"2px", color:"#F5F0E8" } }, match.score)
            : React.createElement("div", { style:{ fontSize:"13px", color:"#888", fontWeight:"600" } }, "VS")
        ),
        React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"10px", justifyContent:"flex-end", flexDirection:"row-reverse" } },
          React.createElement("span", { style:{ fontSize:"28px" } }, awayFlag),
          React.createElement("div", { style:{ textAlign:"right" } },
            React.createElement("div", { style:{ fontWeight:"700", fontSize:"15px" } }, match.away),
            React.createElement("div", { style:{ fontSize:"11px", color:"#888" } }, "Extérieur")
          )
        )
      ),

      // Conseil agrégé
      React.createElement("div", {
        style:{ marginTop:"14px", background:"rgba(0,255,65,0.08)", border:"1px solid rgba(0,255,65,0.2)",
                borderRadius:"10px", padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }
      },
        React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"8px" } },
          React.createElement("span", { style:{ fontSize:"14px" } }, "🧠"),
          React.createElement("div", null,
            React.createElement("div", { style:{ fontSize:"10px", color:"#00FF41", fontWeight:"700", letterSpacing:"1px" } }, "CONSEIL DES IA"),
            React.createElement("div", { style:{ fontSize:"13px", fontWeight:"700", color:"#F5F0E8" } }, p.conseil)
          )
        ),
        React.createElement("div", { style:{ textAlign:"right" } },
          React.createElement("div", { style:{ fontSize:"20px", fontWeight:"900", color:"#00FF41", fontFamily:"monospace" } }, p.confidence+"%"),
          React.createElement("div", { style:{ fontSize:"10px", color:"#888" } }, "Confiance")
        )
      ),

      // Stats rapides
      React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px", marginTop:"12px" } },
        [
          { label:"BTTS", val:p.btts, color:"#22C55E" },
          { label:"Over 2.5", val:p.over25, color:"#60A5FA" },
          { label:"Domicile", val:p.home_win, color:"#00FF41" },
        ].map(function(s) {
          return React.createElement("div", { key:s.label, style:{ background:"rgba(0,0,0,0.3)", borderRadius:"8px", padding:"8px 10px" } },
            React.createElement("div", { style:{ fontSize:"10px", color:"#666", marginBottom:"4px" } }, s.label),
            React.createElement("div", { style:{ fontWeight:"700", color:s.color, fontSize:"15px", marginBottom:"4px" } }, s.val+"%"),
            React.createElement(ProbBar, { value:s.val, color:s.color, height:"4px" })
          );
        })
      ),

      // Expand hint
      React.createElement("div", { style:{ textAlign:"center", marginTop:"10px", fontSize:"11px", color:"#555" } },
        expanded ? "▲ Réduire le Conseil des IA" : "▼ Voir le détail du Conseil des IA ("+AGENTS.length+" agents)"
      )
    ),

    // Panel détaillé Conseil
    expanded && React.createElement("div", {
      style:{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"16px 18px",
              background:"rgba(0,0,0,0.25)" }
    },
      React.createElement("div", { style:{ fontSize:"11px", letterSpacing:"3px", color:"#00FF41", fontWeight:"700", marginBottom:"14px" } },
        "🤖 VOTE INDIVIDUEL DU CONSEIL"
      ),

      // Consensus visuel
      React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px", marginBottom:"16px" } },
        [
          { label: match.home, key:"home_win", color:"#00FF41" },
          { label:"Nul",      key:"draw",     color:"#888" },
          { label: match.away, key:"away_win", color:"#60A5FA" },
        ].map(function(r) {
          var wins = Object.values(p.agents).filter(function(a){ return a.result === (r.key==="home_win"?"Domicile":r.key==="draw"?"Nul":"Extérieur"); }).length;
          return React.createElement("div", { key:r.key,
            style:{ background:"rgba(0,0,0,0.3)", borderRadius:"10px", padding:"10px", textAlign:"center",
                    border: consensusResult === (r.key==="home_win"?"Domicile":r.key==="draw"?"Nul":"Extérieur")
                            ? "1px solid "+r.color : "1px solid rgba(255,255,255,0.05)" }
          },
            React.createElement("div", { style:{ fontSize:"12px", color:r.color, fontWeight:"700", marginBottom:"4px" } }, r.label),
            React.createElement("div", { style:{ fontSize:"22px", fontWeight:"900", color:"#F5F0E8" } }, wins+"/5"),
            React.createElement("div", { style:{ fontSize:"10px", color:"#666" } }, "agents")
          );
        })
      ),

      // Cards agents
      React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"14px" } },
        AGENTS.map(function(agent) {
          return React.createElement(AgentVote, {
            key: agent.id,
            agent: agent,
            data: p.agents[agent.id],
            matchHome: match.home,
            matchAway: match.away,
          });
        })
      ),

      // Plus de stats
      React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" } },
        [
          { label:"Nul",       val:p.draw,        color:"#888" },
          { label:"Extérieur", val:p.away_win,    color:"#60A5FA" },
          { label:"Cartons +3.5", val:p.cards_over35, color:"#F59E0B" },
          p.next_goal_before_80 && { label:"But avant 80'", val:p.next_goal_before_80, color:"#A78BFA" },
        ].filter(Boolean).map(function(s) {
          return React.createElement("div", { key:s.label, style:{ background:"rgba(0,0,0,0.3)", borderRadius:"8px", padding:"10px" } },
            React.createElement("div", { style:{ display:"flex", justifyContent:"space-between", marginBottom:"6px" } },
              React.createElement("span", { style:{ fontSize:"12px", color:"#888" } }, s.label),
              React.createElement("span", { style:{ color:s.color, fontWeight:"700", fontSize:"14px" } }, s.val+"%")
            ),
            React.createElement(ProbBar, { value:s.val, color:s.color })
          );
        })
      )
    )
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function LivePage({ isPremium }) {
  var [filter, setFilter] = React.useState("ALL");
  var [matches] = React.useState(DEMO_MATCHES);

  var FREE_LIMIT  = 3;
  var PREMIUM_LIMIT = 40;
  var limit = isPremium ? PREMIUM_LIMIT : FREE_LIMIT;

  var filtered = matches.filter(function(m) {
    if (filter === "LIVE") return m.status === "LIVE";
    if (filter === "UPCOMING") return m.status === "UPCOMING";
    return true;
  });

  var visible = filtered.slice(0, limit);
  var locked  = filtered.slice(limit);

  var liveCount     = matches.filter(function(m){ return m.status === "LIVE"; }).length;
  var upcomingCount = matches.filter(function(m){ return m.status === "UPCOMING"; }).length;

  return React.createElement("div", { style:{ minHeight:"100vh", background:"#050505", color:"#F5F0E8",
    fontFamily:"'Jost',sans-serif", padding:"0 0 60px" } },

    // ── Styles animation ──
    React.createElement("style", null, `
      @keyframes pulse-live { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
      @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
    `),

    // ── Hero Live ──
    React.createElement("div", { style:{
      background:"linear-gradient(135deg,rgba(0,255,65,0.08) 0%,rgba(0,0,0,0) 60%)",
      borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"32px 24px 24px"
    }},
      React.createElement("div", { style:{ maxWidth:"760px", margin:"0 auto" } },
        React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px" } },
          React.createElement("div", { style:{ width:"8px", height:"8px", background:"#EF4444", borderRadius:"50%",
            animation:"pulse-live 1.5s infinite" } }),
          React.createElement("span", { style:{ fontSize:"11px", letterSpacing:"3px", color:"#EF4444", fontWeight:"700" } }, "EN DIRECT"),
          React.createElement("span", { style:{ fontSize:"11px", color:"#555" } }, "Mise à jour en temps réel")
        ),
        React.createElement("h1", { style:{ fontFamily:"'Bodoni Moda',serif", fontSize:"clamp(26px,5vw,40px)", fontWeight:"700",
          margin:"0 0 8px", color:"#F5F0E8" } },
          "Analyse Live par le ", React.createElement("em", { style:{ color:"#00FF41" } }, "Conseil des IA")
        ),
        React.createElement("p", { style:{ color:"#6b6356", fontSize:"14px", marginBottom:"20px" } },
          isPremium
            ? "Accès illimité — "+matches.length+" matchs analysés par vos 5 agents IA"
            : "Plan gratuit — "+FREE_LIMIT+" matchs/jour. Passez Premium pour accéder à tous les matchs."
        ),

        // Stats bar
        React.createElement("div", { style:{ display:"flex", gap:"20px", flexWrap:"wrap" } },
          [
            { icon:"🔴", val:liveCount, label:"En direct" },
            { icon:"🕐", val:upcomingCount, label:"À venir" },
            { icon:"🤖", val:"5", label:"Agents IA" },
            { icon:"📊", val:isPremium?"40":"3/40", label:"Matchs visibles" },
          ].map(function(s,i) {
            return React.createElement("div", { key:i, style:{ display:"flex", alignItems:"center", gap:"6px" } },
              React.createElement("span", { style:{ fontSize:"16px" } }, s.icon),
              React.createElement("span", { style:{ fontWeight:"700", color:"#F5F0E8" } }, s.val),
              React.createElement("span", { style:{ fontSize:"12px", color:"#666" } }, s.label)
            );
          })
        )
      )
    ),

    // ── Contenu ──
    React.createElement("div", { style:{ maxWidth:"760px", margin:"0 auto", padding:"24px 16px" } },

      // Filtres
      React.createElement("div", { style:{ display:"flex", gap:"6px", marginBottom:"20px",
        background:"rgba(255,255,255,0.03)", borderRadius:"10px", padding:"4px" } },
        [
          { key:"ALL",      label:"Tous ("+matches.length+")" },
          { key:"LIVE",     label:"🔴 Live ("+liveCount+")" },
          { key:"UPCOMING", label:"🕐 À venir ("+upcomingCount+")" },
        ].map(function(f) {
          return React.createElement("button", {
            key:f.key,
            onClick:function(){ setFilter(f.key); },
            style:{
              flex:1, padding:"10px", borderRadius:"7px", border:"none", cursor:"pointer",
              fontFamily:"'Jost',sans-serif", fontSize:"13px", fontWeight:"600",
              background: filter===f.key ? "rgba(0,255,65,0.15)" : "transparent",
              color: filter===f.key ? "#00FF41" : "#666",
              transition:"all 0.2s"
            }
          }, f.label);
        })
      ),

      // Matchs visibles
      visible.map(function(match) {
        return React.createElement(MatchCard, { key:match.id, match:match, isPremium:isPremium, isLocked:false });
      }),

      // Matchs verrouillés (blur + upsell)
      locked.length > 0 && !isPremium && React.createElement("div", null,
        // Matchs floutés
        locked.slice(0,2).map(function(match) {
          return React.createElement("div", { key:match.id, style:{ position:"relative" } },
            React.createElement(MatchCard, { match:match, isPremium:false, isLocked:true }),
            React.createElement("div", { style:{ position:"absolute", inset:0, borderRadius:"16px",
              backdropFilter:"blur(6px)", background:"rgba(8,7,6,0.5)", display:"flex",
              alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"8px" } },
              React.createElement("span", { style:{ fontSize:"20px" } }, "🔒"),
              React.createElement("span", { style:{ fontSize:"12px", color:"#00FF41", fontWeight:"700" } }, "PREMIUM")
            )
          );
        }),

        // Upsell card
        React.createElement("div", { style:{
          background:"linear-gradient(135deg,rgba(0,255,65,0.1),rgba(0,255,65,0.04))",
          border:"1px solid rgba(0,255,65,0.3)", borderRadius:"16px", padding:"28px 24px",
          textAlign:"center", marginTop:"16px"
        }},
          React.createElement("div", { style:{ fontSize:"28px", marginBottom:"12px" } }, "🤖"),
          React.createElement("h3", { style:{ fontFamily:"'Bodoni Moda',serif", fontSize:"22px", color:"#00FF41",
            fontWeight:"700", marginBottom:"8px" } }, locked.length+" matchs supplémentaires"),
          React.createElement("p", { style:{ color:"#888", fontSize:"14px", lineHeight:"1.7", marginBottom:"20px" } },
            "Débloquez les "+locked.length+" matchs restants analysés par vos 5 agents IA.",
            React.createElement("br"),
            "Vote de chaque IA, note de confiance, BTTS, Over 2.5, résultat final — tout en temps réel."
          ),
          React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"20px" } },
            [
              "✓ "+PREMIUM_LIMIT+" matchs analysés/jour",
              "✓ 5 agents IA : Claude, GPT, Gemini...",
              "✓ Value bets détectés automatiquement",
              "✓ Alertes Telegram en temps réel",
            ].map(function(f,i) {
              return React.createElement("div", { key:i,
                style:{ fontSize:"12px", color:"#00FF41", background:"rgba(0,255,65,0.06)",
                        borderRadius:"8px", padding:"8px 10px", textAlign:"left" }
              }, f);
            })
          ),
          React.createElement("a", {
            href:"https://t.me/touslesmatchs_bot",
            target:"_blank",
            style:{ display:"block", padding:"16px", background:"linear-gradient(135deg,#00FF41,#E8C14A)",
              borderRadius:"12px", color:"#050505", fontWeight:"800", fontSize:"15px",
              textDecoration:"none", letterSpacing:"0.05em" }
          }, "🚀 Passer Premium — 4,90€/mois")
        )
      )
    )
  );
}
