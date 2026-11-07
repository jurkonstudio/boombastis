var $=function(i){return document.getElementById(i)};
// ---- Boombastis extra tools: URL encoder, UUID, timestamp, color, diff, regex, lorem ipsum, unit converter. Browser only.
(function(){
var MODE=$("tool").getAttribute("data-tool"),M={};
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e}
function copy(txt,btn){var o=btn.textContent;function ok(){btn.textContent="Copied";setTimeout(function(){btn.textContent=o},1400)}
if(navigator.clipboard)navigator.clipboard.writeText(txt).then(ok,function(){fb()});else fb();
function fb(){var t=el("textarea");t.value=txt;document.body.appendChild(t);t.select();try{document.execCommand("copy");ok()}catch(e){}t.remove()}}
// ===== URL =====
M.url=function(){function go(m){var s=$("in").value,o="";try{o=m==="enc"?($("full").checked?encodeURI(s):encodeURIComponent(s)):($("full").checked?decodeURI(s):decodeURIComponent(s.replace(/\+/g,$("pl").checked?" ":"+")));$("msg").textContent="";$("msg").className="tt-msg"}catch(e){$("msg").textContent="This text is not valid percent-encoding (a % is not followed by two hex digits).";$("msg").className="tt-msg err"}$("out").value=o}
$("enc").onclick=function(){go("enc")};$("dec").onclick=function(){go("dec")};$("cp").onclick=function(){copy($("out").value,this)};
$("sw").onclick=function(){$("in").value=$("out").value;$("out").value=""};
$("prs").onclick=function(){var t=$("tbl");t.textContent="";try{var x=new URL($("in").value.trim());[["Protocol",x.protocol],["Host",x.host],["Path",x.pathname],["Hash",x.hash]].forEach(function(r){if(r[1])row(t,r[0],r[1])});x.searchParams.forEach(function(v,k){row(t,"? "+k,v)});$("msg").textContent="";$("msg").className="tt-msg"}catch(e){$("msg").textContent="Paste a full URL starting with https:// to see its parts.";$("msg").className="tt-msg err"}};
function row(t,a,b){var r=el("tr");r.appendChild(el("th",null,a));r.appendChild(el("td",null,b));t.appendChild(r)}};
// ===== UUID =====
function uuid7(){var b=crypto.getRandomValues(new Uint8Array(16)),t=Date.now();for(var i=5;i>=0;i--){b[i]=t%256;t=Math.floor(t/256)}b[6]=b[6]&15|112;b[8]=b[8]&63|128;var h=[].map.call(b,function(x){return("0"+x.toString(16)).slice(-2)}).join("");return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20)}
function uuid4(){if(crypto.randomUUID)return crypto.randomUUID();var b=crypto.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;var h=[].map.call(b,function(x){return("0"+x.toString(16)).slice(-2)}).join("");return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20)}
M.uuid=function(){function gen(){var n=Math.max(1,Math.min(500,parseInt($("n").value,10)||1)),a=[];for(var i=0;i<n;i++){var s=$("v").value==="7"?uuid7():uuid4();if($("nh").checked)s=s.replace(/-/g,"");if($("up").checked)s=s.toUpperCase();if($("br").checked)s="{"+s+"}";a.push(s)}$("out").value=a.join("\n")}
$("gen").onclick=gen;$("cp").onclick=function(){copy($("out").value,this)};$("n").onchange=gen;gen()};
// ===== TIMESTAMP =====
M.ts=function(){function rel(ms){var d=(ms-Date.now())/1000,a=Math.abs(d),u=[[31536000,"year"],[2592000,"month"],[86400,"day"],[3600,"hour"],[60,"minute"],[1,"second"]];for(var i=0;i<u.length;i++)if(a>=u[i][0]||i===u.length-1){var n=Math.round(a/u[i][0]);return d<0?n+" "+u[i][1]+(n===1?"":"s")+" ago":"in "+n+" "+u[i][1]+(n===1?"":"s")}}
function show(ms){var t=$("tbl");t.textContent="";if(!isFinite(ms)||isNaN(new Date(ms).getTime())){$("msg").textContent="That value is not a valid date.";$("msg").className="tt-msg err";return}$("msg").textContent="";$("msg").className="tt-msg";var d=new Date(ms);
[["Unix (seconds)",String(Math.floor(ms/1000))],["Unix (milliseconds)",String(ms)],["ISO 8601 (UTC)",d.toISOString()],["UTC",d.toUTCString()],["Your time zone",d.toLocaleString(undefined,{dateStyle:"full",timeStyle:"long"})],["Relative",rel(ms)]].forEach(function(r){var tr=el("tr");tr.appendChild(el("th",null,r[0]));tr.appendChild(el("td",null,r[1]));t.appendChild(tr)})}
$("c1").onclick=function(){var v=$("ti").value.trim();if(!/^-?\d+(\.\d+)?$/.test(v)){$("msg").textContent="Type a number such as 1700000000.";$("msg").className="tt-msg err";return}var n=+v;show(Math.abs(n)<1e11?n*1000:n)};
$("c2").onclick=function(){var v=$("di").value;if(!v){$("msg").textContent="Pick a date and time first.";$("msg").className="tt-msg err";return}show($("tz").value==="utc"?Date.parse(v+"Z"):new Date(v).getTime())};
$("nw").onclick=function(){$("ti").value=Math.floor(Date.now()/1000);show(Date.now())};show(Date.now());$("ti").value=Math.floor(Date.now()/1000)};
// ===== COLOR =====
M.color=function(){var cur=[255,59,48];
function h2r(h){h=h.replace("#","");if(h.length===3)h=h.replace(/./g,"$&$&");if(!/^[0-9a-f]{6}$/i.test(h))return null;var n=parseInt(h,16);return[n>>16&255,n>>8&255,n&255]}
function r2h(r){return"#"+r.map(function(x){return("0"+Math.round(x).toString(16)).slice(-2)}).join("")}
function r2l(r){var R=r[0]/255,G=r[1]/255,B=r[2]/255,mx=Math.max(R,G,B),mn=Math.min(R,G,B),l=(mx+mn)/2,h=0,s=0,d=mx-mn;if(d){s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===R?(G-B)/d+(G<B?6:0):mx===G?(B-R)/d+2:(R-G)/d+4;h*=60}return[Math.round(h),Math.round(s*100),Math.round(l*100)]}
function l2r(h,s,l){s/=100;l/=100;var k=function(n){return(n+h/30)%12},a=s*Math.min(l,1-l),f=function(n){return Math.round(255*(l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)))))};return[f(0),f(8),f(4)]}
function lum(r){var c=r.map(function(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]}
function ratio(a,b){var x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function paint(skip){var h=r2h(cur),l=r2l(cur);if(skip!=="hex")$("hex").value=h;if(skip!=="rgb")$("rgb").value="rgb("+cur.join(", ")+")";if(skip!=="hsl")$("hsl").value="hsl("+l[0]+", "+l[1]+"%, "+l[2]+"%)";$("pk").value=h;$("sw").style.background=h;
var w=ratio(cur,[255,255,255]),b=ratio(cur,[0,0,0]);$("ct").textContent="Contrast: "+w.toFixed(2)+":1 with white ("+(w>=4.5?"passes":"fails")+" WCAG AA for text), "+b.toFixed(2)+":1 with black ("+(b>=4.5?"passes":"fails")+").";
var p=$("pal");p.textContent="";[90,75,60,45,30,15].forEach(function(L){var x=l2r(l[0],l[1],L),bt=el("button","btn alt",r2h(x));bt.type="button";bt.style.cssText="background:"+r2h(x)+";color:"+(lum(x)>.4?"#111":"#fff")+";flex:1 1 90px";bt.onclick=function(){cur=x;paint()};p.appendChild(bt)})}
$("hex").oninput=function(){var r=h2r(this.value.trim());if(r){cur=r;paint("hex")}};
$("rgb").oninput=function(){var m=this.value.match(/(\d{1,3})\D+(\d{1,3})\D+(\d{1,3})/);if(m&&m.slice(1).every(function(x){return+x<=255})){cur=[+m[1],+m[2],+m[3]];paint("rgb")}};
$("hsl").oninput=function(){var m=this.value.match(/(\d{1,3})\D+(\d{1,3})\D+(\d{1,3})/);if(m&&+m[1]<=360&&+m[2]<=100&&+m[3]<=100){cur=l2r(+m[1],+m[2],+m[3]);paint("hsl")}};
$("pk").oninput=function(){cur=h2r(this.value)||cur;paint()};
["hx","rg","hs"].forEach(function(k,i){$(k).onclick=function(){copy($(["hex","rgb","hsl"][i]).value,this)}});
if(window.EyeDropper){$("eye").hidden=false;$("eye").onclick=function(){new EyeDropper().open().then(function(r){cur=h2r(r.sRGBHex);paint()},function(){})}}paint()};
// ===== DIFF =====
M.diff=function(){function tok(s,m){return m==="word"?s.split(/(\s+)/).filter(function(x){return x!==""}):m==="char"?s.split(""):s.split("\n")}
function lcs(a,b,eq){var n=a.length,m=b.length,w=m+1,t=new Uint16Array((n+1)*w);for(var i=n-1;i>=0;i--)for(var j=m-1;j>=0;j--)t[i*w+j]=eq(a[i],b[j])?t[(i+1)*w+j+1]+1:Math.max(t[(i+1)*w+j],t[i*w+j+1]);
var o=[],i=0,j=0;while(i<n&&j<m){if(eq(a[i],b[j])){o.push(["=",b[j]]);i++;j++}else if(t[(i+1)*w+j]>=t[i*w+j+1]){o.push(["-",a[i]]);i++}else{o.push(["+",b[j]]);j++}}while(i<n)o.push(["-",a[i++]]);while(j<m)o.push(["+",b[j++]]);return o}
$("go").onclick=function(){var m=$("dm").value,ic=$("ic").checked,iw=$("iw").checked,A=tok($("a").value,m),B=tok($("b").value,m);
if(A.length*B.length>16e6||A.length>4000||B.length>4000){$("msg").textContent="Texts are too long to compare in this mode. Try line mode or shorter text.";$("msg").className="tt-msg err";return}
var norm=function(x){if(ic)x=x.toLowerCase();if(iw)x=x.replace(/\s+/g," ").trim();return x};
var d=lcs(A,B,function(x,y){return norm(x)===norm(y)}),o=$("out");o.textContent="";var add=0,del=0;
d.forEach(function(x){var s=el("span",x[0]==="+"?"ad":x[0]==="-"?"rm":"",x[1]+(m==="line"?"\n":""));if(m==="line")s.className+=" ln";if(x[0]==="+")add++;if(x[0]==="-")del++;o.appendChild(s)});
$("msg").textContent=add||del?add+" added, "+del+" removed.":"The two texts are identical.";$("msg").className="tt-msg";o.hidden=false};
$("sw").onclick=function(){var t=$("a").value;$("a").value=$("b").value;$("b").value=t}};
// ===== REGEX =====
M.rx=function(){function esc(s){return s.replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c]})}
function run(){var p=$("pt").value,fl="",o=$("out"),m=$("msg"),list=$("ml");list.textContent="";o.textContent="";["g","i","m","s","u"].forEach(function(f){if($("f"+f).checked)fl+=f});
if(!p){m.textContent="Type a pattern to start.";m.className="tt-msg";return}var re;try{re=new RegExp(p,fl)}catch(e){m.textContent="Invalid pattern: "+e.message;m.className="tt-msg err";return}
var s=$("tx").value,n=0,last=0,html="",x,re2=new RegExp(p,fl.indexOf("g")<0?fl+"g":fl);
while((x=re2.exec(s))!==null&&n<500){if(x[0]===""){re2.lastIndex++;if(x.index>=s.length)break}html+=esc(s.slice(last,x.index))+'<mark class="rx">'+esc(x[0])+"</mark>";last=x.index+x[0].length;n++;
var r=el("tr");r.appendChild(el("th",null,"#"+n+" @"+x.index));r.appendChild(el("td",null,x[0]+(x.length>1?"   ["+[].slice.call(x,1).map(function(g){return g===undefined?"–":g}).join(" | ")+"]":"")));list.appendChild(r);if(fl.indexOf("g")<0)break}
o.innerHTML=html+esc(s.slice(last));m.textContent=n?n+(n===1?" match":" matches")+(n>=500?" (showing first 500)":""):"No matches.";m.className="tt-msg";
try{$("rp").value!==""||$("rpo").value;$("rpo").value=s.replace(re,$("rp").value)}catch(e){}}
["pt","tx","rp"].forEach(function(i){$(i).oninput=run});["fg","fi","fm","fs","fu"].forEach(function(i){$(i).onchange=run});run()};
// ===== LOREM =====
M.lorem=function(){var W="lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(" ");
function r(n){return Math.floor(Math.random()*n)}
function sent(first){var n=6+r(10),a=[];for(var i=0;i<n;i++)a.push(W[r(W.length)]);if(first){a[0]="lorem";a[1]="ipsum";a[2]="dolor";a[3]="sit";a[4]="amet"}var s=a.join(" ");if(n>9&&r(2))s=s.replace(/ (\w+) (\w+) (\w+)$/," $1, $2 $3");return s.charAt(0).toUpperCase()+s.slice(1)+"."}
function gen(){var n=Math.max(1,Math.min(200,parseInt($("n").value,10)||1)),k=$("k").value,st=$("st").checked,o="";
if(k==="p"){var ps=[];for(var i=0;i<n;i++){var c=3+r(4),s=[];for(var j=0;j<c;j++)s.push(sent(st&&i===0&&j===0));ps.push(s.join(" "))}o=ps.join("\n\n")}
else if(k==="s"){var a=[];for(var i=0;i<n;i++)a.push(sent(st&&i===0));o=a.join(" ")}
else{var w=[];for(var i=0;i<n;i++)w.push(W[i<5&&st?i:r(W.length)]);o=w.join(" ");o=o.charAt(0).toUpperCase()+o.slice(1)+"."}$("out").value=o}
$("gen").onclick=gen;$("cp").onclick=function(){copy($("out").value,this)};gen()};
// ===== UNITS =====
M.unit=function(){var U={length:{m:["Meter (m)",1],km:["Kilometer (km)",1000],cm:["Centimeter (cm)",.01],mm:["Millimeter (mm)",.001],mi:["Mile (mi)",1609.344],yd:["Yard (yd)",.9144],ft:["Foot (ft)",.3048],in:["Inch (in)",.0254],nmi:["Nautical mile",1852]},
mass:{kg:["Kilogram (kg)",1],g:["Gram (g)",.001],mg:["Milligram (mg)",1e-6],t:["Tonne (t)",1000],lb:["Pound (lb)",.45359237],oz:["Ounce (oz)",.028349523125],st:["Stone (st)",6.35029318]},
volume:{l:["Liter (L)",1],ml:["Milliliter (mL)",.001],m3:["Cubic meter (m³)",1000],gal:["US gallon",3.785411784],qt:["US quart",.946352946],cup:["US cup",.2365882365],floz:["US fluid ounce",.0295735295625],tbsp:["Tablespoon (US)",.01478676478],tsp:["Teaspoon (US)",.00492892159]},
area:{m2:["Square meter (m²)",1],km2:["Square kilometer (km²)",1e6],ha:["Hectare (ha)",1e4],cm2:["Square centimeter",1e-4],ft2:["Square foot",.09290304],in2:["Square inch",6.4516e-4],ac:["Acre",4046.8564224],mi2:["Square mile",2589988.110336]},
speed:{ms:["Meter/second (m/s)",1],kmh:["Kilometer/hour (km/h)",1/3.6],mph:["Mile/hour (mph)",.44704],kn:["Knot (kn)",.514444444],fts:["Foot/second",.3048]},
time:{s:["Second (s)",1],ms:["Millisecond (ms)",.001],min:["Minute (min)",60],h:["Hour (h)",3600],d:["Day (d)",86400],wk:["Week",604800],mo:["Month (30.44 d)",2629746],yr:["Year (365.25 d)",31557600]},
data:{B:["Byte (B)",1],KB:["Kilobyte (KB)",1e3],MB:["Megabyte (MB)",1e6],GB:["Gigabyte (GB)",1e9],TB:["Terabyte (TB)",1e12],KiB:["Kibibyte (KiB)",1024],MiB:["Mebibyte (MiB)",1048576],GiB:["Gibibyte (GiB)",1073741824],bit:["Bit",.125],Mb:["Megabit (Mb)",125000]},
temp:{C:["Celsius (°C)"],F:["Fahrenheit (°F)"],K:["Kelvin (K)"]}};
function fill(){var c=$("cat").value,a=$("from"),b=$("to");a.textContent=b.textContent="";Object.keys(U[c]).forEach(function(k,i){[a,b].forEach(function(s,j){var o=el("option",null,U[c][k][0]);o.value=k;s.appendChild(o)})});a.selectedIndex=0;b.selectedIndex=Math.min(1,b.options.length-1);conv()}
function to(c,k,v,t){if(c==="temp"){var C=k==="C"?v:k==="F"?(v-32)*5/9:v-273.15;return t==="C"?C:t==="F"?C*9/5+32:C+273.15}return v*U[c][k][1]/U[c][t][1]}
function nf(x){if(x===0)return"0";var a=Math.abs(x);return a>=1e12||a<1e-6?x.toExponential(6):String(+x.toPrecision(10))}
function conv(){var c=$("cat").value,v=parseFloat($("val").value.replace(",",".")),f=$("from").value,t=$("to").value,tb=$("tbl");tb.textContent="";
if(isNaN(v)){$("res").textContent="–";return}$("res").textContent=nf(to(c,f,v,t))+" "+t;
Object.keys(U[c]).forEach(function(k){var r=el("tr");r.appendChild(el("th",null,U[c][k][0]));r.appendChild(el("td",null,nf(to(c,f,v,k))));tb.appendChild(r)})}
$("cat").onchange=fill;["val","from","to"].forEach(function(i){$(i).oninput=conv;$(i).onchange=conv});$("sw").onclick=function(){var a=$("from").value;$("from").value=$("to").value;$("to").value=a;conv()};fill()};
(M[MODE]||function(){})();
})();
