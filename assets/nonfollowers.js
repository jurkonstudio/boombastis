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
