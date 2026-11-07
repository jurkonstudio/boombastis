#!/usr/bin/env bash
# Boombastis: apply Instagram upgrade + Image Compressor upgrade.
# Run from the repo root (the folder that contains scripts/build.mjs):  bash apply-changes.sh
set -euo pipefail
[ -f scripts/build.mjs ] && [ -d src/pages ] || { echo "Run this in the repo root (scripts/build.mjs not found)."; exit 1; }
BK=".bak-apply-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BK"
save(){ [ -f "$1" ] && { mkdir -p "$BK/$(dirname "$1")"; cp "$1" "$BK/$1"; } || true; }

echo "-> assets/nonfollowers.js"
save "assets/nonfollowers.js"
mkdir -p "$(dirname "assets/nonfollowers.js")"
cat > "assets/nonfollowers.js" <<'BOOMEOF'
var $=function(i){return document.getElementById(i)};
(function(){
var WANT=/(^|\/)(followers(_\d+)?|following)\.(json|html?)$/i,CHUNK=100,BATCH=10,MAXZIP=300*1024*1024;
var K_SNAP="bb_nf_snap",K_KEEP="bb_nf_keep",K_DONE="bb_nf_done";
var data=null,prev=null,tab="notback",shown=0,view=[],demo=false,keep=new Set(),done=new Set();
var NAMES={notback:"Not following you back",fans:"You don't follow back",mutual:"Mutual",lost:"Unfollowed you",gained:"New followers"};
var WHEN={notback:"You followed",fans:"Followed you",mutual:"Followed you",lost:"Followed you",gained:"Followed you"};

function msg(t,bad){var m=$("nfMsg");m.textContent=t;m.className="tt-msg"+(bad?" nf-bad":"")}

// ---- browser storage (only used for things the person chooses to save)
function sget(k){try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}}
function sset(k,v){if(demo)return true;try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function sdel(k){try{localStorage.removeItem(k)}catch(e){}}
function loadMarks(){keep=new Set(sget(K_KEEP)||[]);done=new Set(sget(K_DONE)||[])}
function saveMarks(){sset(K_KEEP,Array.from(keep));sset(K_DONE,Array.from(done))}

// ---- parsing
function user(h){var m=/instagram\.com\/(?:_u\/)?([A-Za-z0-9._]{1,30})(?:[\/?#]|$)/i.exec(h||"");return m?m[1]:""}
function clean(n){n=String(n||"").trim().replace(/^@/,"");return /^[A-Za-z0-9._]{1,30}$/.test(n)?n.toLowerCase():""}
function add(map,n,t){if(!n||map.has(n))return;t=+t||0;if(t>1e11)t=Math.floor(t/1000);map.set(n,t>0?t:0)}
function fromJson(j,map){(function walk(x){
if(Array.isArray(x)){x.forEach(walk);return}
if(x&&typeof x==="object"){
if(Array.isArray(x.string_list_data)){x.string_list_data.forEach(function(s){var n=clean(s&&s.value)||clean(x.title)||clean(user(s&&s.href));add(map,n,s&&s.timestamp)});return}
Object.keys(x).forEach(function(k){walk(x[k])})}})(j)}
function fromHtml(t,map){var d=new DOMParser().parseFromString(t,"text/html");
[].forEach.call(d.querySelectorAll("a[href]"),function(a){var n=clean(user(a.getAttribute("href")))||clean(a.textContent);add(map,n,0)})}
function kind(name){var b=name.split("/").pop().toLowerCase();return b.indexOf("following")===0?"following":"followers"}
function parse(name,text,acc){var k=kind(name),map=acc[k];
if(/\.json$/i.test(name)){try{fromJson(JSON.parse(text),map)}catch(e){throw new Error(name+" is not valid JSON.")}}else fromHtml(text,map);acc.files++}
function inflate(bytes){var s=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));return new Response(s).text()}
async function readZip(buf,acc){var dv=new DataView(buf),u8=new Uint8Array(buf),i=buf.byteLength-22;
for(;i>=0&&i>buf.byteLength-65600;i--)if(dv.getUint32(i,true)===0x06054b50)break;
if(i<0||dv.getUint32(i,true)!==0x06054b50)throw new Error("This ZIP file could not be read. Unzip it and upload the followers and following files instead.");
var n=dv.getUint16(i+10,true),off=dv.getUint32(i+16,true);
if(n===0xFFFF||off===0xFFFFFFFF)throw new Error("This ZIP is too large to read here. Unzip it and upload the followers and following files instead.");
var dec=new TextDecoder();
for(var k=0;k<n;k++){if(dv.getUint32(off,true)!==0x02014b50)break;
var method=dv.getUint16(off+10,true),cs=dv.getUint32(off+20,true),nl=dv.getUint16(off+28,true),el=dv.getUint16(off+30,true),cl=dv.getUint16(off+32,true),lh=dv.getUint32(off+42,true);
var name=dec.decode(u8.subarray(off+46,off+46+nl));off+=46+nl+el+cl;
if(!WANT.test(name))continue;
var start=lh+30+dv.getUint16(lh+26,true)+dv.getUint16(lh+28,true),raw=u8.subarray(start,start+cs),text;
if(method===0)text=dec.decode(raw);
else if(method===8){if(typeof DecompressionStream==="undefined")throw new Error("This browser cannot open ZIP files. Unzip the file and upload the followers and following files instead.");text=await inflate(raw)}
else continue;
parse(name,text,acc)}}
async function read(files){var acc={followers:new Map(),following:new Map(),files:0};
for(var f of files){
if(/\.zip$/i.test(f.name)){if(f.size>MAXZIP)throw new Error("That ZIP is very large. Unzip it and upload only the followers and following files.");await readZip(await f.arrayBuffer(),acc)}
else if(WANT.test(f.name))parse(f.name,await f.text(),acc)}
return acc}

// ---- loading
function day(t){return new Date(t).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})}
function snapPrev(){var s=sget(K_SNAP);
if(!s||!Array.isArray(s.fr))return null;
return{src:"snap",label:"the snapshot you saved on "+day(s.t),followers:new Map(s.fr),following:new Map((s.fg||[]).map(function(u){return[u,0]}))}}
async function load(files){msg("Reading files…");var acc;
try{acc=await read(files)}catch(e){msg(e.message||"Could not read the files.",true);return}
if(!acc.files){msg("No followers or following file found. Upload followers_1.json and following.json (or the ZIP you downloaded from Instagram).",true);return}
if(!acc.followers.size||!acc.following.size){msg((acc.followers.size?"The following file is missing or empty.":"The followers file is missing or empty.")+" Upload both to compare.",true);return}
demo=false;loadMarks();data=acc;prev=snapPrev();tab="notback";msg("");render()}
async function loadOld(files){if(!data)return;msg("Reading older export…");var acc;
try{acc=await read(files)}catch(e){msg(e.message||"Could not read the files.",true);return}
if(!acc.followers.size){msg("The older export needs a followers file. Upload the ZIP or followers_1.json from an earlier download.",true);return}
prev={src:"file",label:"your older export",followers:acc.followers,following:acc.following};
if(tab==="lost"||tab==="gained")tab="lost";msg("");render()}

// ---- sample data (nothing real, nothing saved)
function makeDemo(){var now=Math.floor(Date.now()/1000),base=now-86400*700,fr=new Map(),fg=new Map(),pf=new Map(),pg=new Map();
function nm(i){return"sample_user_"+(i<10?"00":i<100?"0":"")+i}
for(var i=1;i<=120;i++){var t=base+i*86400*5;if(i<=90)fg.set(nm(i),t+86400*3);if(i>=31)fr.set(nm(i),t);if(i>=31&&i<=110)pf.set(nm(i),t)}
for(var g=1;g<=4;g++)pf.set("sample_gone_"+g,base+g*86400*9);
for(var k=1;k<=90;k++)pg.set(nm(k),0);
demo=true;keep=new Set();done=new Set();data={followers:fr,following:fg,files:1};
prev={src:"demo",label:"a sample older export",followers:pf,following:pg};tab="notback";
msg("Sample data: these are not real accounts, and nothing is saved.");render()}

// ---- comparison
function sets(){var A=data.following,B=data.followers,S={notback:[],fans:[],mutual:[],lost:[],gained:[]};
A.forEach(function(_,u){(B.has(u)?S.mutual:S.notback).push(u)});
B.forEach(function(_,u){if(!A.has(u))S.fans.push(u)});
if(prev){prev.followers.forEach(function(_,u){if(!B.has(u))S.lost.push(u)});B.forEach(function(_,u){if(!prev.followers.has(u))S.gained.push(u)})}
Object.keys(S).forEach(function(k){S[k].sort()});return S}
function stamp(u){var m=tab==="notback"?data.following:tab==="lost"?prev&&prev.followers:data.followers;return(m&&m.get(u))||0}
function pending(u){return!(keep.has(u)||done.has(u))}

// ---- rendering
function render(){var S=sets();data.S=S;
$("nfRes").hidden=false;
$("nfFollowing").textContent=data.following.size;$("nfFollowers").textContent=data.followers.size;$("nfNotBack").textContent=S.notback.length;$("nfFans").textContent=S.fans.length;
var rate=data.following.size?Math.round(S.mutual.length/data.following.size*100):0;
$("nfBar").style.width=rate+"%";
$("nfRateTxt").textContent=rate+"% of the people you follow follow you back ("+S.mutual.length+" of "+data.following.size+").";
[].forEach.call($("nfTabs").children,function(b){var k=b.getAttribute("data-t"),cmp=k==="lost"||k==="gained";
b.hidden=cmp&&!prev;b.textContent=NAMES[k]+" ("+S[k].length+")";b.setAttribute("aria-pressed",k===tab?"true":"false")});
if(prev){$("nfCmp").hidden=false;$("nfCmp").textContent="Compared with "+prev.label+": "+S.lost.length+" unfollowed you, "+S.gained.length+" new followers. Accounts that were deleted or deactivated also disappear from the list."}
else{$("nfCmp").hidden=true;$("nfCmp").textContent=""}
var s=demo?null:sget(K_SNAP);
$("nfSnapInfo").textContent=demo?"":s&&s.t?"Saved snapshot: "+day(s.t)+".":"No snapshot saved yet.";
list()}
function pend(){if(!data)return;var nb=data.S.notback,left=nb.filter(pending).length,k=nb.filter(function(u){return keep.has(u)}).length,d=nb.filter(function(u){return done.has(u)}).length;
$("nfPend").textContent=left+" left to review, "+k+" kept, "+d+" marked unfollowed."}
function list(){var q=$("nfQ").value.trim().toLowerCase().replace(/^@/,""),nb=tab==="notback";
$("nfNbOpts").hidden=!nb;
var hide=nb&&!$("nfShowAll").checked;
view=data.S[tab].filter(function(u){return(!q||u.indexOf(q)>-1)&&(!hide||pending(u))});
var so=$("nfSort").value;
if(so!=="az")view.sort(function(a,b){var x=stamp(a),y=stamp(b);if(!x&&!y)return a<b?-1:1;if(!x)return 1;if(!y)return-1;return so==="new"?y-x:x-y});
if(nb&&$("nfBatch").checked)view=view.slice(0,BATCH);
shown=0;$("nfList").innerHTML="";more();pend();
$("nfEmpty").hidden=view.length>0;
$("nfEmpty").textContent=data.S[tab].length?(nb&&hide&&!q&&!view.length?"Nothing left to review. Nice and tidy.":"No account matches your search."):"Nothing here."}
function mini(label,on,fn){var b=document.createElement("button");b.type="button";b.className="nf-mini";b.textContent=label;b.setAttribute("aria-pressed",on?"true":"false");b.onclick=fn;return b}
function mark(set,u,btn){if(set.has(u))set["delete"](u);else set.add(u);saveMarks();pend();
if(tab==="notback"&&!$("nfShowAll").checked){var y=window.scrollY;list();window.scrollTo(0,y)}else btn.setAttribute("aria-pressed",set.has(u)?"true":"false")}
function more(){var ul=$("nfList"),end=Math.min(view.length,shown+CHUNK);
for(var i=shown;i<end;i++){var u=view[i],li=document.createElement("li"),who=document.createElement("div"),n=document.createElement("span"),ra=document.createElement("div");
who.className="nf-who";ra.className="nf-ra";n.textContent=u;who.appendChild(n);
var t=stamp(u);if(t){var sm=document.createElement("small");sm.textContent=WHEN[tab]+" "+day(t*1000);who.appendChild(sm)}
if(tab==="notback"){(function(u){var kb=mini("Keep",keep.has(u),function(){mark(keep,u,kb)}),db=mini("Unfollowed",done.has(u),function(){mark(done,u,db)});
kb.title="Keep this account: hide it from the review list";db.title="Mark as already unfollowed";ra.appendChild(kb);ra.appendChild(db)})(u)}
if(demo){var ds=document.createElement("small");ds.textContent="sample";ra.appendChild(ds)}
else{var a=document.createElement("a");a.textContent="Open profile";a.href="https://www.instagram.com/"+encodeURIComponent(u)+"/";a.target="_blank";a.rel="noopener noreferrer";a.setAttribute("aria-label","Open profile of "+u);ra.appendChild(a)}
li.appendChild(who);li.appendChild(ra);ul.appendChild(li)}
shown=end;$("nfMore").hidden=shown>=view.length;$("nfMore").textContent="Show more ("+(view.length-shown)+" left)"}

// ---- events
$("nfFile").addEventListener("change",function(){var f=[].slice.call(this.files);if(f.length)load(f);this.value=""});
$("nfOld").addEventListener("change",function(){var f=[].slice.call(this.files);if(f.length)loadOld(f);this.value=""});
$("nfOldBtn").onclick=function(){$("nfOld").click()};
$("nfDemo").onclick=makeDemo;
var drop=$("nfDrop");["dragenter","dragover"].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add("on")})});
["dragleave","drop"].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove("on")})});
drop.addEventListener("drop",function(e){var f=[].slice.call(e.dataTransfer.files);if(f.length)load(f)});
$("nfTabs").addEventListener("click",function(e){var b=e.target.closest("button");if(!b||!data)return;tab=b.getAttribute("data-t");render()});
$("nfQ").addEventListener("input",function(){if(data)list()});
["nfSort","nfShowAll","nfBatch"].forEach(function(i){$(i).addEventListener("change",function(){if(data)list()})});
$("nfMore").onclick=more;
$("nfSave").onclick=function(){if(!data)return;
if(demo){msg("Sample data is not saved. Load your own export to save a snapshot.",true);return}
var ok=sset(K_SNAP,{t:Date.now(),fr:Array.from(data.followers),fg:Array.from(data.following.keys())});
msg(ok?"Snapshot saved in this browser. Next time, load a newer export to see who unfollowed you.":"Could not save in this browser. Storage may be blocked or full.",!ok);
if(ok)$("nfSnapInfo").textContent="Saved snapshot: "+day(Date.now())+"."};
$("nfWipe").onclick=function(){sdel(K_SNAP);sdel(K_KEEP);sdel(K_DONE);keep=new Set();done=new Set();
if(prev&&prev.src==="snap")prev=null;
msg("Saved snapshot and marks were deleted from this browser.");if(data)render()};
$("nfCopy").onclick=function(){if(!data)return;var t=view.join("\n");
if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){msg("Copied "+view.length+" usernames.")},function(){msg("Copy failed. Use Download CSV instead.",true)});else msg("Copy is not available here. Use Download CSV instead.",true)};
$("nfCsv").onclick=function(){if(!data)return;
var rows=["username,profile_url,date"].concat(view.map(function(u){var t=stamp(u);return u+",https://www.instagram.com/"+u+"/,"+(t?new Date(t*1000).toISOString().slice(0,10):"")}));
var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.join("\n")+"\n"],{type:"text/csv"}));a.download="instagram-"+tab+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},2000)};
$("nfClear").onclick=function(){data=null;prev=null;demo=false;$("nfRes").hidden=true;$("nfList").innerHTML="";$("nfQ").value="";msg("")};
})();
BOOMEOF

