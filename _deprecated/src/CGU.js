import React from "react";

export default function CGU({setPage, footer, bandeauLegal}) {
  var s = {
    wrap: {background:"linear-gradient(180deg,#131826 0%,#0b1018 500px,#080c14 100%)",minHeight:"100vh",fontFamily:"Georgia,serif",color:"#e8e0d0"},
    inner: {maxWidth:"800px",margin:"0 auto",padding:"40px 30px"},
    h1: {color:"#d4af37",fontSize:"20px",letterSpacing:"3px",marginBottom:"6px",fontWeight:"bold"},
    h2: {color:"#d4af37",fontSize:"13px",letterSpacing:"2px",marginTop:"32px",marginBottom:"10px",fontWeight:"bold"},
    p: {color:"#888",fontSize:"13px",lineHeight:"1.8",marginBottom:"12px"},
    li: {color:"#888",fontSize:"13px",lineHeight:"1.8",marginBottom:"6px"},
    back: {background:"transparent",border:"1px solid rgba(212,175,55,0.3)",color:"#d4af37",padding:"8px 16px",borderRadius:"4px",cursor:"pointer",fontSize:"12px",fontFamily:"Georgia,serif",marginBottom:"30px"},
    bar: {borderTop:"1px solid rgba(212,175,55,0.1)",marginTop:"20px",paddingTop:"12px"},
  };

  return React.createElement("div", {style:s.wrap},
    React.createElement("div", {style:{background:"rgba(8,12,20,0.98)",borderBottom:"1px solid rgba(212,175,55,0.2)",padding:"16px 30px"}},
      React.createElement("div", {style:{cursor:"pointer",display:"inline-block"},onClick:function(){setPage("home");}},
        React.createElement("div", {style:{fontSize:"18px",fontWeight:"bold",color:"#d4af37",letterSpacing:"3px"}}, "TOUSLESMATCHS"),
        React.createElement("div", {style:{fontSize:"9px",color:"#555",letterSpacing:"3px"}}, "ANALYSE - INTELLIGENCE - RESULTATS")
      )
    ),
    React.createElement("div", {style:s.inner},
      React.createElement("button", {style:s.back, onClick:function(){setPage("home");}}, "← Retour"),
      React.createElement("h1", {style:s.h1}, "CONDITIONS GENERALES D'UTILISATION"),
      React.createElement("p", {style:{color:"#555",fontSize:"11px",marginBottom:"30px"}}, "Derniere mise a jour : mai 2026"),

      React.createElement("h2", {style:s.h2}, "1. OBJET DU SITE"),
      React.createElement("p", {style:s.p}, "TousLesMatchs.com est un site de conseils en paris sportifs propulse par intelligence artificielle. Le site publie quotidiennement des analyses et recommandations de paris sportifs (ci-apres les \"Picks\") a titre strictement informatif."),
      React.createElement("p", {style:s.p}, "Le site ne constitue pas un operateur de jeux d'argent et ne collecte aucune mise. Les paris sont effectues directement par les utilisateurs aupres des bookmakers partenaires agrees par l'Autorite Nationale des Jeux (ANJ)."),

      React.createElement("h2", {style:s.h2}, "2. ACCEPTATION DES CONDITIONS"),
      React.createElement("p", {style:s.p}, "L'acces et l'utilisation du site impliquent l'acceptation pleine et entiere des presentes CGU. Si vous n'acceptez pas ces conditions, veuillez cesser d'utiliser le site."),

      React.createElement("h2", {style:s.h2}, "3. CONDITIONS D'ACCES"),
      React.createElement("ul", {style:{paddingLeft:"20px",marginBottom:"12px"}},
        React.createElement("li", {style:s.li}, "Etre age de 18 ans minimum"),
        React.createElement("li", {style:s.li}, "Etre resident en France metropolitaine ou dans un territoire ou les paris sportifs sont legalement autorises"),
        React.createElement("li", {style:s.li}, "Ne pas etre inscrit au fichier des interdits de jeux de l'ANJ"),
        React.createElement("li", {style:s.li}, "Accepter de jouer de maniere responsable")
      ),

      React.createElement("h2", {style:s.h2}, "4. SERVICE GRATUIT ET LIENS D'AFFILIATION"),
      React.createElement("p", {style:s.p}, "L'acces aux Picks et aux contenus du site est entierement gratuit. TousLesMatchs.com est remunere via des liens d'affiliation avec des bookmakers agrees ANJ. Lorsque vous vous inscrivez chez un bookmaker via un lien present sur ce site, TousLesMatchs.com peut percevoir une commission de la part de ce bookmaker."),
      React.createElement("p", {style:s.p}, "Cette remuneration n'influence pas l'independance editoriale des conseils. Les analyses et Picks sont etablis de maniere independante selon les criteres de notre algorithme."),

      React.createElement("h2", {style:s.h2}, "5. LIMITATION DE RESPONSABILITE"),
      React.createElement("p", {style:s.p}, "Les Picks publies sur TousLesMatchs.com sont fournis a titre indicatif uniquement. Ils ne constituent pas des conseils financiers, des garanties de gains, ni des incitations a parier."),
      React.createElement("p", {style:s.p}, "TousLesMatchs.com ne saurait etre tenu responsable des pertes financieres subies par les utilisateurs suite aux paris effectues sur la base des conseils publies sur le site. Tout pari engage la seule responsabilite du parieur."),
      React.createElement("p", {style:s.p}, "Les performances passees ne garantissent pas les resultats futurs."),

      React.createElement("h2", {style:s.h2}, "6. PROPRIETE INTELLECTUELLE"),
      React.createElement("p", {style:s.p}, "L'ensemble des contenus du site (textes, analyses, algorithmes, design, logo) est la propriete exclusive de TousLesMatchs.com et est protege par le droit de la propriete intellectuelle. Toute reproduction, meme partielle, est interdite sans autorisation prealable ecrite."),

      React.createElement("h2", {style:s.h2}, "7. DONNEES PERSONNELLES ET RGPD"),
      React.createElement("p", {style:s.p}, "TousLesMatchs.com traite vos donnees personnelles dans le respect du Reglement General sur la Protection des Donnees (RGPD). Pour toute information, consultez notre Politique de Confidentialite."),

      React.createElement("h2", {style:s.h2}, "8. JEU RESPONSABLE"),
      React.createElement("p", {style:s.p}, "Le jeu excessif ou pathologique est un trouble reconnu. Si vous pensez avoir un probleme avec le jeu, contactez :"),
      React.createElement("ul", {style:{paddingLeft:"20px",marginBottom:"12px"}},
        React.createElement("li", {style:s.li}, "Joueurs Info Service : 09 74 75 13 13 (appel non surtaxe, 7j/7, 8h-2h)"),
        React.createElement("li", {style:s.li}, "Site : joueurs-info-service.fr"),
        React.createElement("li", {style:s.li}, "Auto-exclusion ANJ disponible sur tous les sites de jeux agrees")
      ),

      React.createElement("h2", {style:s.h2}, "9. DROIT APPLICABLE"),
      React.createElement("p", {style:s.p}, "Les presentes CGU sont soumises au droit francais. Tout litige sera soumis a la competence exclusive des tribunaux francais."),

      React.createElement("div", {style:s.bar},
        React.createElement("p", {style:{color:"#333",fontSize:"11px",textAlign:"center"}}, "© 2026 TousLesMatchs.com — Tous droits reserves")
      )
    ),
    footer,
    bandeauLegal
  );
}
