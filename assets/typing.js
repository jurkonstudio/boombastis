var $=function(i){return document.getElementById(i)};
(function(){
var WORDS=("the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is was are been has had were said did made find long down may part more many call each write water little very still world great where much before through right too mean old same tell boy follow came show also around form three small set put end does another large must big such here why ask went men read need land different home move try kind hand picture again change off play spell air away animal house point page letter mother answer found study learn should country").split(" ");
var SB=window.BB_SB,dur=30,words=[],idx=0,ok=0,wrongW=0,okChars=0,keys=0,errs=0,wrongTyped=0,t0=0,tick=null,over=false,last=null;
var W=$("ttWords"),I=$("ttInput");
function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
function gen(){words=[];for(var i=0;i<260;i++)words.push(WORDS[Math.floor(Math.random()*WORDS.length)]);
W.innerHTML="";words.forEach(function(w,i){var s=document.createElement("span");s.className="w"+(i?"":" cur");s.textContent=w;W.appendChild(s)});W.scrollTop=0}
function reset(){clearInterval(tick);tick=null;over=false;idx=0;ok=0;wrongW=0;okChars=0;keys=0;errs=0;wrongTyped=0;t0=0;last=null;
$("ttSend").hidden=false;$("ttSend").disabled=false;I.value="";I.disabled=false;gen();$("ttTime").textContent=dur;$("ttLive").textContent=0;$("ttResult").hidden=true;$("ttSubmit").hidden=true;$("ttMsg").textContent="";I.focus({preventScroll:true})}
function elapsed(){return t0?(Date.now()-t0)/1000:0}
function wpm(){var m=Math.max(elapsed(),1)/60;return Math.round(okChars/5/m)}
function start(){t0=Date.now();tick=setInterval(function(){var left=Math.max(0,dur-elapsed());$("ttTime").textContent=Math.ceil(left);$("ttLive").textContent=elapsed()>=2?wpm():0;if(left<=0)finish()},100)}
function finish(){if(over)return;over=true;clearInterval(tick);I.disabled=true;
var cur=W.children[idx],typed=I.value.trim();if(cur&&typed&&typed===words[idx]){okChars+=typed.length;ok++}
var mins=dur/60,res=Math.round(okChars/5/mins),raw=Math.round((okChars+wrongChars())/5/mins),acc=keys?Math.max(0,Math.round((keys-errs)/keys*100)):0;
last={wpm:res,acc:acc,dur:dur};
$("ttTime").textContent=0;$("ttLive").textContent=res;$("ttRWpm").textContent=res;$("ttRAcc").textContent=acc+"%";$("ttRRaw").textContent=raw;$("ttRWords").textContent=ok+" / "+wrongW;
var k="bb_tt_best_"+dur,b=parseInt(store(k),10)||0,msg;if(res>b){store(k,String(res));msg=b?"New personal best for "+dur+" s! Previous: "+b+" WPM.":"First result saved as your best for "+dur+" s."}else msg="Your best for "+dur+" s: "+b+" WPM.";
$("ttBest").textContent=msg;$("ttResult").hidden=false;
if(SB&&SB.url&&SB.key&&res>0){$("ttName").value=store("bb_tt_name")||"";$("ttSubmit").hidden=false}}
function wrongChars(){return wrongTyped}
I.addEventListener("input",function(e){if(over)return;
if(!t0&&I.value.length)start();
var v=I.value,tgt=words[idx];
if(e.inputType&&e.inputType.indexOf("insert")===0&&e.data){keys+=e.data.length;if(e.data!==" "&&tgt.indexOf(v.trim())!==0)errs+=1}
if(/\s$/.test(v)){var typed=v.trim();if(typed){var el=W.children[idx];if(typed===tgt){okChars+=tgt.length+1;ok++;el.className="w ok"}else{wrongW++;wrongTyped+=typed.length+1;el.className="w no"}
idx++;I.value="";var nx=W.children[idx];if(nx){nx.className="w cur";var top=nx.offsetTop-W.firstChild.offsetTop;W.scrollTop=Math.max(0,top-0)}}else I.value=""}
else{var c=W.children[idx];if(c)c.className="w cur"+(tgt.indexOf(v)===0?"":" bad")}});
function key(e){if(e.key==="Escape"){e.preventDefault();reset()}}
I.addEventListener("keydown",key);
$("ttRestart").onclick=function(){reset()};
W.onclick=function(){I.focus()};
$("ttModes").addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;dur=parseInt(b.getAttribute("data-d"),10);
[].forEach.call($("ttModes").children,function(x){x.setAttribute("aria-pressed",x===b?"true":"false")});reset();board()});
// ---- leaderboard (Supabase REST; hidden when not configured)
function esc(s){return String(s)}
function board(){if(!(SB&&SB.url&&SB.key))return;var box=$("ttBoard");box.hidden=false;$("ttBoardMode").textContent=dur+" s";$("ttBoardMsg").textContent="Loading…";
fetch(SB.url+"/rest/v1/typing_leaderboard?select=name,wpm,accuracy&duration=eq."+dur+"&order=wpm.desc,accuracy.desc&limit=20",{headers:{apikey:SB.key,Authorization:"Bearer "+SB.key}})
.then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(rows){var ol=$("ttList");ol.innerHTML="";
rows.forEach(function(r){var li=document.createElement("li"),n=document.createElement("span"),s=document.createElement("b");n.textContent=esc(r.name);s.textContent=r.wpm+" WPM · "+r.accuracy+"%";li.appendChild(n);li.appendChild(s);ol.appendChild(li)});
$("ttBoardMsg").textContent=rows.length?"":"No scores yet. Be the first."}).catch(function(){$("ttBoardMsg").textContent="The leaderboard could not be loaded right now."})}
$("ttSend").onclick=function(){if(!last)return;var n=$("ttName").value.trim().replace(/\s+/g," "),m=$("ttMsg");
if(!/^[A-Za-z0-9 _-]{2,16}$/.test(n)){m.textContent="Use 2 to 16 letters, numbers, spaces, _ or -.";return}
var btn=this;btn.disabled=true;m.textContent="Sending…";
fetch(SB.url+"/rest/v1/typing_scores",{method:"POST",headers:{apikey:SB.key,Authorization:"Bearer "+SB.key,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({name:n,duration:last.dur,wpm:last.wpm,accuracy:last.acc})})
.then(function(r){if(!r.ok)throw r.status;store("bb_tt_name",n);m.textContent="Score submitted. Thanks!";$("ttSend").hidden=true;board()})
.catch(function(c){btn.disabled=false;m.textContent=c===429||c===400?"The score was rejected. Wait a minute and try again.":"Could not send the score. Try again later."})};
reset();board();
})();