echo "-> assets/image.js"
save "assets/image.js"
mkdir -p "$(dirname "assets/image.js")"
cat > "assets/image.js" <<'BOOMEOF'
var $=function(i){return document.getElementById(i)};
// ---- Image compressor: batch, resize, format conversion, before/after compare, ZIP
var files=[],results=[],timer=null,runId=0,EXT={"image/webp":"webp","image/jpeg":"jpg","image/png":"png","image/avif":"avif"},SAME={"image/webp":1,"image/jpeg":1,"image/png":1};
function fmt(n){return n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(2)+" MB"}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
function add(l){Array.prototype.forEach.call(l,function(f){if(/^image\//.test(f.type))files.push(f)});run()}
$("file").onchange=function(e){add(e.target.files);e.target.value=""};
var dz=$("drop");["dragover","dragenter"].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.add("on")})});
["dragleave","drop"].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.remove("on")})});
dz.addEventListener("drop",function(e){add(e.dataTransfer.files)});
function sched(){clearTimeout(timer);timer=setTimeout(run,300)}
$("q").oninput=function(){$("qv").textContent=this.value;sched()};
$("fmt").onchange=sched;
$("mw").onchange=function(){$("cu").hidden=this.value!=="custom";sched()};
$("rw").oninput=sched;$("rh").oninput=sched;

