import React from "react";

export default function Confidentialite({setPage, footer, bandeauLegal}) {
  var s = {
    wrap: {background:"linear-gradient(180deg,#131826 0%,#0b1018 500px,#080c14 100%)",minHeight:"100vh",fontFamily:"Georgia,serif",color:"#e8e0d0"},
    inner: {maxWidth:"800px",margin:"0 auto",padding:"40px 30px"},
    h1: {color:"#d4af37",fontSize:"20px",letterSpacing:"3px",marginBottom:"6px",fontWeight:"bold"},
    h2: {color:"#d4af37",fontSize:"13px",letterSpacing:"2px",marginTop:"32px",marginBottom:"10px",fontWeight:"bold"},
    p: {color:"#888",fontSize:"13px",lineHeight:"1.8",marginBottom:"12px"},
    li: {color:"#888",fontSize:"13px",lineHeight:"1.8",marginBottom:"6px"},
    back: {background:"transparent",border:"1px solid rgba(212,175,55,0.3)",color:"#d4af37",padding:"8px 16px",borderRadius:"4px",cursor:"pointer",fontSize:"12px",fontFamily:"Georgia,serif",marginBottom:"30px"},
    box: {background:"rgba(212,175,55,0.04)",border:"1px solid rgba(212,175,55,0.15)",borderRadius:"8px",padding:"16px 20px",marginBottom:"16px"},
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
      React.createElement("h1", {style:s.h1}, "POLITIQUE DE CONFIDENTIALITE"),
      React.createElement("p", {style:{color:"#555",fontSize:"11px",marginBottom:"30px"}}, "Derniere mise a jour : mai 2026 — Conforme au RGPD (Reglement UE 2016/679)"),

      React.createElement("h2", {style:s.h2}, "1. RESPONSABLE DU TRAITEMENT"),
      React.createElement("p", {style:s.p}, "Le responsable du traitement des donnees personnelles collectees sur TousLesMatchs.com est l'editeur du site (voir Mentions Legales). Pour toute question relative a vos donnees personnelles, contactez-nous via l'adresse email indiquee dans les Mentions Legales."),

      React.createElement("h2", {style:s.h2}, "2. DONNEES COLLECTEES"),
      React.createElement("p", {style:s.p}, "TousLesMatchs.com peut collecter les donnees suivantes :"),
      React.createElement("div", {style:s.box},
        React.createElement("p", {style:{color:"#d4af37",fontSize:"12px",fontWeight:"bold",margin:"0 0 8px"}}, "Newsletter (collecte via Brevo)"),
        React.createElement("ul", {style:{paddingLeft:"20px",margin:0}},
          React.createElement("li", {style:s.li}, "Adresse email"),
          React.createElement("li", {style:s.li}, "Date d'inscription"),
          React.createElement("li", {style:s.li}, "Historique d'ouverture des emails (statistiques agregees)")
        )
      ),
      React.createElement("div", {style:s.box},
        React.createElement("p", {style:{color:"#d4af37",fontSize:"12px",fontWeight:"bold",margin:"0 0 8px"}}, "Navigation (donnees techniques)"),
        React.createElement("ul", {style:{paddingLeft:"20px",margin:0}},
          React.createElement("li", {style:s.li}, "Adresse IP (anonymisee)"),
          React.createElement("li", {style:s.li}, "Type de navigateur et systeme d'exploitation"),
          React.createElement("li", {style:s.li}, "Pages visitees et duree de visite (statistiques anonymes uniquement)")
        )
      ),

      React.createElement("h2", {style:s.h2}, "3. FINALITES DU TRAITEMENT"),
      React.createElement("ul", {style:{paddingLeft:"20px",marginBottom:"12px"}},
        React.createElement("li", {style:s.li}, "Envoi de la newsletter quotidienne avec le Pick du Jour"),
        React.createElement("li", {style:s.li}, "Amelioration des contenus et fonctionnalites du site"),
        React.createElement("li", {style:s.li}, "Conformite aux obligations legales")
      ),

      React.createElement("h2", {style:s.h2}, "4. DUREE DE CONSERVATION"),
      React.createElement("p", {style:s.p}, "Vos donnees d'email sont conservees tant que vous etes inscrit a la newsletter. Elles sont supprimees dans les 30 jours suivant votre desinscription."),
      React.createElement("p", {style:s.p}, "Les donnees de navigation sont conservees 13 mois maximum, conformement aux recommandations de la CNIL."),

      React.createElement("h2", {style:s.h2}, "5. COOKIES"),
      React.createElement("p", {style:s.p}, "TousLesMatchs.com n'utilise pas de cookies de tracking publicitaire ni de cookies tiers a des fins de ciblage. Le site peut utiliser des cookies techniques strictement necessaires au fonctionnement (ex : preferences de navigation). Ces cookies ne necessitent pas de consentement prealable."),

      React.createElement("h2", {style:s.h2}, "6. PARTAGE DES DONNEES"),
      React.createElement("p", {style:s.p}, "TousLesMatchs.com ne vend, ne loue, ni ne partage vos donnees personnelles avec des tiers a des fins commerciales. Les donnees d'email sont hebergees chez Brevo (anciennement Sendinblue), sous-traitant conforme au RGPD."),
      React.createElement("p", {style:s.p}, "Les liens vers les bookmakers partenaires sont des liens d'affiliation. TousLesMatchs.com ne transmet aucune donnee personnelle a ces bookmakers. Leurs propres politiques de confidentialite s'appliquent des lors que vous visitez leurs sites."),

      React.createElement("h2", {style:s.h2}, "7. VOS DROITS"),
      React.createElement("p", {style:s.p}, "Conformement au RGPD, vous disposez des droits suivants concernant vos donnees personnelles :"),
      React.createElement("ul", {style:{paddingLeft:"20px",marginBottom:"12px"}},
        React.createElement("li", {style:s.li}, "Droit d'acces : obtenir une copie de vos donnees"),
        React.createElement("li", {style:s.li}, "Droit de rectification : corriger des donnees inexactes"),
        React.createElement("li", {style:s.li}, "Droit a l'effacement : demander la suppression de vos donnees"),
        React.createElement("li", {style:s.li}, "Droit d'opposition : vous opposer au traitement de vos donnees"),
        React.createElement("li", {style:s.li}, "Droit a la portabilite : recevoir vos donnees dans un format lisible"),
        React.createElement("li", {style:s.li}, "Droit de desinscription : se desabonner de la newsletter a tout moment via le lien present dans chaque email")
      ),
      React.createElement("p", {style:s.p}, "Pour exercer ces droits, contactez-nous via l'adresse email indiquee dans les Mentions Legales. Nous repondrons dans un delai maximum de 30 jours."),
      React.createElement("p", {style:s.p}, "En cas de litige, vous pouvez introduire une reclamation aupres de la CNIL (cnil.fr)."),

      React.createElement("h2", {style:s.h2}, "8. SECURITE"),
      React.createElement("p", {style:s.p}, "TousLesMatchs.com met en oeuvre des mesures techniques et organisationnelles appropriees pour proteger vos donnees contre tout acces non autorise, divulgation, alteration ou destruction."),

      React.createElement("div", {style:{borderTop:"1px solid rgba(212,175,55,0.1)",marginTop:"20px",paddingTop:"12px"}},
        React.createElement("p", {style:{color:"#333",fontSize:"11px",textAlign:"center"}}, "© 2026 TousLesMatchs.com — Tous droits reserves")
      )
    ),
    footer,
    bandeauLegal
  );
}
