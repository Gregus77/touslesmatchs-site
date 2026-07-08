import React from "react";

export default function MentionsLegales({setPage, footer, bandeauLegal}) {
  var s = {
    wrap: {background:"linear-gradient(180deg,#131826 0%,#0b1018 500px,#080c14 100%)",minHeight:"100vh",fontFamily:"Georgia,serif",color:"#e8e0d0"},
    inner: {maxWidth:"800px",margin:"0 auto",padding:"40px 30px"},
    h1: {color:"#d4af37",fontSize:"20px",letterSpacing:"3px",marginBottom:"6px",fontWeight:"bold"},
    h2: {color:"#d4af37",fontSize:"13px",letterSpacing:"2px",marginTop:"32px",marginBottom:"10px",fontWeight:"bold"},
    p: {color:"#888",fontSize:"13px",lineHeight:"1.8",marginBottom:"8px"},
    box: {background:"rgba(212,175,55,0.04)",border:"1px solid rgba(212,175,55,0.15)",borderRadius:"8px",padding:"16px 20px",marginBottom:"16px"},
    label: {color:"#555",fontSize:"11px",letterSpacing:"2px",marginBottom:"4px"},
    val: {color:"#ddd",fontSize:"13px"},
    todo: {color:"#ff8c00",fontSize:"12px",fontStyle:"italic"},
    back: {background:"transparent",border:"1px solid rgba(212,175,55,0.3)",color:"#d4af37",padding:"8px 16px",borderRadius:"4px",cursor:"pointer",fontSize:"12px",fontFamily:"Georgia,serif",marginBottom:"30px"},
  };

  function row(label, value, todo) {
    return React.createElement("div", {style:{marginBottom:"12px"}},
      React.createElement("div", {style:s.label}, label),
      todo
        ? React.createElement("div", {style:s.todo}, "[ " + value + " — A COMPLETER ]")
        : React.createElement("div", {style:s.val}, value)
    );
  }

  return React.createElement("div", {style:s.wrap},
    React.createElement("div", {style:{background:"rgba(8,12,20,0.98)",borderBottom:"1px solid rgba(212,175,55,0.2)",padding:"16px 30px"}},
      React.createElement("div", {style:{cursor:"pointer",display:"inline-block"},onClick:function(){setPage("home");}},
        React.createElement("div", {style:{fontSize:"18px",fontWeight:"bold",color:"#d4af37",letterSpacing:"3px"}}, "TOUSLESMATCHS"),
        React.createElement("div", {style:{fontSize:"9px",color:"#555",letterSpacing:"3px"}}, "ANALYSE - INTELLIGENCE - RESULTATS")
      )
    ),
    React.createElement("div", {style:s.inner},
      React.createElement("button", {style:s.back, onClick:function(){setPage("home");}}, "← Retour"),
      React.createElement("h1", {style:s.h1}, "MENTIONS LEGALES"),
      React.createElement("p", {style:{color:"#555",fontSize:"11px",marginBottom:"30px"}}, "Conformement a la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'economie numerique."),

      React.createElement("h2", {style:s.h2}, "EDITEUR DU SITE"),
      React.createElement("div", {style:s.box},
        row("NOM ET PRENOM", "Greg Martin"),
        row("ADRESSE", "75000 Paris, France"),
        row("EMAIL", "contact@touslesmatchs.com"),
        row("SIREN / SIRET", "En cours d'immatriculation"),
        row("FORME JURIDIQUE", "Entreprise individuelle"),
        row("SITE WEB", "touslesmatchs.com")
      ),

      React.createElement("h2", {style:s.h2}, "DIRECTEUR DE LA PUBLICATION"),
      React.createElement("div", {style:s.box},
        row("NOM ET PRENOM", "Greg Martin")
      ),

      React.createElement("h2", {style:s.h2}, "HEBERGEUR"),
      React.createElement("div", {style:s.box},
        row("SOCIETE", "Vercel Inc."),
        row("ADRESSE", "340 Pine Street, Suite 701 — San Francisco, CA 94104 — USA"),
        row("SITE WEB", "vercel.com")
      ),

      React.createElement("h2", {style:s.h2}, "PROPRIETE INTELLECTUELLE"),
      React.createElement("p", {style:s.p}, "L'ensemble des contenus du site TousLesMatchs.com (textes, analyses, algorithmes, design, structure, logo, marque) est la propriete exclusive de l'editeur et est protege par les lois francaises et internationales relatives a la propriete intellectuelle."),
      React.createElement("p", {style:s.p}, "Toute reproduction, representation, modification, publication ou adaptation de tout ou partie des elements du site, quel que soit le moyen ou le procede utilise, est interdite sans autorisation ecrite prealable."),

      React.createElement("h2", {style:s.h2}, "REGLEMENTATION DES JEUX"),
      React.createElement("p", {style:s.p}, "TousLesMatchs.com est un site de conseils en paris sportifs. Les bookmakers presentes sur ce site sont tous agrees par l'Autorite Nationale des Jeux (ANJ). Jouer comporte des risques : endettement, isolement, dependance. Pour etre aide, appelez le 09 74 75 13 13 (appel non surtaxe)."),

      React.createElement("div", {style:{borderTop:"1px solid rgba(212,175,55,0.1)",marginTop:"20px",paddingTop:"12px"}},
        React.createElement("p", {style:{color:"#333",fontSize:"11px",textAlign:"center"}}, "© 2026 TousLesMatchs.com — Tous droits reserves")
      )
    ),
    footer,
    bandeauLegal
  );
}