// AVIF is only offered when this browser can really encode it
(function(){try{var c=document.createElement("canvas");c.width=c.height=1;c.toBlob(function(b){if(!b||b.type!=="image/avif"){var o=$("fmt").querySelector('option[value="image/avif"]');if(o)o.remove()}},"image/avif")}catch(e){var o=$("fmt").querySelector('option[value="image/avif"]');if(o)o.remove()}})();

function num(id){var v=parseInt($(id).value,10);return v>0?v:0}
function settings(){var mw=$("mw").value,box={w:0,h:0};
if(mw==="custom"){box.w=num("rw");box.h=num("rh")}else box.w=+mw;
return{type:$("fmt").value,q:$("q").value/100,box:box}}
function outType(f,type){return type==="same"?(SAME[f.type]?f.type:"image/webp"):type}
async function conv(f,type,q,box){
var bmp=await createImageBitmap(f,{imageOrientation:"from-image"}),w0=bmp.width,h0=bmp.height,s=1;
if(box.w&&w0>box.w)s=Math.min(s,box.w/w0);if(box.h&&h0>box.h)s=Math.min(s,box.h/h0);
var w=Math.max(1,Math.round(w0*s)),h=Math.max(1,Math.round(h0*s));
var c=document.createElement("canvas");c.width=w;c.height=h;var x=c.getContext("2d");
if(type==="image/jpeg"){x.fillStyle="#fff";x.fillRect(0,0,w,h)}
x.imageSmoothingQuality="high";x.drawImage(bmp,0,0,w,h);if(bmp.close)bmp.close();
var b=await new Promise(function(r){c.toBlob(r,type,q)});
return{blob:b,w:w,h:h,w0:w0,h0:h0,resized:s<1}}
function cleanup(){results.forEach(function(r){if(r.url)URL.revokeObjectURL(r.url);if(r.ou)URL.revokeObjectURL(r.ou)});results=[]}
async function run(){var id=++runId;cleanup();var S=settings();render();
if(!files.length){$("prog").textContent="";return}
for(var i=0;i<files.length;i++){
if(id!==runId)return;
$("prog").textContent=files.length>1?"Compressing "+(i+1)+" of "+files.length+"…":"Compressing…";
var f=files[i],r;
try{var type=outType(f,S.type),o=await conv(f,type,S.q,S.box),b=o.blob,kept=false;
if(!b){throw new Error("encode")}
if(b.size>=f.size&&b.type===f.type&&!o.resized){b=f;kept=true}
r={file:f,name:f.name.replace(/\.[^.]+$/,"")+"-boom."+(kept?(EXT[f.type]||"png"):(EXT[b.type]||"png")),orig:f.size,size:b.size,blob:b,url:URL.createObjectURL(b),w:o.w,h:o.h,w0:o.w0,h0:o.h0,kept:kept}}
catch(e){r={file:f,name:f.name,orig:f.size,size:f.size,blob:f,url:URL.createObjectURL(f),err:1}}
if(id!==runId){URL.revokeObjectURL(r.url);return}
results.push(r);render()}
if(id===runId)$("prog").textContent=""}

// ---- before / after slider
function buildCmp(r){
if(!r.ou)r.ou=URL.createObjectURL(r.file);
var box=el("div","cmpw"),wrap=el("div","cmp"),a=el("img"),b=el("img","aft"),hd=el("i","hd"),rng=el("input");
wrap.style.aspectRatio=r.w+" / "+r.h;
a.src=r.ou;a.alt="Original";b.src=r.url;b.alt="Compressed";
rng.type="range";rng.min=0;rng.max=100;rng.value=50;rng.setAttribute("aria-label","Slide to compare original and compressed");
function set(v){v=Math.max(0,Math.min(100,v));b.style.clipPath="inset(0 0 0 "+v+"%)";hd.style.left=v+"%";rng.value=v}
set(50);rng.oninput=function(){set(+this.value)};
var drag=false;function at(e){var rc=wrap.getBoundingClientRect();set((e.clientX-rc.left)/rc.width*100)}
wrap.addEventListener("pointerdown",function(e){drag=true;try{wrap.setPointerCapture(e.pointerId)}catch(x){}at(e)});
wrap.addEventListener("pointermove",function(e){if(drag)at(e)});
["pointerup","pointercancel"].forEach(function(t){wrap.addEventListener(t,function(){drag=false})});
wrap.appendChild(a);wrap.appendChild(b);wrap.appendChild(hd);wrap.appendChild(el("span","cl l","Original"));wrap.appendChild(el("span","cl r","Compressed"));
box.appendChild(wrap);box.appendChild(rng);
box.appendChild(el("div","sz",fmt(r.orig)+" ("+r.w0+" × "+r.h0+") → "+fmt(r.size)+" ("+r.w+" × "+r.h+")"));
return box}

