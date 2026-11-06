// Home / hub: search, category chips and favorites. Cards are already in the HTML (crawlable); this only filters them.
(function(){var F=document.getElementById("finder");if(!F)return;
var cards=[].slice.call(document.querySelectorAll(".tcard")),chips=[].slice.call(document.querySelectorAll(".chip")),
q=document.getElementById("q"),cnt=document.getElementById("count"),emp=document.getElementById("empty"),emsg=document.getElementById("emptyMsg"),
fo=document.getElementById("favOnly"),S={cat:"all",q:"",fav:false},KEY="bb-fav",favs=load(),d0=emsg.textContent;
function load(){try{var a=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(a)?a:[]}catch(e){return[]}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(favs))}catch(e){}}
function paint(c){var on=favs.indexOf(c.dataset.slug)>-1,b=c.querySelector(".fav");b.setAttribute("aria-pressed",on);b.setAttribute("aria-label",on?b.dataset.rem:b.dataset.add)}
function render(){var n=0,t=S.q.trim().toLowerCase();
cards.forEach(function(c){var ok=(S.cat==="all"||c.dataset.cats.split(" ").indexOf(S.cat)>-1)&&(!t||c.dataset.text.indexOf(t)>-1)&&(!S.fav||favs.indexOf(c.dataset.slug)>-1);c.hidden=!ok;if(ok)n++});
cnt.textContent=n+" "+(n===1?F.dataset.lblOne:F.dataset.lblMany);
emp.hidden=n>0;emsg.textContent=S.fav&&!favs.length?F.dataset.nofav:d0}
cards.forEach(paint);
document.querySelector(".grid").addEventListener("click",function(e){var b=e.target.closest(".fav");if(!b)return;var c=b.closest(".tcard"),s=c.dataset.slug,i=favs.indexOf(s);
if(i>-1)favs.splice(i,1);else favs.push(s);save();paint(c);if(S.fav)render()});
chips.forEach(function(b){b.addEventListener("click",function(){S.cat=b.dataset.cat;chips.forEach(function(x){x.setAttribute("aria-pressed",x===b)});render()})});
q.addEventListener("input",function(){S.q=q.value;try{history.replaceState(null,"",S.q?"?q="+encodeURIComponent(S.q):location.pathname)}catch(e){}render()});
fo.addEventListener("click",function(){S.fav=!S.fav;fo.setAttribute("aria-pressed",S.fav);render()});
document.getElementById("reset").addEventListener("click",function(){S={cat:"all",q:"",fav:false};q.value="";fo.setAttribute("aria-pressed","false");chips.forEach(function(x){x.setAttribute("aria-pressed",x.dataset.cat==="all")});render()});
F.addEventListener("submit",function(e){e.preventDefault();document.getElementById("tools").scrollIntoView()});
document.addEventListener("keydown",function(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();q.focus()}});
var p=new URLSearchParams(location.search).get("q");if(p){q.value=p;S.q=p}render();
/* clean URL: no #tools in the address bar */
function clean(){try{history.replaceState(null,"",location.pathname+location.search)}catch(e){}}
if(location.hash==="#tools")clean();
document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest('a[href$="#tools"]');if(!a)return;var t=document.getElementById("tools");if(!t)return;e.preventDefault();t.scrollIntoView();clean()});
})();

/* Typing line in the hero: cycles through tasks; click one to search for it. */
(function(){var B=document.getElementById("twWord");if(!B)return;
var q=document.getElementById("q"),TX=B.querySelector(".tw-txt"),items=[];
try{items=JSON.parse(B.dataset.items||"[]")}catch(e){}
if(!items.length)return;
var kw=items[0][1],reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
async function loop(){
  if(reduce){TX.textContent=items[0][0];return}
  for(var i=0;;i++){
    var it=items[i%items.length];kw=it[1];
    for(var n=1;n<=it[0].length;n++){TX.textContent=it[0].slice(0,n);await sleep(70)}
    await sleep(1600);
    for(var m=it[0].length;m>=0;m--){TX.textContent=it[0].slice(0,m);await sleep(35)}
    await sleep(300);
  }
}
loop();
B.addEventListener("click",function(){if(!q)return;q.value=kw;q.dispatchEvent(new Event("input"));document.getElementById("tools").scrollIntoView()});
})();

