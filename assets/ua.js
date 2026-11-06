var $=function(i){return document.getElementById(i)};
// ---- Browser info (read locally from your browser)
function row(p,k,v){var d=document.createElement("div");d.className="row";var a=document.createElement("span");a.textContent=k;var b=document.createElement("b");b.textContent=v;d.appendChild(a);d.appendChild(b);p.appendChild(d)}
function parse(u){var b="Unknown",o="Unknown",m;
if(m=u.match(/Edg\/([\d.]+)/))b="Edge "+m[1];else if(m=u.match(/OPR\/([\d.]+)/))b="Opera "+m[1];else if(m=u.match(/(?:Chrome|CriOS)\/([\d.]+)/))b="Chrome "+m[1];else if(m=u.match(/(?:Firefox|FxiOS)\/([\d.]+)/))b="Firefox "+m[1];else if(m=u.match(/Version\/([\d.]+).*Safari/))b="Safari "+m[1];
if(/Windows NT 10/.test(u))o="Windows 10/11";else if(/Windows/.test(u))o="Windows";else if(m=u.match(/Android ([\d.]+)/))o="Android "+m[1];else if(m=u.match(/(?:iPhone|CPU) OS ([\d_]+)/))o="iOS "+m[1].replace(/_/g,".");else if(/Mac OS X/.test(u))o="macOS";else if(/CrOS/.test(u))o="ChromeOS";else if(/Linux/.test(u))o="Linux";
return{b:b,o:o}}
var n=navigator,u=n.userAgent,p=parse(u),s=$("uastr");s.textContent=u;
var a=$("uasum");row(a,"Browser",p.b);row(a,"Operating system",p.o);row(a,"Device type",/Mobi|Android|iPhone/.test(u)?"Mobile":/iPad|Tablet/.test(u)?"Tablet":"Desktop");
var d=$("uadet"),tz="-";try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){}
row(d,"Platform",n.platform||"-");row(d,"Language",(n.languages&&n.languages.join(", "))||n.language||"-");row(d,"Time zone",tz);
row(d,"Screen",screen.width+" × "+screen.height);row(d,"Viewport",innerWidth+" × "+innerHeight);row(d,"Pixel ratio",String(devicePixelRatio));
row(d,"CPU threads",n.hardwareConcurrency?String(n.hardwareConcurrency):"-");row(d,"Memory (approx.)",n.deviceMemory?n.deviceMemory+" GB":"-");
row(d,"Touch points",String(n.maxTouchPoints||0));row(d,"Cookies enabled",n.cookieEnabled?"Yes":"No");row(d,"Online",n.onLine?"Yes":"No");
row(d,"Do Not Track",n.doNotTrack==="1"?"On":"Off / not set");row(d,"Dark mode",matchMedia("(prefers-color-scheme: dark)").matches?"On":"Off");
$("uac").onclick=function(){var b=this;try{navigator.clipboard.writeText(u).then(function(){b.textContent="Copied!";setTimeout(function(){b.textContent="Copy user agent"},1200)})}catch(e){}};
