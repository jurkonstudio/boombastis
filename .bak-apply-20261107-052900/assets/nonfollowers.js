var $=function(i){return document.getElementById(i)};
(function(){
var WANT=/(^|\/)(followers(_\d+)?|following)\.(json|html?)$/i,CHUNK=100,MAXZIP=300*1024*1024;
var data=null,tab="notback",shown=0,view=[];
function msg(t,bad){var m=$("nfMsg");m.textContent=t;m.className="tt-msg"+(bad?" nf-bad":"")}
function user(h){var m=/instagram\.com\/(?:_u\/)?([A-Za-z0-9._]{1,30})(?:[\/?#]|$)/i.exec(h||"");return m?m[1]:""}
function clean(n){n=String(n||"").trim().replace(/^@/,"");return /^[A-Za-z0-9._]{1,30}$/.test(n)?n.toLowerCase():""}
function fromJson(j,set){(function walk(x){
if(Array.isArray(x)){x.forEach(walk);return}
if(x&&typeof x==="object"){
if(Array.isArray(x.string_list_data)){x.string_list_data.forEach(function(s){var n=clean(s&&s.value)||clean(x.title)||clean(user(s&&s.href));if(n)set.add(n)});return}
Object.keys(x).forEach(function(k){walk(x[k])})}})(j)}
function fromHtml(t,set){var d=new DOMParser().parseFromString(t,"text/html");
[].forEach.call(d.querySelectorAll("a[href]"),function(a){var n=clean(user(a.getAttribute("href")))||clean(a.textContent);if(n)set.add(n)})}
function kind(name){var b=name.split("/").pop().toLowerCase();return b.indexOf("following")===0?"following":"followers"}
function parse(name,text,acc){var k=kind(name),set=acc[k];
if(/\.json$/i.test(name)){try{fromJson(JSON.parse(text),set)}catch(e){throw new Error(name+" is not valid JSON.")}}else fromHtml(text,set);acc.files++}
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
async function load(files){var acc={followers:new Set(),following:new Set(),files:0};msg("Reading files…");
try{for(var f of files){
if(/\.zip$/i.test(f.name)){if(f.size>MAXZIP)throw new Error("That ZIP is very large. Unzip it and upload only the followers and following files.");await readZip(await f.arrayBuffer(),acc)}
else if(WANT.test(f.name))parse(f.name,await f.text(),acc)}}
catch(e){msg(e.message||"Could not read the files.",true);return}
if(!acc.files){msg("No followers or following file found. Upload followers_1.json and following.json (or the ZIP you downloaded from Instagram).",true);return}
if(!acc.followers.size||!acc.following.size){msg((acc.followers.size?"The following file is missing or empty.":"The followers file is missing or empty.")+" Upload both to compare.",true);return}
data=acc;tab="notback";msg("");render()}
function sets(){var A=data.following,B=data.followers,nb=[],fb=[],mu=[];
A.forEach(function(u){(B.has(u)?mu:nb).push(u)});B.forEach(function(u){if(!A.has(u))fb.push(u)});
[nb,fb,mu].forEach(function(x){x.sort()});return{notback:nb,fans:fb,mutual:mu}}
function render(){var S=sets();data.S=S;
$("nfRes").hidden=false;
$("nfFollowing").textContent=data.following.size;$("nfFollowers").textContent=data.followers.size;$("nfNotBack").textContent=S.notback.length;$("nfFans").textContent=S.fans.length;
var names={notback:"Not following you back",fans:"You don't follow back",mutual:"Mutual"};
[].forEach.call($("nfTabs").children,function(b){var k=b.getAttribute("data-t");b.textContent=names[k]+" ("+S[k].length+")";b.setAttribute("aria-pressed",k===tab?"true":"false")});
list()}
function list(){var q=$("nfQ").value.trim().toLowerCase().replace(/^@/,"");
view=data.S[tab].filter(function(u){return !q||u.indexOf(q)>-1});shown=0;$("nfList").innerHTML="";more();
$("nfEmpty").hidden=view.length>0;$("nfEmpty").textContent=data.S[tab].length?"No account matches your search.":"Nothing here."}
function more(){var ul=$("nfList"),end=Math.min(view.length,shown+CHUNK);
for(var i=shown;i<end;i++){var u=view[i],li=document.createElement("li"),s=document.createElement("span"),a=document.createElement("a");
s.textContent=u;a.textContent="Open profile";a.href="https://www.instagram.com/"+encodeURIComponent(u)+"/";a.target="_blank";a.rel="noopener noreferrer";
a.setAttribute("aria-label","Open profile of "+u);li.appendChild(s);li.appendChild(a);ul.appendChild(li)}
shown=end;$("nfMore").hidden=shown>=view.length;$("nfMore").textContent="Show more ("+(view.length-shown)+" left)"}
$("nfFile").addEventListener("change",function(){var f=[].slice.call(this.files);if(f.length)load(f);this.value=""});
var drop=$("nfDrop");["dragenter","dragover"].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add("on")})});
["dragleave","drop"].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove("on")})});
drop.addEventListener("drop",function(e){var f=[].slice.call(e.dataTransfer.files);if(f.length)load(f)});
$("nfTabs").addEventListener("click",function(e){var b=e.target.closest("button");if(!b||!data)return;tab=b.getAttribute("data-t");render()});
$("nfQ").addEventListener("input",function(){if(data)list()});
$("nfMore").onclick=more;
$("nfCopy").onclick=function(){if(!data)return;var t=view.join("\n");
if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){msg("Copied "+view.length+" usernames.")},function(){msg("Copy failed. Use Download CSV instead.",true)});else msg("Copy is not available here. Use Download CSV instead.",true)};
$("nfCsv").onclick=function(){if(!data)return;var rows=["username,profile_url"].concat(view.map(function(u){return u+",https://www.instagram.com/"+u+"/"}));
var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([rows.join("\n")+"\n"],{type:"text/csv"}));a.download="instagram-"+tab+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},2000)};
$("nfClear").onclick=function(){data=null;$("nfRes").hidden=true;$("nfList").innerHTML="";$("nfQ").value="";msg("")};
})();