/* Alive: pals follow the pointer and hop while you type; the expert card follows the typing line; cards open a detail dialog. */
(function(){var F=document.getElementById("finder");if(!F)return;
var id=document.documentElement.lang==="id",pals=document.querySelector(".pals"),eyes=[].slice.call(document.querySelectorAll(".pal")),
reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
function look(x,y){eyes.forEach(function(p){var r=p.getBoundingClientRect(),dx=x-(r.left+r.width/2),dy=y-(r.top+r.height/2),d=Math.hypot(dx,dy)||1,k=Math.min(4,d/40);
p.style.setProperty("--ex",(dx/d*k)+"px");p.style.setProperty("--ey",(dy/d*k)+"px")})}
if(!reduce){addEventListener("pointermove",function(e){look(e.clientX,e.clientY)},{passive:true});addEventListener("touchmove",function(e){var t=e.touches[0];if(t)look(t.clientX,t.clientY)},{passive:true})}
var q=document.getElementById("q"),ht;
q.addEventListener("input",function(){if(reduce||!pals)return;pals.classList.remove("hop");void pals.offsetWidth;pals.classList.add("hop");clearTimeout(ht);ht=setTimeout(function(){pals.classList.remove("hop")},600)});
var cards=[].slice.call(document.querySelectorAll(".tcard")),feat=document.getElementById("feat"),also=document.getElementById("also");
function setFeat(kw){var c=cards.filter(function(x){return x.dataset.text.indexOf(kw)>-1})[0];if(!c||!feat||feat.dataset.s===c.dataset.slug)return;feat.dataset.s=c.dataset.slug;
feat.style.setProperty("--g1",c.style.getPropertyValue("--g1"));feat.style.setProperty("--g2",c.style.getPropertyValue("--g2"));
feat.querySelector(".feat-ic").innerHTML=c.querySelector(".tc-ic").innerHTML;
feat.querySelector(".feat-txt b").textContent=c.querySelector(".tc-name").textContent;
feat.querySelector(".feat-txt span").textContent=c.querySelector(".tc-sub").textContent;
feat.querySelector("a.tc-btn").href=c.dataset.slug;
var cat=c.dataset.cats.split(" ")[0],rel=cards.filter(function(x){return x!==c&&x.dataset.cats.split(" ")[0]===cat}).slice(0,2);
also.innerHTML="";if(rel.length){also.append((id?"Cocok juga untuk ini: ":"Also good for this: "));rel.forEach(function(r,i){var a=document.createElement("a");a.href=r.dataset.slug;a.textContent=r.querySelector(".tc-name").textContent;also.append(a);if(i<rel.length-1)also.append(", ")})}
feat.classList.remove("swap");void feat.offsetWidth;feat.classList.add("swap")}
var tw=document.getElementById("twWord"),tx=tw&&tw.querySelector(".tw-txt"),last="";
if(tw&&tx&&!reduce){try{var items=JSON.parse(tw.dataset.items||"[]");new MutationObserver(function(){var m=items.filter(function(i){return i[0]===tx.textContent})[0];if(m&&m[1]!==last){last=m[1];setFeat(m[1])}}).observe(tx,{childList:true,characterData:true,subtree:true})}catch(e){}}
var dlg=document.getElementById("dlg");if(!dlg||!dlg.showModal)return;
document.querySelector(".grid").addEventListener("click",function(e){var a=e.target.closest(".tc-link");if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;e.preventDefault();var c=a.closest(".tcard");
dlg.style.setProperty("--g1",c.style.getPropertyValue("--g1"));dlg.style.setProperty("--g2",c.style.getPropertyValue("--g2"));
document.getElementById("dlgIc").innerHTML=c.querySelector(".tc-ic").innerHTML;document.getElementById("dlgName").textContent=c.querySelector(".tc-name").textContent;
document.getElementById("dlgSum").textContent=c.querySelector(".tc-sub").textContent;document.getElementById("dlgCode").textContent=c.querySelector(".tc-meta").textContent;
document.getElementById("dlgOpen").href=c.dataset.slug;dlg.dataset.slug=c.dataset.slug;dlg.showModal()});
document.getElementById("dlgX").addEventListener("click",function(){dlg.close()});
dlg.addEventListener("click",function(e){if(e.target===dlg)dlg.close()});
var cp=document.getElementById("dlgCopy"),t0=cp.textContent;cp.addEventListener("click",function(){var u=location.origin+dlg.dataset.slug;(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).catch(function(){}).then(function(){cp.textContent=cp.dataset.ok;setTimeout(function(){cp.textContent=t0},1500)})});
})();
