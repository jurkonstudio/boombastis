/* Shared leaderboard helper for the CPS and Reaction Time tests (Supabase REST; hidden when not configured). */
(function(){
var SB=window.BB_SB,ok=!!(SB&&SB.url&&SB.key),seq=0;
var S={load:"Loading…",none:"No scores yet. Be the first.",fail:"The leaderboard could not be loaded right now.",bad:"Use 2 to 16 letters, numbers, spaces, _ or -.",send:"Sending…",ok:"Score submitted. Thanks!",rej:"The score was rejected. Wait a minute and try again.",err:"Could not send the score. Try again later."};
function hdr(extra){var h={apikey:SB.key};if(SB.key.indexOf("sb_")!==0)h.Authorization="Bearer "+SB.key;for(var k in extra)h[k]=extra[k];return h}
function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
/* o: {view, mode, dir:"asc"|"desc", box, list, msg, fmt(score)} */
function board(o){if(!ok)return;var n=++seq;o.box.hidden=false;o.msg.textContent=S.load;
fetch(SB.url+"/rest/v1/"+o.view+"?select=name,score&mode=eq."+o.mode+"&order=score."+o.dir+",created_at.asc&limit=20",{headers:hdr()})
.then(function(r){if(!r.ok)throw 0;return r.json()})
.then(function(rows){if(n!==seq)return;o.list.innerHTML="";
rows.forEach(function(r){var li=document.createElement("li"),a=document.createElement("span"),b=document.createElement("b");a.textContent=String(r.name);b.textContent=o.fmt(Number(r.score));li.appendChild(a);li.appendChild(b);o.list.appendChild(li)});
o.msg.textContent=rows.length?"":S.none})
.catch(function(){if(n===seq)o.msg.textContent=S.fail})}
/* o: {game, mode, score, name, btn, msg, onok()} */
function send(o){var n=String(o.name).trim().replace(/\s+/g," ");
if(!/^[A-Za-z0-9 _-]{2,16}$/.test(n)){o.msg.textContent=S.bad;return}
o.btn.disabled=true;o.msg.textContent=S.send;
fetch(SB.url+"/rest/v1/game_scores",{method:"POST",headers:hdr({"Content-Type":"application/json",Prefer:"return=minimal"}),body:JSON.stringify({game:o.game,mode:o.mode,name:n,score:o.score})})
.then(function(r){if(!r.ok)throw r.status;store("bb_gm_name",n);o.msg.textContent=S.ok;o.onok()})
.catch(function(c){o.btn.disabled=false;o.msg.textContent=(c===429||c===400)?S.rej:S.err})}
window.BB_GB={ok:ok,board:board,send:send,store:store,name:function(){return store("bb_gm_name")||store("bb_tt_name")||""}};
})();
