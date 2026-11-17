/* Boombastis page-view tracker. Loaded only when site.config.json has "analytics". No cookies; no IP stored. */
(function(){
var A=window.BB_AN;if(!A||!A.url||!A.key)return;
try{
var h=location.hostname;if(h==="localhost"||h==="127.0.0.1"||h===""||location.protocol==="file:")return;
if(navigator.doNotTrack==="1"||window.doNotTrack==="1"||navigator.globalPrivacyControl===true)return;
function rid(){var a=new Uint8Array(12);(window.crypto||window.msCrypto).getRandomValues(a);var s="";for(var i=0;i<a.length;i++)s+=("0"+a[i].toString(16)).slice(-2);return s}
function get(st,k){try{var v=window[st].getItem(k);if(!v||!/^[A-Za-z0-9_-]{8,40}$/.test(v)){v=rid();window[st].setItem(k,v)}return v}catch(e){return null}}
var vid=get("localStorage","bb_vid")||rid(),sid=get("sessionStorage","bb_sid")||rid();
var ua=navigator.userAgent||"",w=Math.min(screen.width||0,window.innerWidth||screen.width||0)||window.innerWidth||1024;
var device=/iPad|Tablet|PlayBook|Silk/i.test(ua)||(/Android/i.test(ua)&&!/Mobile/i.test(ua))?"tablet":/Mobi|iPhone|iPod|Android/i.test(ua)||w<600?"mobile":"desktop";
var browser=/Edg\//.test(ua)?"Edge":/OPR\/|Opera/.test(ua)?"Opera":/SamsungBrowser/.test(ua)?"Samsung":/Firefox|FxiOS/.test(ua)?"Firefox":/Chrome|CriOS/.test(ua)?"Chrome":/Safari/.test(ua)?"Safari":"Other";
var os=/Android/.test(ua)?"Android":/iPhone|iPad|iPod/.test(ua)?"iOS":/Windows/.test(ua)?"Windows":/Mac OS X|Macintosh/.test(ua)?"macOS":/CrOS/.test(ua)?"ChromeOS":/Linux/.test(ua)?"Linux":"Other";
var ref="";try{if(document.referrer){var r=new URL(document.referrer);if(r.hostname&&r.hostname!==location.hostname)ref=r.hostname.replace(/^www\./,"")}}catch(e){}
var tz="";try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch(e){}
var body=JSON.stringify({p_vid:vid,p_sid:sid,p_path:location.pathname.slice(0,200),p_referrer:ref||null,p_lang:(navigator.language||"").slice(0,12)||null,p_tz:tz||null,p_device:device,p_browser:browser,p_os:os});
var hd={"Content-Type":"application/json",apikey:A.key};if(A.key.indexOf("sb_")!==0)hd.Authorization="Bearer "+A.key;
function send(){fetch(A.url+"/rest/v1/rpc/track_view",{method:"POST",headers:hd,body:body,keepalive:true}).catch(function(){})}
if(document.visibilityState==="prerender"){document.addEventListener("visibilitychange",send,{once:true})}else send();
}catch(e){}
})();
