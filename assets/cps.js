var $=function(i){return document.getElementById(i)};
(function(){
var GB=window.BB_GB,dur=5,clicks=0,t0=0,tick=null,over=false,last=null;
var P=$("cpsPad");
function rank(c){return c<4?"Casual clicker":c<6?"Average":c<8?"Quick":c<10?"Fast":c<13?"Very fast":"Elite"}
function fmt(n){return n.toFixed(2)}
function elapsed(){return t0?(performance.now()-t0)/1000:0}
function label(main,sub){P.innerHTML="";var b=document.createElement("span");b.textContent=main;P.appendChild(b);if(sub){var s=document.createElement("small");s.textContent=sub;P.appendChild(s)}}
function reset(){clearInterval(tick);tick=null;over=false;clicks=0;t0=0;last=null;
P.className="gm-pad";label("Click here to start","The timer starts on your first click.");
$("cpsTime").textContent=dur;$("cpsClicks").textContent=0;$("cpsLive").textContent="0.0";
$("cpsResult").hidden=true;$("cpsSubmit").hidden=true;$("cpsMsg").textContent="";$("cpsSend").disabled=false;$("cpsSend").hidden=false}
function start(){t0=performance.now();P.className="gm-pad run";label("Keep clicking!");
tick=setInterval(function(){var e=elapsed();$("cpsTime").textContent=Math.max(0,dur-e).toFixed(1);$("cpsLive").textContent=e>=0.5?(clicks/e).toFixed(1):"0.0";if(e>=dur)finish()},50)}
function finish(){if(over)return;over=true;clearInterval(tick);
var c=Math.round(clicks/dur*100)/100;last={cps:c,dur:dur};
P.className="gm-pad done";label("Time is up","Press Restart to try again.");
$("cpsTime").textContent="0.0";$("cpsLive").textContent=c.toFixed(1);
$("cpsRCps").textContent=fmt(c);$("cpsRClicks").textContent=clicks;$("cpsRDur").textContent=dur+" s";$("cpsRRank").textContent=rank(c);
var k="bb_cps_best_"+dur,b=parseFloat(GB.store(k))||0,msg;
if(c>b){GB.store(k,String(c));msg=b?"New personal best for "+dur+" s! Previous: "+fmt(b)+" CPS.":"First result saved as your best for "+dur+" s."}
else msg="Your best for "+dur+" s: "+fmt(b)+" CPS.";
$("cpsBest").textContent=msg;$("cpsResult").hidden=false;
if(GB.ok&&c>=1&&c<=25){$("cpsName").value=GB.name();$("cpsSubmit").hidden=false}}
function hit(){if(over)return;if(!t0)start();else if(elapsed()>=dur){finish();return}
clicks++;$("cpsClicks").textContent=clicks}
P.addEventListener("pointerdown",function(e){if(e.pointerType==="mouse"&&e.button!==0)return;e.preventDefault();hit()});
P.addEventListener("keydown",function(e){if(e.key===" "||e.key==="Enter"){e.preventDefault();if(!e.repeat)hit()}else if(e.key==="Escape"){e.preventDefault();reset();board()}});
P.addEventListener("contextmenu",function(e){e.preventDefault()});
$("cpsRestart").onclick=function(){reset();P.focus({preventScroll:true})};
$("cpsModes").addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;dur=parseInt(b.getAttribute("data-d"),10);
[].forEach.call($("cpsModes").children,function(x){x.setAttribute("aria-pressed",x===b?"true":"false")});reset();board()});
function board(){GB.board({view:"cps_leaderboard",mode:dur,dir:"desc",box:$("cpsBoard"),list:$("cpsList"),msg:$("cpsBoardMsg"),fmt:function(n){return fmt(n)+" CPS"}});$("cpsBoardMode").textContent=dur+" s"}
$("cpsSend").onclick=function(){if(!last)return;var btn=this;
GB.send({game:"cps",mode:last.dur,score:last.cps,name:$("cpsName").value,btn:btn,msg:$("cpsMsg"),onok:function(){btn.hidden=true;board()}})};
reset();board();
})();
