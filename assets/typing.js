var $=function(i){return document.getElementById(i)};
(function(){
var WORDS_EN=("the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is was are been has had were said did made find long down may part more many call each write water little very still world great where much before through right too mean old same tell boy follow came show also around form three small set put end does another large must big such here why ask went men read need land different home move try kind hand picture again change off play spell air away animal house point page letter mother answer found study learn should country").split(" ");
var WORDS_ID="yang dan di itu dengan untuk tidak ini dari dalam akan pada juga saya ke karena bisa ada mereka lebih oleh atau sebagai telah seperti kami kita hanya lagi sudah namun saat setelah bahwa dapat harus belum banyak orang waktu hari tahun rumah kerja anak besar kecil baru lama hidup negara kota air api tanah jalan buku makan minum pergi datang lihat dengar baca tulis belajar main tidur bangun pagi siang malam teman keluarga ibu bapak kakak adik guru sekolah pasar toko uang harga murah mahal cepat pelan benar salah mudah sulit senang sedih takut berani cinta hati pikir tahu mau ingin butuh punya buat ambil beri bawa tunggu cari temu tanya jawab bicara cerita lagu film kapan siapa mana apa bagaimana mengapa satu dua tiga empat lima enam tujuh delapan sembilan sepuluh kemarin besok sekarang nanti dulu masih selalu sering jarang kadang semua setiap beberapa tiap antara bawah atas depan belakang kiri kanan dekat jauh tinggi rendah panas dingin putih hitam merah biru hijau kuning pohon bunga laut gunung sungai hujan angin langit bulan bintang matahari".split(" ");
var L=document.documentElement.lang==="id"?"id":"en",WORDS=L==="id"?WORDS_ID:WORDS_EN,VIEW=L==="id"?"typing_leaderboard_id":"typing_leaderboard";
var S={en:{u:"s",best:function(d,p){return"New personal best for "+d+" s! Previous: "+p+" WPM."},first:function(d){return"First result saved as your best for "+d+" s."},yours:function(d,b){return"Your best for "+d+" s: "+b+" WPM."},load:"Loading…",none:"No scores yet. Be the first.",fail:"The leaderboard could not be loaded right now.",bad:"Use 2 to 16 letters, numbers, spaces, _ or -.",send:"Sending…",ok:"Score submitted. Thanks!",rej:"The score was rejected. Wait a minute and try again.",err:"Could not send the score. Try again later."},
id:{u:"dtk",best:function(d,p){return"Rekor pribadi baru untuk "+d+" dtk! Sebelumnya: "+p+" WPM."},first:function(d){return"Hasil pertama disimpan sebagai rekor "+d+" dtk kamu."},yours:function(d,b){return"Rekor kamu untuk "+d+" dtk: "+b+" WPM."},load:"Memuat…",none:"Belum ada skor. Jadilah yang pertama.",fail:"Papan peringkat belum bisa dimuat sekarang.",bad:"Pakai 2 sampai 16 huruf, angka, spasi, _ atau -.",send:"Mengirim…",ok:"Skor terkirim. Terima kasih!",rej:"Skor ditolak. Tunggu semenit lalu coba lagi.",err:"Skor gagal dikirim. Coba lagi nanti."}}[L];
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
var k="bb_tt_best_"+dur,b=parseInt(store(k),10)||0,msg;if(res>b){store(k,String(res));msg=b?S.best(dur,b):S.first(dur)}else msg=S.yours(dur,b);
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
function hdr(extra){var h={apikey:SB.key};if(SB.key.indexOf("sb_")!==0)h.Authorization="Bearer "+SB.key;for(var k in extra)h[k]=extra[k];return h}
function board(){if(!(SB&&SB.url&&SB.key))return;var box=$("ttBoard");box.hidden=false;$("ttBoardMode").textContent=dur+" "+S.u;$("ttBoardMsg").textContent=S.load;
fetch(SB.url+"/rest/v1/"+VIEW+"?select=name,wpm,accuracy&duration=eq."+dur+"&order=wpm.desc,accuracy.desc&limit=20",{headers:hdr()})
.then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(rows){var ol=$("ttList");ol.innerHTML="";
rows.forEach(function(r){var li=document.createElement("li"),n=document.createElement("span"),s=document.createElement("b");n.textContent=esc(r.name);s.textContent=r.wpm+" WPM · "+r.accuracy+"%";li.appendChild(n);li.appendChild(s);ol.appendChild(li)});
$("ttBoardMsg").textContent=rows.length?"":S.none}).catch(function(){$("ttBoardMsg").textContent=S.fail})}
$("ttSend").onclick=function(){if(!last)return;var n=$("ttName").value.trim().replace(/\s+/g," "),m=$("ttMsg");
if(!/^[A-Za-z0-9 _-]{2,16}$/.test(n)){m.textContent=S.bad;return}
var btn=this;btn.disabled=true;m.textContent=S.send;
fetch(SB.url+"/rest/v1/typing_scores",{method:"POST",headers:hdr({"Content-Type":"application/json",Prefer:"return=minimal"}),body:JSON.stringify(L==="id"?{name:n,duration:last.dur,wpm:last.wpm,accuracy:last.acc,lang:"id"}:{name:n,duration:last.dur,wpm:last.wpm,accuracy:last.acc})})
.then(function(r){if(!r.ok)throw r.status;store("bb_tt_name",n);m.textContent=S.ok;$("ttSend").hidden=true;board()})
.catch(function(c){btn.disabled=false;m.textContent=c===429||c===400?S.rej:S.err})};
reset();board();
})();