// ---- list
function render(){var L=$("list");L.innerHTML="";var to=0,tn=0,ok=0;
results.forEach(function(r,idx){
var p=Math.round((1-r.size/r.orig)*100),d=el("div","item"),img=el("img"),info=el("div","info");
img.alt="";img.src=r.url;d.appendChild(img);
info.appendChild(el("div","nm",r.name));
info.appendChild(el("div","sz",fmt(r.orig)+" → "+fmt(r.size)+(r.err?"":"  ·  "+r.w+" × "+r.h)));
if(!r.err){ok++;to+=r.orig;tn+=r.size}
info.appendChild(el("span","badge"+(!r.err&&p>0?"":" no"),r.err?"Could not read":p>0?"BOOM! -"+p+"%":r.kept?"Already optimal":"Larger than original"));
d.appendChild(info);
var acts=el("div","iacts");
if(!r.err){var cb=el("button","btn alt",r.open?"Hide compare":"Compare");cb.type="button";cb.setAttribute("aria-expanded",r.open?"true":"false");
cb.onclick=function(){r.open=!r.open;render()};acts.appendChild(cb);
var a=el("a","btn","Download");a.href=r.url;a.download=r.name;acts.appendChild(a)}
var rm=el("button","btn alt","Remove");rm.type="button";rm.setAttribute("aria-label","Remove "+r.name);
rm.onclick=function(){var f=r.file;if(r.url)URL.revokeObjectURL(r.url);if(r.ou)URL.revokeObjectURL(r.ou);results.splice(idx,1);var k=files.indexOf(f);if(k>-1)files.splice(k,1);if($("prog").textContent)run();else render()};
acts.appendChild(rm);d.appendChild(acts);
if(r.open&&!r.err)d.appendChild(buildCmp(r));
L.appendChild(d)});
var s=$("sum");
if(ok){s.classList.add("show");$("sn").textContent="-"+Math.max(0,Math.round((1-tn/to)*100))+"%";$("st").textContent=ok+" image(s): "+fmt(to)+" down to "+fmt(tn)}else s.classList.remove("show");
$("zipb").hidden=ok<2;$("clr").hidden=!files.length}

