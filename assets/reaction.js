var $=function(i){return document.getElementById(i)};
(function(){
var GB=window.BB_GB,ROUNDS=5,state="idle",rounds=[],timer=null,t0=0,last=null;
var P=$("rtPad");
function rank(ms){return ms<200?"Excellent":ms<250?"Good":ms<300?"Average":ms<400?"Slow":"Very slow"}
function now(e){var t=e&&e.timeStamp;return t&&t<1e11?t:performance.now()}
function label(main,sub){P.innerHTML="";var b=document.createElement("span");b.textContent=main;P.appendChild(b);if(sub){var s=document.createElement("small");s.textContent=sub;P.appendChild(s)}}
function round(){$("rtRound").textContent=Math.min(rounds.length+1,ROUNDS)+" / "+ROUNDS}
function reset(){clearTimeout(timer);timer=null;state="idle";rounds=[];last=null;t0=0;
P.className="gm-pad";label("Click to start","Round 1 of "+ROUNDS+". Click as soon as the screen turns green.");
round();$("rtHint").textContent="";$("rtResult").hidden=true;$("rtSubmit").hidden=true;$("rtNote").textContent="";$("rtSend").disabled=false;$("rtSend").hidden=false}
function wait(){state="wait";P.className="gm-pad wait";label("Wait for green…","Do not click yet.");$("rtHint").textContent="Wait for green.";
timer=setTimeout(function(){state="go";P.className="gm-pad go";label("Click now!");$("rtHint").textContent="Go!";
requestAnimationFrame(function(){t0=performance.now()})},1500+Math.random()*3000)}
function early(){clearTimeout(timer);timer=null;state="idle";P.className="gm-pad early";label("Too soon!","Click to try this round again.");$("rtHint").textContent="Too soon. This round does not count."}
function hitRound(e){var ms=Math.max(1,Math.round(now(e)-t0));rounds.push(ms);round();
if(rounds.length>=ROUNDS)finish();else{state="idle";P.className="gm-pad";label(ms+" ms","Click to start round "+(rounds.length+1)+" of "+ROUNDS+".");$("rtHint").textContent=ms+" milliseconds."}}
function finish(){state="done";var sum=0,best=1e9;rounds.forEach(function(r){sum+=r;if(r<best)best=r});
var avg=Math.round(sum/ROUNDS);last={avg:avg};
P.className="gm-pad done";label(avg+" ms","Average of "+ROUNDS+" rounds. Press Restart to try again.");$("rtHint").textContent="Average "+avg+" milliseconds.";
$("rtAvg").textContent=avg+" ms";$("rtFast").textContent=best+" ms";$("rtRank").textContent=rank(avg);
var ol=$("rtRounds");ol.innerHTML="";rounds.forEach(function(r){var li=document.createElement("li");li.textContent=r+" ms";ol.appendChild(li)});
var k="bb_rt_best",b=parseInt(GB.store(k),10)||0,msg;
if(!b||avg<b){GB.store(k,String(avg));msg=b?"New personal best! Previous: "+b+" ms.":"First result saved as your best."}
else msg="Your best average: "+b+" ms.";
$("rtBest").textContent=msg;$("rtResult").hidden=false;
if(GB.ok&&avg>=100&&avg<=1000){$("rtName").value=GB.name();$("rtSubmit").hidden=false}}
function press(e){if(state==="idle")wait();else if(state==="wait")early();else if(state==="go")hitRound(e)}
P.addEventListener("pointerdown",function(e){if(e.pointerType==="mouse"&&e.button!==0)return;e.preventDefault();press(e)});
P.addEventListener("keydown",function(e){if(e.key===" "||e.key==="Enter"){e.preventDefault();if(!e.repeat)press(e)}else if(e.key==="Escape"){e.preventDefault();reset()}});
P.addEventListener("contextmenu",function(e){e.preventDefault()});
$("rtRestart").onclick=function(){reset();P.focus({preventScroll:true})};
function board(){GB.board({view:"reaction_leaderboard",mode:ROUNDS,dir:"asc",box:$("rtBoard"),list:$("rtList"),msg:$("rtBoardMsg"),fmt:function(n){return Math.round(n)+" ms"}})}
$("rtSend").onclick=function(){if(!last)return;var btn=this;
GB.send({game:"reaction",mode:ROUNDS,score:last.avg,name:$("rtName").value,btn:btn,msg:$("rtNote"),onok:function(){btn.hidden=true;board()}})};
reset();board();
})();
