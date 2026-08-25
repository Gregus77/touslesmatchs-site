(function(){var K="_hfw";if(window[K])return;window[K]=true;
var SID="s_"+Date.now()+"_"+Math.random().toString(36).slice(2,8);
function a(){
if(document.getElementById("hfw"))return;
var d=document.createElement("div");d.id="hfw";
d.innerHTML='<style>#hfw{position:fixed;bottom:16px;right:16px;z-index:99999999;display:flex;flex-direction:column;align-items:center;gap:16px;font-family:system-ui,sans-serif}#hfw button,#hfw a{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;font-weight:700;display:flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 4px 20px rgba(0,0,0,0.3)}#hcq{background:linear-gradient(135deg,#6366f1,#22d3ee);color:#fff;font-size:28px}#htt{background:linear-gradient(135deg,#ff0050,#8b5cf6);color:#fff;font-size:13px}#htg{background:#0088cc;color:#fff;font-size:22px}#hcp{position:fixed;bottom:100px;right:16px;z-index:99999999;width:340px;max-height:470px;background:#1a1a2e;border:1px solid #2d2d4e;border-radius:16px;display:none;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.5);color:#e2e8f0;font-size:13px}#hch{padding:14px 16px;background:linear-gradient(135deg,#6366f1,#22d3ee);color:#fff;font-weight:700;font-size:14px;display:flex;justify-content:space-between}#hch span{cursor:pointer;opacity:0.7}#hcm{padding:12px;overflow-y:auto;max-height:330px}#hcm .b{background:#2d2d4e;padding:10px 14px;border-radius:12px;color:#e2e8f0;margin-bottom:8px;line-height:1.4;white-space:pre-wrap}#hcm .u{background:#6366f1;padding:10px 14px;border-radius:12px;color:#fff;margin-bottom:8px;text-align:right}#hci{display:flex;border-top:1px solid #2d2d4e;padding:8px}#hci input{flex:1;background:#0f0f23;border:1px solid #2d2d4e;border-radius:8px;padding:10px 12px;color:#e2e8f0;font-size:13px;outline:none}#hci button{background:#6366f1;color:#fff;border:none;border-radius:8px;padding:10px 14px;margin-left:6px;cursor:pointer;font-weight:700}</style><div id="hfw"><button id="hcq">&#128172;</button><a id="htt" href="https://www.tiktok.com/@touslesmatchs.com" target="_blank">TikTok</a><a id="htg" href="https://t.me/+qFnIuKg2ZhdlMmY8" target="_blank">&#128172;</a></div><div id="hcp"><div id="hch"><span>&#129302; Assistant IA</span><span id="hcx_">&#10005;</span></div><div id="hcm"><div class="b">Bonjour ! Je suis l assistant TousLesMatchs. Posez votre question sur les abonnements, le Live IA, les pronostics ou Telegram.</div></div><div id="hci"><input id="hciq" placeholder="Votre question..."><button id="hcis">OK</button></div></div>';
document.documentElement.appendChild(d);
var b=document.getElementById("hcq"),p=document.getElementById("hcp"),m=document.getElementById("hcm"),q=document.getElementById("hciq"),g=document.getElementById("hcis"),x=document.getElementById("hcx_");
if(!b||!p||!m||!q||!g||!x)return;
b.onclick=function(){p.style.display="flex";this.style.display="none";};
x.onclick=function(){p.style.display="none";b.style.display="flex";};
g.onclick=function(){
var v=q.value.trim();if(!v)return;
m.innerHTML+='<div class="u">'+v.replace(/</g,"&lt;")+'</div>';
q.value="";m.scrollTop=m.scrollHeight;
m.innerHTML+='<div class="b" style="opacity:0.7">&#128221; Reflexion en cours...</div>';
var r=new XMLHttpRequest();
r.open("POST","/api/chatbot/ask",true);
r.setRequestHeader("Content-Type","application/json");
r.onreadystatechange=function(){if(r.readyState==4){m.removeChild(m.lastChild);if(r.status==200){try{var j=JSON.parse(r.responseText);m.innerHTML+='<div class="b">'+(j.ok?j.answer.replace(/\\n/g,"<br>"):"Erreur")+'</div>';}catch(e){m.innerHTML+='<div class="b">Erreur</div>';}}else{m.innerHTML+='<div class="b">Erreur '+r.status+'</div>';}m.scrollTop=m.scrollHeight;}};
r.onerror=function(){m.removeChild(m.lastChild);m.innerHTML+='<div class="b">Erreur reseau</div>';};
r.send(JSON.stringify({question:v, session:SID}));
};
q.addEventListener("keydown",function(e){if(e.key==="Enter")g.click();});
}
a();
new MutationObserver(function(){if(!document.getElementById("hfw")){window[K]=false;a();}}).observe(document.documentElement,{childList:true,subtree:true});
setInterval(function(){if(!document.getElementById("hfw")){window[K]=false;a();}},2000);
})();
