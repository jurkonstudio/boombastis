// Shared UI: theme (system / light / dark) and mobile menu.
(function(){var K="bb-theme",R=document.documentElement,tb=document.getElementById("themeBtn"),mb=document.getElementById("menuBtn"),nav=document.getElementById("mainNav"),O=["system","light","dark"];
function get(){try{var v=localStorage.getItem(K);return v==="light"||v==="dark"?v:"system"}catch(e){return"system"}}
function paint(m){if(!tb)return;var i=O.indexOf(m),n=tb.dataset.names.split("|");
tb.querySelectorAll(".ti").forEach(function(s){s.hidden=+s.dataset.m!==i});
var l=tb.dataset.label+": "+n[i];tb.setAttribute("aria-label",l);tb.title=l}
function set(m){try{if(m==="system")localStorage.removeItem(K);else localStorage.setItem(K,m)}catch(e){}
if(m==="system")R.removeAttribute("data-theme");else R.setAttribute("data-theme",m);paint(m)}
if(tb){paint(get());tb.addEventListener("click",function(){set(O[(O.indexOf(get())+1)%3])})}
function close(){nav.classList.remove("open");mb.setAttribute("aria-expanded","false")}
if(mb&&nav){mb.addEventListener("click",function(){var o=nav.classList.toggle("open");mb.setAttribute("aria-expanded",o)});
nav.addEventListener("click",function(e){if(e.target.closest("a"))close()});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&nav.classList.contains("open")){close();mb.focus()}})}
})();
