var $=function(i){return document.getElementById(i)};
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function row(p,k,v){var d=el("div","row");d.appendChild(el("span",null,k));d.appendChild(el("b",null,v));p.appendChild(d)}
// ---- My IP
async function myip(){var o=$("ipout");o.textContent="Looking up…";
try{var j=await (await fetch("https://api64.ipify.org?format=json")).json(),ip=j.ip;o.textContent="";row(o,"IP address",ip);
try{var g=await (await fetch("https://ipwho.is/"+encodeURIComponent(ip))).json();
if(g.success){row(o,"Country",g.country||"-");row(o,"City",g.city||"-");row(o,"ISP",(g.connection&&(g.connection.isp||g.connection.org))||"-")}}catch(e){}
}catch(e){o.textContent="Could not detect your IP. An ad blocker or network filter may be blocking the lookup."}}
// ---- DNS lookup (DNS over HTTPS)
var TYPES=["A","AAAA","CNAME","MX","NS","TXT"];
async function q(srv,name,type){var u=srv==="cf"?"https://cloudflare-dns.com/dns-query":"https://dns.google/resolve";
var r=await fetch(u+"?name="+encodeURIComponent(name)+"&type="+type,{headers:{accept:"application/dns-json"}});return r.json()}
function ans(j,type){if(!j||j.Status===3)return null;var c={A:1,AAAA:28,CNAME:5,MX:15,NS:2,TXT:16}[type];
return (j.Answer||[]).filter(function(a){return a.type===c}).map(function(a){return a.data}).sort()}
async function lookup(){var name=$("dn").value.trim().replace(/^https?:\/\//i,"").split(/[\/?#:]/)[0].toLowerCase(),o=$("dnsout");o.textContent="";
if(!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(name)){o.textContent="Enter a valid domain, for example example.com";return}
$("dg").disabled=true;
try{for(var i=0;i<TYPES.length;i++){var t=TYPES[i],rs=await Promise.all([q("cf",name,t),q("g",name,t)]),a=ans(rs[0],t),b=ans(rs[1],t);
var card=el("div","card"),h=el("div","hd");h.appendChild(el("b",null,t));
var same=a&&b&&a.join("|")===b.join("|"),bad=el("span","badge"+(same||(!a&&!b)?"":" no"),(!a&&!b)?"No records":same?"Match":"Differs");h.appendChild(bad);card.appendChild(h);
if(a||b){var f=function(x){return x&&x.length?x.join("\n"):"-"};row(card,"Cloudflare",f(a));row(card,"Google",f(b))}
o.appendChild(card)}
o.appendChild(el("p","note","Different answers between resolvers can be normal for sites behind a CDN, which return different IPs by region."))}
catch(e){o.textContent="Lookup failed. Check your connection or try again."}
$("dg").disabled=false}
$("dg").onclick=lookup;$("dn").onkeydown=function(e){if(e.key==="Enter")lookup()};$("ipr").onclick=myip;
myip();
