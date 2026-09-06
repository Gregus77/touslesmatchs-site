#!/usr/bin/env node
"use strict";
const fs=require("fs"),vm=require("vm");
const listeners={};
const document={
  title:"Live IA — TousLesMatchs",readyState:"loading",body:{},documentElement:{lang:"fr"},
  addEventListener:(n,f)=>{listeners[n]=f;},getElementById:()=>null,querySelector:()=>null,
  querySelectorAll:()=>[],createTreeWalker:()=>({nextNode:()=>null}),createElement:()=>({setAttribute(){},appendChild(){},addEventListener(){},style:{}}),head:{appendChild(){}},
};
const context={document,window:{},localStorage:{getItem:()=>"fr",setItem(){}},location:{pathname:"/live-ia.html",search:""},NodeFilter:{SHOW_TEXT:4},MutationObserver:function(){this.observe=()=>{};},Set,WeakMap,WeakSet,URLSearchParams,console};
context.window=context;context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("public/js/i18n-auto.js","utf8"),context);
const tr=context.TLMI18nAuto.translate;
const expected={
  en:["Verdict","Signal votes","Council Under 2.5","validated AIs","Analysis window closed"],
  es:["Veredicto","Votos de la señal","Menos de 2,5 del Consejo","IA validadas","Ventana de análisis cerrada"],
  pt:["Veredito","Votos do sinal","Menos de 2,5 do Conselho","IA validadas","Janela de análise encerrada"],
  ru:["Вердикт","Голоса по сигналу","Тотал меньше 2,5 Совета","ИИ с ответом","Окно анализа закрыто"],
  zh:["结论","信号投票","评议会小于 2.5 球","已响应 AI","分析窗口已关闭"]
};
const source=["Verdict","Votes du signal","Under 2,5 du Concile","IA validées","Fenêtre d’analyse terminée"];
for(const [lang,want] of Object.entries(expected)){
  const got=source.map(x=>tr(x,lang));
  if(JSON.stringify(got)!==JSON.stringify(want))throw new Error(`${lang}: ${JSON.stringify(got)}`);
}
if(tr("06 septembre 2026","en")!=="September 06, 2026")throw new Error("English date not translated");
if(tr("4 Over · 1 Under","ru")!=="4 Больше · 1 Меньше")throw new Error("Dynamic tally not translated");
console.log("OK: FR/EN/ES/PT/RU/ZH static and dynamic Council labels");
