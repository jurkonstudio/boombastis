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