// ---- download all as ZIP (store only, images are already compressed)
var CRC=(function(){var t=[],c,k;for(var n=0;n<256;n++){c=n;for(k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u){var c=0xFFFFFFFF;for(var i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function zip(list){
var parts=[],cd=[],off=0,enc=new TextEncoder(),w16=function(a,v){a.push(v&255,(v>>8)&255)},w32=function(a,v){a.push(v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255)};
list.forEach(function(f){
var nm=enc.encode(f.name),crc=crc32(f.data),h=[];
w32(h,0x04034B50);w16(h,20);w16(h,0x0800);w16(h,0);w16(h,0);w16(h,0x21);w32(h,crc);w32(h,f.data.length);w32(h,f.data.length);w16(h,nm.length);w16(h,0);
parts.push(new Uint8Array(h),nm,f.data);
var c=[];w32(c,0x02014B50);w16(c,20);w16(c,20);w16(c,0x0800);w16(c,0);w16(c,0);w16(c,0x21);w32(c,crc);w32(c,f.data.length);w32(c,f.data.length);w16(c,nm.length);w16(c,0);w16(c,0);w16(c,0);w16(c,0);w32(c,0);w32(c,off);
cd.push(new Uint8Array(c),nm);off+=h.length+nm.length+f.data.length});
var n=0,i;for(i=0;i<cd.length;i++)n+=cd[i].length;var cds=new Uint8Array(n),p=0;for(i=0;i<cd.length;i++){cds.set(cd[i],p);p+=cd[i].length}
var e=[];w32(e,0x06054B50);w16(e,0);w16(e,0);w16(e,list.length);w16(e,list.length);w32(e,cds.length);w32(e,off);w16(e,0);
return new Blob(parts.concat([cds,new Uint8Array(e)]),{type:"application/zip"})}
$("zipb").onclick=async function(){
var seen={},list=[],ok=results.filter(function(r){return!r.err});
for(var i=0;i<ok.length;i++){var r=ok[i],nm=r.name,k=1;while(seen[nm])nm=r.name.replace(/(\.[^.]+)$/,"-"+(++k)+"$1");seen[nm]=1;
list.push({name:nm,data:new Uint8Array(await r.blob.arrayBuffer())})}
var url=URL.createObjectURL(zip(list)),a=document.createElement("a");a.href=url;a.download="boombastis-images.zip";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},4000)};
$("clr").onclick=function(){runId++;files=[];cleanup();$("prog").textContent="";render()};
BOOMEOF

echo "-> src/pages/instagram-non-followers/index.html"
save "src/pages/instagram-non-followers/index.html"
mkdir -p "$(dirname "src/pages/instagram-non-followers/index.html")"
cat > "src/pages/instagram-non-followers/index.html" <<'BOOMEOF'
<!--meta {"url":"/instagram-non-followers/","lang":"en","title":"Instagram Non-Followers Checker: Who Doesn't Follow You Back | Boombastis","description":"See who doesn't follow you back and who unfollowed you on Instagram. Compare your own data exports in your browser. No login, no password.","og":"/og/instagram-non-followers.jpg","ld":["{\"@context\":\"https://schema.org\",\"@type\":\"WebApplication\",\"name\":\"Instagram Non-Followers Checker\",\"url\":\"{{ORIGIN}}/instagram-non-followers/\",\"applicationCategory\":\"UtilitiesApplication\",\"operatingSystem\":\"Any\",\"offers\":{\"@type\":\"Offer\",\"price\":\"0\",\"priceCurrency\":\"USD\"},\"inLanguage\":\"en\"}","{\"@context\":\"https://schema.org\",\"@type\":\"FAQPage\",\"mainEntity\":[{\"@type\":\"Question\",\"name\":\"Do you need my Instagram password?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"No. The tool never asks you to log in. You upload files that you downloaded from your own account, and they are read inside your browser. They are not sent to any server.\"}},{\"@type\":\"Question\",\"name\":\"How do I get my followers and following files?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"In the Instagram app, open your profile menu, go to Accounts Center, then Your information and permissions, then Download your information. Choose your profile, select only Followers and following, pick JSON as the format and All time as the date range, then submit the request. Instagram prepares the file and tells you when it is ready. Menu names can change slightly between app versions.\"}},{\"@type\":\"Question\",\"name\":\"Which files can I upload?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Upload the ZIP you downloaded, or the files inside it: followers_1.json (and followers_2.json if you have more) and following.json. The HTML versions of the same files also work. If your browser cannot open ZIP files, unzip the download first.\"}},{\"@type\":\"Question\",\"name\":\"Why does it say no files were found?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"The tool looks for files named followers or followers_1 and following, ending in .json or .html. If you renamed the files or exported something else, such as only your posts, upload the correct ones.\"}},{\"@type\":\"Question\",\"name\":\"Why do the numbers differ from the Instagram app?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"The export is a snapshot taken when you requested it. Accounts that were deleted, deactivated or renamed since then, and people who followed or unfollowed you afterwards, will not match. Request a fresh export if you want current numbers.\"}},{\"@type\":\"Question\",\"name\":\"Can it show who unfollowed me?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Yes, if you give it two points in time. Load a newer export, then either compare it with an older export you still have or with a snapshot you saved earlier in this browser. The Unfollowed you tab lists people who were in the old followers list but are not in the new one. Accounts that were deleted or deactivated also disappear, so not every name is a person who chose to unfollow.\"}},{\"@type\":\"Question\",\"name\":\"Is anything saved on my device?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Only what you choose. Your export is read in memory and is gone when you close the tab. If you press Save snapshot, or mark accounts as Keep or Unfollowed, those usernames are stored in your own browser storage so they can be used next time. Nothing is sent anywhere, and Delete saved data removes it all.\"}},{\"@type\":\"Question\",\"name\":\"What do Keep and Unfollowed do?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Keep hides an account from your review list, for example a brand or friend you follow on purpose. Unfollowed marks an account you already unfollowed by hand. Turn on 10 at a time to review a small batch, then continue later.\"}},{\"@type\":\"Question\",\"name\":\"Can it unfollow people for me?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"No, on purpose. Automatic unfollow tools break the rules of social networks and can get your account limited. Use the Open profile links and unfollow manually, a few at a time.\"}},{\"@type\":\"Question\",\"name\":\"Does it work for TikTok, X or Facebook?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Not yet. This version supports the Instagram data export only, because each network uses a different file format.\"}},{\"@type\":\"Question\",\"name\":\"Is this tool made by Instagram?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"No. Boombastis is not affiliated with, endorsed by or connected to Instagram or Meta.\"}}]}"],"scripts":["/assets/nonfollowers.js?v=1"]}-->
<section class="on" id="nonfollowers">
<h1>Instagram Non-Followers Checker</h1><p class="sub">See who doesn't follow you back, using your own data export. Nothing is uploaded.</p>
<label class="drop" id="nfDrop" for="nfFile"><b>Choose your Instagram export</b><small>ZIP, followers_1.json and following.json, or the HTML files. You can select several files.</small><input id="nfFile" type="file" multiple accept=".zip,.json,.html,.htm,application/zip,application/json,text/html"></label>
<p class="nf-demo"><button class="nf-link" id="nfDemo" type="button">Try it with sample data</button></p>
<p class="tt-msg" id="nfMsg" role="status"></p>
<div id="nfRes" hidden>
<div class="stats"><div><b id="nfFollowing">0</b><span>You follow</span></div><div><b id="nfFollowers">0</b><span>Follow you</span></div><div><b id="nfNotBack">0</b><span>Not following you back</span></div><div><b id="nfFans">0</b><span>You don't follow back</span></div></div>
<div class="nf-rate"><div class="nf-bar" aria-hidden="true"><i id="nfBar"></i></div><p id="nfRateTxt"></p></div>
<p class="tt-msg" id="nfCmp" hidden></p>
<div class="card">
<div class="nf-tabs" id="nfTabs" role="group" aria-label="Lists"><button type="button" data-t="notback" aria-pressed="true">Not following you back</button><button type="button" data-t="fans" aria-pressed="false">You don't follow back</button><button type="button" data-t="mutual" aria-pressed="false">Mutual</button><button type="button" data-t="lost" aria-pressed="false" hidden>Unfollowed you</button><button type="button" data-t="gained" aria-pressed="false" hidden>New followers</button></div>
<label class="sr" for="nfQ">Search usernames</label>
<input id="nfQ" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Search username">
<div class="nf-ctl"><label class="sr" for="nfSort">Sort by</label><select id="nfSort"><option value="az">Sort: A to Z</option><option value="new">Sort: newest first</option><option value="old">Sort: oldest first</option></select></div>
<div id="nfNbOpts"><label class="nf-chk"><input type="checkbox" id="nfBatch"> Review 10 at a time</label><label class="nf-chk"><input type="checkbox" id="nfShowAll"> Show kept and unfollowed accounts</label><p class="nf-sub" id="nfPend"></p></div>
<ul class="nf-list" id="nfList"></ul>
<p class="tt-msg" id="nfEmpty" hidden></p>
<button class="btn alt" id="nfMore" type="button" hidden>Show more</button>
<div class="nf-acts"><button class="btn" id="nfCopy" type="button">Copy list</button><button class="btn" id="nfCsv" type="button">Download CSV</button><button class="btn alt" id="nfClear" type="button">Clear</button></div>
<div class="nf-acts"><button class="btn alt" id="nfOldBtn" type="button">Compare with an older export</button><button class="btn alt" id="nfSave" type="button">Save snapshot</button><button class="btn alt" id="nfWipe" type="button">Delete saved data</button><input id="nfOld" type="file" multiple accept=".zip,.json,.html,.htm" hidden></div>
<p class="nf-sub" id="nfSnapInfo"></p>
</div>
</div>
</section>
<div class="about"><h2>About this tool</h2><p>This tool compares the people you follow on Instagram with the people who follow you, and shows who does not follow you back. It works from the data export that Instagram lets you download from your own account, so you never share your password and nothing is uploaded. It is useful for tidying a following list, checking a business or hobby account, or simply satisfying curiosity.</p><h2>How it works</h2><p>You choose the ZIP you downloaded from Instagram, or the followers and following files inside it. The page reads them in your browser, builds two lists of usernames and compares them. You then see three groups: accounts you follow that do not follow you back, accounts that follow you that you do not follow back, and mutual follows. Each username has an Open profile link, and you can search the list, copy it or download it as a CSV file.</p><p>No account, login or email is needed, and the files never leave your device. Close the tab and the data is gone, unless you choose to save a snapshot or mark accounts, which stay only in your own browser and can be deleted at any time.</p><h2>Who unfollowed me</h2><p>One export only shows a single moment. To find unfollowers, press Save snapshot after your first export. Later, request a new export and load it here: the Unfollowed you and New followers tabs compare it with the snapshot. You can also load an older export file with Compare with an older export instead of saving anything.</p><p>The lists also show the date each account followed or was followed, when your export includes it, and you can sort by newest or oldest.</p><h2>How to use</h2><ol><li>In Instagram, request your data: Accounts Center, Your information and permissions, Download your information.</li><li>Select only Followers and following, choose JSON, and set the date range to All time.</li><li>When Instagram tells you the file is ready, download it to your device.</li><li>Choose the ZIP here, or select followers_1.json and following.json together.</li><li>Open the Not following you back tab and review the list.</li><li>Optional: press Save snapshot, and next time load a newer export to see who unfollowed you.</li></ol><h2>Unfollowing safely</h2><p>This tool does not unfollow anyone for you, and that is intentional. Instagram may limit accounts that follow or unfollow many people very quickly, and tools that automate it often break the platform rules. Use the Open profile link on each account and unfollow by hand, a few at a time. Review 10 at a time keeps the batch small, Keep hides accounts you follow on purpose, and Unfollowed marks the ones you have finished. Keep in mind that the export is a snapshot from the moment you requested it, so some accounts may have changed since then.</p><h2>Frequently asked questions</h2><details><summary>Do you need my Instagram password?</summary><p>No. The tool never asks you to log in. You upload files that you downloaded from your own account, and they are read inside your browser. They are not sent to any server.</p></details><details><summary>How do I get my followers and following files?</summary><p>In the Instagram app, open your profile menu, go to Accounts Center, then Your information and permissions, then Download your information. Choose your profile, select only Followers and following, pick JSON as the format and All time as the date range, then submit the request. Instagram prepares the file and tells you when it is ready. Menu names can change slightly between app versions.</p></details><details><summary>Which files can I upload?</summary><p>Upload the ZIP you downloaded, or the files inside it: followers_1.json (and followers_2.json if you have more) and following.json. The HTML versions of the same files also work. If your browser cannot open ZIP files, unzip the download first.</p></details><details><summary>Why does it say no files were found?</summary><p>The tool looks for files named followers or followers_1 and following, ending in .json or .html. If you renamed the files or exported something else, such as only your posts, upload the correct ones.</p></details><details><summary>Why do the numbers differ from the Instagram app?</summary><p>The export is a snapshot taken when you requested it. Accounts that were deleted, deactivated or renamed since then, and people who followed or unfollowed you afterwards, will not match. Request a fresh export if you want current numbers.</p></details><details><summary>Can it show who unfollowed me?</summary><p>Yes, if you give it two points in time. Load a newer export, then either compare it with an older export you still have or with a snapshot you saved earlier in this browser. The Unfollowed you tab lists people who were in the old followers list but are not in the new one. Accounts that were deleted or deactivated also disappear, so not every name is a person who chose to unfollow.</p></details><details><summary>Is anything saved on my device?</summary><p>Only what you choose. Your export is read in memory and is gone when you close the tab. If you press Save snapshot, or mark accounts as Keep or Unfollowed, those usernames are stored in your own browser storage so they can be used next time. Nothing is sent anywhere, and Delete saved data removes it all.</p></details><details><summary>What do Keep and Unfollowed do?</summary><p>Keep hides an account from your review list, for example a brand or friend you follow on purpose. Unfollowed marks an account you already unfollowed by hand. Turn on Review 10 at a time to go through a small batch, then continue later.</p></details><details><summary>Can it unfollow people for me?</summary><p>No, on purpose. Automatic unfollow tools break the rules of social networks and can get your account limited. Use the Open profile links and unfollow manually, a few at a time.</p></details><details><summary>Does it work for TikTok, X or Facebook?</summary><p>Not yet. This version supports the Instagram data export only, because each network uses a different file format.</p></details><details><summary>Is this tool made by Instagram?</summary><p>No. Boombastis is not affiliated with, endorsed by or connected to Instagram or Meta.</p></details></div>
<div class="related"><h2>Related tools</h2><div><a href="/exif-remover/"><b>EXIF Remover</b><span>Delete photo metadata and GPS.</span></a><a href="/password-strength-checker/"><b>Password Strength</b><span>Test how strong a password is.</span></a><a href="/qr-code-generator/"><b>QR Code</b><span>Turn any link into a QR code.</span></a></div></div>
BOOMEOF

echo "-> src/pages/image-compressor/index.html"
save "src/pages/image-compressor/index.html"
mkdir -p "$(dirname "src/pages/image-compressor/index.html")"
cat > "src/pages/image-compressor/index.html" <<'BOOMEOF'
<!--meta {"url":"/image-compressor/","lang":"en","title":"Free Image Compressor Online: Shrink JPG, PNG and WebP | Boombastis","description":"Compress, resize and convert JPG, PNG, WebP and AVIF images in your browser. Batch ZIP download and before/after compare. Nothing is uploaded.","og":"/og/image-compressor.jpg","ld":["{\"@context\":\"https://schema.org\",\"@type\":\"WebApplication\",\"name\":\"Image Compressor\",\"url\":\"{{ORIGIN}}/image-compressor/\",\"applicationCategory\":\"UtilitiesApplication\",\"operatingSystem\":\"Any\",\"offers\":{\"@type\":\"Offer\",\"price\":\"0\",\"priceCurrency\":\"USD\"},\"inLanguage\":\"en\"}","{\"@context\":\"https://schema.org\",\"@type\":\"FAQPage\",\"mainEntity\":[{\"@type\":\"Question\",\"name\":\"Are my images uploaded anywhere?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"No. Compression runs inside your browser, so your photos never leave your device and nothing is stored on a server.\"}},{\"@type\":\"Question\",\"name\":\"Which format should I choose?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"WebP usually gives the smallest file at similar visual quality and is supported by all modern browsers. Choose JPEG when you need the widest compatibility, for example for old software or some email clients. Choose PNG only when you need lossless output or transparency.\"}},{\"@type\":\"Question\",\"name\":\"Can I resize images too?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Yes. Choose a maximum width from the list, or pick Custom and set a maximum width, a maximum height or both. The aspect ratio is always kept and images are never enlarged.\"}},{\"@type\":\"Question\",\"name\":\"How does the before and after compare work?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Press Compare on any result to see the original and the compressed image in one frame. Drag the slider or use the keyboard to reveal more of either side, and check the file size and pixel dimensions underneath.\"}},{\"@type\":\"Question\",\"name\":\"Can I download many images at once?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Yes. Drop as many images as you like and press Download all (ZIP) when two or more are ready. Use Remove on a single result or Clear to start over.\"}},{\"@type\":\"Question\",\"name\":\"What does Same as original do?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"It keeps each image in its own format (JPEG stays JPEG, PNG stays PNG, WebP stays WebP). Other formats are converted to WebP. AVIF is offered only if your browser can create it.\"}},{\"@type\":\"Question\",\"name\":\"Why did my transparent PNG get a white background?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"JPEG does not support transparency, so transparent areas are filled with white when you export to JPEG. Pick WebP or PNG to keep transparency.\"}},{\"@type\":\"Question\",\"name\":\"Does compression remove photo metadata?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Yes. Re-encoding through the browser drops EXIF data such as camera model and GPS location. That is handy for privacy, but it also means the original capture details are not kept in the compressed copy.\"}},{\"@type\":\"Question\",\"name\":\"What happens to animated GIFs?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Only the first frame is kept, because the image is redrawn on a canvas. Use a dedicated tool if you need to keep the animation.\"}},{\"@type\":\"Question\",\"name\":\"Why is the result sometimes marked as already optimal?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"If the re-encoded file would be larger than the original, the tool shows that the original is already well compressed. Try a lower quality or a smaller maximum width.\"}}]}"],"scripts":["/assets/image.js?v=1"]}-->
<section class="on" id="image">
<h1>Image Compressor</h1><p class="sub">Shrink and convert images right in your browser.</p>
<label class="drop" id="drop"><input id="file" type="file" accept="image/*" multiple><div style="font-size:2rem">💥</div><b>Tap or drop images here</b><small>JPG, PNG, WebP and more. Add as many as you like.</small></label>
<div class="card"><div class="r2">
<label>Output format<select id="fmt"><option value="same">Same as original</option><option value="image/webp" selected>WebP (smallest)</option><option value="image/avif">AVIF (smaller, newer)</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG (lossless)</option></select></label>
<label>Resize<select id="mw"><option value="0">Original size</option><option value="3840">Max width 3840 px</option><option value="1920" selected>Max width 1920 px</option><option value="1280">Max width 1280 px</option><option value="800">Max width 800 px</option><option value="480">Max width 480 px</option><option value="custom">Custom…</option></select></label></div>
<div class="r2" id="cu" hidden><label>Max width (px)<input id="rw" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 1600"></label><label>Max height (px)<input id="rh" type="text" inputmode="numeric" autocomplete="off" placeholder="optional"></label></div>
<label>Quality: <b id="qv">75</b>%<input id="q" type="range" min="10" max="100" value="75"></label>
<small class="tip">Resizing keeps the aspect ratio and never enlarges. Quality does not apply to PNG.</small></div>
<p class="tt-msg" id="prog" role="status"></p>
<div class="sum" id="sum"><div class="n" id="sn"></div><small id="st"></small></div>
<div class="acts" style="margin-bottom:12px"><button class="btn" id="zipb" type="button" hidden>Download all (ZIP)</button><button class="btn alt" id="clr" type="button" hidden>Clear</button></div>
<div id="list"></div>
</section>
<div class="about"><h2>About this tool</h2><p>Large photos slow down websites, fill up email attachments and eat storage. This image compressor shrinks JPG, PNG and WebP files, resizes them, converts between formats (including AVIF where your browser supports it), and does everything on your own device. Pick a format, a size and a quality level, and you get a before-and-after size and a slider to compare the images for every file.</p><h2>How it works</h2><p>Each image is decoded by your browser, resized if it is wider than the limit you chose, and encoded again in the selected format. Quality 70 to 80 is a good starting point for photos: the file gets much smaller and the difference is hard to see. Lower values save more space but add visible artifacts.</p><h2>How to use</h2><ol><li>Drop or choose one or more images.</li><li>Pick a format, a resize option (a preset or your own width and height) and a quality.</li><li>Press Compare to check the result against the original with the slider.</li><li>Download each result, or all of them in one ZIP.</li></ol><h2>Frequently asked questions</h2><details><summary>Are my images uploaded anywhere?</summary><p>No. Compression runs inside your browser, so your photos never leave your device and nothing is stored on a server.</p></details><details><summary>Which format should I choose?</summary><p>WebP usually gives the smallest file at similar visual quality and is supported by all modern browsers. Choose JPEG when you need the widest compatibility, for example for old software or some email clients. Choose PNG only when you need lossless output or transparency.</p></details><details><summary>Why did my transparent PNG get a white background?</summary><p>JPEG does not support transparency, so transparent areas are filled with white when you export to JPEG. Pick WebP or PNG to keep transparency.</p></details><details><summary>Does compression remove photo metadata?</summary><p>Yes. Re-encoding through the browser drops EXIF data such as camera model and GPS location. That is handy for privacy, but it also means the original capture details are not kept in the compressed copy.</p></details><details><summary>What happens to animated GIFs?</summary><p>Only the first frame is kept, because the image is redrawn on a canvas. Use a dedicated tool if you need to keep the animation.</p></details><details><summary>Why is the result sometimes marked as already optimal?</summary><p>If the re-encoded file would be larger than the original, the tool shows that the original is already well compressed. Try a lower quality or a smaller maximum width.</p></details></div>
<div class="related"><h2>Related tools</h2><div><a href="/qr-code-generator/"><b>QR Code Generator</b><span>Make a QR code from a link.</span></a><a href="/hash-generator/"><b>Hash Generator</b><span>MD5 and SHA hashes.</span></a><a href="/word-counter/"><b>Word Counter</b><span>Count words and reading time.</span></a></div></div>
BOOMEOF

echo "-> src/pages/exif-remover/index.html"
save "src/pages/exif-remover/index.html"
mkdir -p "$(dirname "src/pages/exif-remover/index.html")"
cat > "src/pages/exif-remover/index.html" <<'BOOMEOF'
<!--meta {"url":"/exif-remover/","lang":"en","title":"EXIF Remover: Delete Photo Metadata and GPS Location Online | Boombastis","description":"Remove EXIF, GPS location and camera data from JPG, PNG and WebP photos. No quality loss, runs in your browser, nothing is uploaded.","og":"/og/exif-remover.jpg","ld":["{\"@context\":\"https://schema.org\",\"@type\":\"WebApplication\",\"name\":\"EXIF Remover\",\"url\":\"{{ORIGIN}}/exif-remover/\",\"applicationCategory\":\"UtilitiesApplication\",\"operatingSystem\":\"Any\",\"offers\":{\"@type\":\"Offer\",\"price\":\"0\",\"priceCurrency\":\"USD\"},\"inLanguage\":\"en\"}","{\"@context\":\"https://schema.org\",\"@type\":\"FAQPage\",\"mainEntity\":[{\"@type\":\"Question\",\"name\":\"Is my photo uploaded anywhere?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"No. The file is read and rewritten inside your browser, so your photos never leave your device and nothing is stored on a server. You can even switch off your connection after the page has loaded and it will still work.\"}},{\"@type\":\"Question\",\"name\":\"What exactly gets removed?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"For JPEG: EXIF (camera model, lens, serial number, date, GPS location), XMP, IPTC and Photoshop data, comments, and any extra data hidden after the image, which some phones use for depth maps or short video clips. For PNG: EXIF, text chunks (some AI image tools store the full prompt there) and the modified time. For WebP: EXIF and XMP. The colour profile is kept so colours look the same.\"}},{\"@type\":\"Question\",\"name\":\"Does it reduce image quality?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"No. The picture data is copied byte for byte and only the metadata blocks are cut out, so the pixels are identical to the original. This is different from re-saving or compressing the image, which re-encodes it and can add artifacts.\"}},{\"@type\":\"Question\",\"name\":\"Can I resize or convert photos here?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"No, and on purpose: this tool never re-encodes the picture, so its pixels stay exactly as they were. To resize or convert, use the Image Compressor. It re-encodes the image, which also drops metadata, but that changes the pixels and the file size.\"}},{\"@type\":\"Question\",\"name\":\"Why does it keep the rotation by default?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Many phones save photos sideways and use a small orientation flag to turn them upright. If that flag is deleted, some photos show up rotated. The tool keeps only that single flag, which holds no personal information. Untick the option if you want every last tag removed.\"}},{\"@type\":\"Question\",\"name\":\"Which file types are supported?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"JPG, PNG and WebP. HEIC, GIF, TIFF and RAW files are not supported yet. If your browser can open them, the Image Compressor can convert them to JPEG or WebP, which also drops the metadata, but it re-encodes the picture.\"}},{\"@type\":\"Question\",\"name\":\"Does removing metadata make a photo anonymous?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"It removes the hidden data, but not what is visible in the picture, such as faces, street signs or a recognisable view. The file name is also kept except for a -clean suffix, so rename it if the name is personal. After cleaning, the tool scans the new file again and tells you if anything is left.\"}}]}"],"scripts":["/assets/exif.js?v=1"]}-->
<section class="on" id="exif">
<h1>EXIF Remover</h1><p class="sub">Strip GPS location and camera data from photos. Pixels stay untouched.</p>
<label class="drop" id="drop"><input id="file" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple><div style="font-size:2rem">🧹</div><b>Tap or drop photos here</b><small>JPG, PNG and WebP. Multiple files supported.</small></label>
<div class="card"><label class="chk"><input type="checkbox" id="rot" checked> Keep image rotation (recommended)</label><small class="tip">Keeps one tiny orientation flag so phone photos do not turn sideways. Applies to the next files you add.</small></div>
<div class="sum" id="sum"><div class="n" id="sn"></div><small id="st"></small></div>
<div class="acts" style="margin-bottom:12px"><button class="btn" id="zipb" type="button" hidden>Download all (ZIP)</button><button class="btn alt" id="clr" type="button" hidden>Clear</button></div>
<div id="list"></div>
</section>
<div class="about"><h2>About this tool</h2><p>Every photo you take carries a hidden label. It can include the exact GPS spot where you stood, the phone model and its serial number, the time to the second, and the editing app you used. Share the original file and all of that goes along with it. This EXIF remover cuts that data out and leaves the picture itself exactly as it was.</p><h2>How it works</h2><p>Image files are made of blocks. The picture lives in one block and the metadata in others. This tool reads your file, copies the picture blocks as they are, and drops the metadata blocks, so there is no re-compression and no quality loss. Afterwards it scans the new file again and tells you whether anything is left. Click "What was in this file" on a result to see what was removed.</p><h2>How to use</h2><ol><li>Drop or choose one or more JPG, PNG or WebP photos.</li><li>Check the result list: photos that contained a GPS location are flagged.</li><li>Download each clean file, or all of them in one ZIP.</li></ol><h2>Frequently asked questions</h2><details><summary>Is my photo uploaded anywhere?</summary><p>No. The file is read and rewritten inside your browser, so your photos never leave your device and nothing is stored on a server. You can even switch off your connection after the page has loaded and it will still work.</p></details><details><summary>What exactly gets removed?</summary><p>For JPEG: EXIF (camera model, lens, serial number, date, GPS location), XMP, IPTC and Photoshop data, comments, and any extra data hidden after the image, which some phones use for depth maps or short video clips. For PNG: EXIF, text chunks (some AI image tools store the full prompt there) and the modified time. For WebP: EXIF and XMP. The colour profile is kept so colours look the same.</p></details><details><summary>Does it reduce image quality?</summary><p>No. The picture data is copied byte for byte and only the metadata blocks are cut out, so the pixels are identical to the original. This is different from re-saving or compressing the image, which re-encodes it and can add artifacts.</p></details><details><summary>Can I resize or convert photos here?</summary><p>No, and on purpose: this tool never re-encodes the picture, so its pixels stay exactly as they were. To resize or convert, use the Image Compressor. It re-encodes the image, which also drops metadata, but that changes the pixels and the file size.</p></details><details><summary>Why does it keep the rotation by default?</summary><p>Many phones save photos sideways and use a small orientation flag to turn them upright. If that flag is deleted, some photos show up rotated. The tool keeps only that single flag, which holds no personal information. Untick the option if you want every last tag removed.</p></details><details><summary>Which file types are supported?</summary><p>JPG, PNG and WebP. HEIC, GIF, TIFF and RAW files are not supported yet. If your browser can open them, the Image Compressor can convert them to JPEG or WebP, which also drops the metadata, but it re-encodes the picture.</p></details><details><summary>Does removing metadata make a photo anonymous?</summary><p>It removes the hidden data, but not what is visible in the picture, such as faces, street signs or a recognisable view. The file name is also kept except for a -clean suffix, so rename it if the name is personal. After cleaning, the tool scans the new file again and tells you if anything is left.</p></details></div>
<div class="related"><h2>Related tools</h2><div><a href="/image-compressor/"><b>Image Compressor</b><span>Shrink and convert images.</span></a><a href="/user-agent-checker/"><b>Browser Info</b><span>See what your browser reveals.</span></a><a href="/hash-generator/"><b>Hash Generator</b><span>MD5 and SHA hashes.</span></a></div></div>
BOOMEOF

echo "-> assets/site.css"
save "assets/site.css"
cat > /tmp/bb_css_add.txt <<'BOOMEOF'
.nf-demo{margin:2px 0 0;text-align:center}
.nf-link{font:inherit;background:none;border:0;color:var(--text);text-decoration:underline;cursor:pointer;padding:8px;min-height:44px}
.nf-rate{margin:12px 0}.nf-bar{height:10px;border-radius:99px;background:var(--line);overflow:hidden}.nf-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--a),var(--b))}
.nf-rate p,.nf-sub{margin:6px 0 0;font-size:.85rem;color:var(--sub)}
.nf-ctl select{width:auto;max-width:100%}
label.nf-chk{display:flex;flex-direction:row;gap:8px;align-items:center;font-size:.92rem;color:var(--text);min-height:36px}.nf-chk input{width:18px;height:18px;accent-color:var(--a)}
.nf-who{min-width:0;flex:1 1 150px}.nf-who small,.nf-ra small{display:block;color:var(--sub);font-size:.78rem}
.nf-ra{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.nf-mini{font:inherit;font-size:.82rem;font-weight:600;padding:6px 10px;min-height:40px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--text);cursor:pointer}
.nf-mini[aria-pressed=true]{background:var(--text);color:var(--bg)}
@media(max-width:520px){.nf-tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}.nf-tabs button{flex:none;white-space:nowrap}}

