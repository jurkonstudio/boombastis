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
})();
