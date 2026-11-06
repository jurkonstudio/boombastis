var $=function(i){return document.getElementById(i)};
// ---- Password strength (runs only in your browser)
var COMMON=["password","123456","12345678","123456789","1234567890","qwerty","qwerty123","abc123","letmein","111111","000000","iloveyou","admin","welcome","monkey","dragon","football","login","passw0rd","1q2w3e4r","princess","sunshine","master","hello","freedom","whatever","trustno1","batman","superman","password1"];
function fmtTime(s){if(s<1)return"instantly";var u=[["year",31557600],["day",86400],["hour",3600],["minute",60],["second",1]];
if(s>=31557600*1e9)return"billions of years";if(s>=31557600*1e6)return"millions of years";if(s>=31557600*1e3)return"thousands of years";
for(var i=0;i<u.length;i++){if(s>=u[i][1]){var n=Math.round(s/u[i][1]);return n+" "+u[i][0]+(n>1?"s":"")}}return"instantly"}
function seq(p){var l=p.toLowerCase(),a="abcdefghijklmnopqrstuvwxyz",d="0123456789",q="qwertyuiopasdfghjklzxcvbnm";
for(var i=0;i<l.length-2;i++){var t=l.substr(i,3),r=t.split("").reverse().join("");
if(a.indexOf(t)>-1||a.indexOf(r)>-1||d.indexOf(t)>-1||d.indexOf(r)>-1||q.indexOf(t)>-1||q.indexOf(r)>-1)return true}return false}
function analyze(p){var pool=0,tips=[];if(/[a-z]/.test(p))pool+=26;if(/[A-Z]/.test(p))pool+=26;if(/\d/.test(p))pool+=10;if(/[^A-Za-z0-9]/.test(p))pool+=33;
var bits=pool?p.length*Math.log2(pool):0,common=COMMON.indexOf(p.toLowerCase())>-1;
if(common){bits=Math.min(bits,10);tips.push(["bad","This is one of the most common passwords."])}
if(/(.)\1{2,}/.test(p)){bits-=p.length*0.8;tips.push(["bad","Repeated characters make it easier to guess."])}
if(p.length>2&&seq(p)){bits-=p.length*0.8;tips.push(["bad","Sequences like abc, 123 or qwerty are guessed first."])}
if(/^[a-z]+$/i.test(p)&&p.length)tips.push(["bad","Only letters. Add numbers or symbols."]);
if(p.length&&p.length<12)tips.push(["bad","Use at least 12 characters."]);else if(p.length>=12)tips.push(["ok","Good length ("+p.length+" characters)."]);
if(/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/\d/.test(p)&&/[^A-Za-z0-9]/.test(p))tips.push(["ok","Mixes upper, lower, numbers and symbols."]);
bits=Math.max(0,bits);var secs=Math.pow(2,bits)/2/1e10,lv=bits<28?0:bits<36?1:bits<60?2:bits<80?3:4;
return{bits:bits,secs:secs,lv:lv,tips:tips}}
var L=[["Very weak","#ff3b30"],["Weak","#ff7a1a"],["Fair","#ffb800"],["Strong","#6fcf3a"],["Very strong","#1a9b45"]];
function upd(){var p=$("pi").value,m=$("meter").firstChild,t=$("tips");t.textContent="";
if(!p){m.style.width="0";$("lab").textContent="Type a password";$("bits").textContent="-";$("ct").textContent="-";return}
var r=analyze(p);m.style.width=(r.lv+1)*20+"%";m.style.background=L[r.lv][1];$("lab").textContent=L[r.lv][0];
$("bits").textContent=Math.round(r.bits)+" bits";$("ct").textContent=fmtTime(r.secs);
r.tips.forEach(function(x){var d=document.createElement("div");d.className="tip "+x[0];d.textContent=(x[0]==="ok"?"✓ ":"! ")+x[1];t.appendChild(d)})}
$("pi").oninput=upd;$("ps").onchange=function(){$("pi").type=this.checked?"text":"password"};upd();