.iacts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.iacts .btn{padding:8px 12px;font-size:.88rem;min-height:40px}
.cmpw{flex:1 1 100%}
.cmp{position:relative;width:100%;max-height:70vh;overflow:hidden;border-radius:12px;background:repeating-conic-gradient(var(--line) 0 25%,var(--card) 0 50%) 0 0/16px 16px;touch-action:pan-y;user-select:none;-webkit-user-select:none;cursor:ew-resize}
.cmp img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;border-radius:0}
.cmp .hd{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.4);pointer-events:none}
.cmp .cl{position:absolute;bottom:8px;font-size:.72rem;font-weight:800;color:#fff;background:rgba(0,0,0,.6);padding:2px 8px;border-radius:99px;pointer-events:none}
.cmp .cl.l{left:8px}.cmp .cl.r{right:8px}
.cmpw input[type=range]{width:100%;margin:8px 0 2px}
@media(max-width:520px){.iacts{flex:1 1 100%}.iacts .btn{flex:1 1 30%}}
BOOMEOF

python3 - <<'PYEOF'
p="assets/site.css"; s=open(p,encoding="utf-8").read()
MARK=".nf-demo{margin:2px 0 0;text-align:center}"
if MARK in s: print("   css already patched, skipped")
else:
    for a,b in [('.nf-list li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}','.nf-list li{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px 10px;padding:9px 0;border-bottom:1px solid var(--line)}'),('.item{display:flex;gap:12px;align-items:center;','.item{display:flex;flex-wrap:wrap;gap:12px;align-items:center;')]:
        if a in s: s=s.replace(a,b,1)
        else: print("   WARNING: expected rule not found:",a[:40])
    s=s.rstrip("\n")+"\n"+open("/tmp/bb_css_add.txt",encoding="utf-8").read()
    open(p,"w",encoding="utf-8").write(s); print("   css patched")
PYEOF

echo "-> data/tools.json"
save "data/tools.json"
sed -i 's/Shrink and convert images right in your browser\./Compress, resize and convert images right in your browser./' data/tools.json

echo "Building..."
node scripts/build.mjs
node tests/check.mjs
echo
echo "Done. Backups of replaced files: $BK"
echo "Preview:  python3 -m http.server 8000   (then open port 8000)"
echo "Publish:  git add -A && git commit -m \"Instagram unfollowers + image compressor upgrade\" && git push"
