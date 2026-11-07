var $=function(i){return document.getElementById(i)};
// ---- Boombastis PDF suite: merge, split, organize, compress, JPG<->PDF, text, page numbers, watermark, sign. Runs 100% in the browser.
(function(){
var MODE=$("pdf").getAttribute("data-tool"),PL=window.PDFLib,JZ=window.JSZip,P=null,files=[],busy=false,urls=[];
function fmt(n){return n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(2)+" MB"}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e}
function msg(t,err){var m=$("msg");if(!m)return;m.textContent=t||"";m.className="tt-msg"+(err?" err":"")}
function base(n){return String(n||"file").replace(/\.[^.]+$/,"")}
function pjs(){return P?Promise.resolve(P):import("/assets/vendor/pdf.min.mjs").then(function(m){m.GlobalWorkerOptions.workerSrc="/assets/vendor/pdf.worker.min.mjs";P=m;return m})}
function dl(blob,name){var u=URL.createObjectURL(blob),a=el("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},4000)}
function wait(){return new Promise(function(r){setTimeout(r,0)})}
function toBlob(c,type,q){return new Promise(function(r){c.toBlob(r,type,q)})}
function readFile(f){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result)};r.onerror=function(){rej(r.error)};r.readAsArrayBuffer(f)})}
function isPdf(f){return f.type==="application/pdf"||/\.pdf$/i.test(f.name)}
function isImg(f){return /^image\//.test(f.type)||/\.(jpe?g|png|webp|gif|bmp|avif|svg)$/i.test(f.name)}
function clearRes(){urls.forEach(function(u){URL.revokeObjectURL(u)});urls=[];var r=$("res");if(r)r.textContent=""}
// A finished file: name, size, Download button (+ optional extra note)
function result(blob,name,note,thumb){var r=$("res"),it=el("div","item");
if(thumb){var im=el("img");im.alt="";im.src=thumb;it.appendChild(im)}
var inf=el("div","info");inf.appendChild(el("div","nm",name));inf.appendChild(el("div","sz",fmt(blob.size)+(note?" · "+note:"")));it.appendChild(inf);
var b=el("button","btn","Download");b.type="button";b.onclick=function(){dl(blob,name)};it.appendChild(b);r.appendChild(it);return b}
function err(e){var t=e&&e.message?e.message:String(e);if(/encrypt|password/i.test(t))t="This PDF is password-protected. Remove the password first, then try again.";msg(t,true)}
// Load a PDF with pdf-lib (page count, copying) and keep a copy of the bytes for pdf.js
async function openPdf(f){var ab=await readFile(f),doc;
try{doc=await PL.PDFDocument.load(ab,{updateMetadata:false})}catch(e){if(/encrypt/i.test(e.name+e.message))throw new Error("“"+f.name+"” is password-protected. Remove the password first.");throw new Error("“"+f.name+"” could not be read. It may be damaged or not a PDF.")}
return{file:f,name:f.name,size:f.size,ab:ab,doc:doc,n:doc.getPageCount()}}
async function openJs(ab){var m=await pjs();return m.getDocument({data:new Uint8Array(ab.slice(0))}).promise}
// 1-based page list from text like "1-3, 5, 8-" (open end = last page). Returns array of arrays (one per part).
function ranges(s,n){var out=[];String(s).split(/[,;\s]+/).filter(Boolean).forEach(function(p){var m=p.match(/^(\d*)-(\d*)$/),a,b;
if(m&&(m[1]||m[2])){a=m[1]?+m[1]:1;b=m[2]?+m[2]:n}else if(/^\d+$/.test(p)){a=b=+p}else throw new Error("Cannot read “"+p+"”. Use numbers like 1-3, 5, 8-10.");
if(a<1||b>n||a>b)throw new Error("Pages must be between 1 and "+n+" (got “"+p+"”).");var l=[];for(var i=a;i<=b;i++)l.push(i-1);out.push(l)});
if(!out.length)throw new Error("Type the pages you want, for example 1-3, 5.");return out}
async function sub(src,idx){var d=await PL.PDFDocument.create(),c=await d.copyPages(src,idx);c.forEach(function(p){d.addPage(p)});return d}
function pdfBlob(bytes){return new Blob([bytes],{type:"application/pdf"})}
// Rotation-aware drawing: work in "what you see" coordinates (origin bottom-left, y up) and map to the page's real space
function rot(page){var a=page.getRotation().angle;return((a%360)+360)%360}
function vsize(page){var s=page.getSize(),r=rot(page);return r%180?{w:s.height,h:s.width,r:r}:{w:s.width,h:s.height,r:r}}
function u(page,vx,vy){var s=page.getSize(),W=s.width,H=s.height,r=rot(page);
return r===0?[vx,vy]:r===90?[W-vy,vx]:r===180?[W-vx,H-vy]:[vy,H-vx]}
function hex(h){var n=parseInt(h.replace("#",""),16);return PL.rgb((n>>16&255)/255,(n>>8&255)/255,(n&255)/255)}
// ---------- file intake ----------
var accept=isPdf,multi=false;
function intake(list){var a=Array.prototype.filter.call(list,accept);if(!a.length){msg("That file type is not supported here.",true);return}
if(!multi){files=[];clearRes()}msg("Reading…");
(async function(){try{for(var i=0;i<a.length;i++){files.push(await prep(a[i]))}msg("");await onFiles()}catch(e){err(e)}})()}
var prep=async function(f){return openPdf(f)};
var onFiles=async function(){draw()};
function wire(){var i=$("file"),dz=$("drop");i.onchange=function(e){intake(e.target.files);e.target.value=""};
["dragover","dragenter"].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.add("on")})});
["dragleave","drop"].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.remove("on")})});
dz.addEventListener("drop",function(e){intake(e.dataTransfer.files)})}
function run(fn,btn){return async function(){if(busy)return;if(!files.length){msg("Choose a file first.",true);return}busy=true;btn=btn||$("go");btn.disabled=true;clearRes();
try{await fn()}catch(e){err(e)}busy=false;btn.disabled=false}}
// File list with move up / down / remove
function list(onChange,thumbs){var l=$("list");l.textContent="";files.forEach(function(f,i){var it=el("div","item");
if(thumbs&&f.thumb){var im=el("img");im.alt="";im.src=f.thumb;it.appendChild(im)}
var inf=el("div","info");inf.appendChild(el("div","nm",f.name));inf.appendChild(el("div","sz",(f.n?f.n+(f.n===1?" page · ":" pages · "):"")+fmt(f.size)));it.appendChild(inf);
var a=el("div","iacts");[["↑","Move up",-1],["↓","Move down",1],["✕","Remove",0]].forEach(function(x){var b=el("button","btn alt",x[0]);b.type="button";b.title=x[1];b.setAttribute("aria-label",x[1]+": "+f.name);
b.onclick=function(){if(x[2]===0)files.splice(i,1);else{var j=i+x[2];if(j<0||j>=files.length)return;var t=files[i];files[i]=files[j];files[j]=t}list(onChange,thumbs);onChange&&onChange()};
if(x[2]===-1&&i===0||x[2]===1&&i===files.length-1)b.disabled=true;a.appendChild(b)});it.appendChild(a);l.appendChild(it)});
$("act").hidden=!files.length;if($("cnt"))$("cnt").textContent=files.length?files.length+(files.length===1?" file":" files")+" selected":""}
function draw(){list()}
// Render one page with pdf.js to a canvas
async function render(pg,scale){var vp=pg.getViewport({scale:scale}),c=document.createElement("canvas");c.width=Math.max(1,Math.ceil(vp.width));c.height=Math.max(1,Math.ceil(vp.height));
var ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:ctx,viewport:vp,canvas:c}).promise;return c}
function needZip(){if(!JZ)throw new Error("ZIP library did not load. Reload the page and try again.")}

var M={};
// ===== MERGE =====
M.merge=function(){multi=true;onFiles=async function(){list()};
$("go").onclick=run(async function(){if(files.length<2)throw new Error("Add at least two PDF files to merge.");
var out=await PL.PDFDocument.create(),t=0;
for(var i=0;i<files.length;i++){msg("Merging "+(i+1)+" of "+files.length+"…");var c=await out.copyPages(files[i].doc,files[i].doc.getPageIndices());c.forEach(function(p){out.addPage(p)});t+=c.length;await wait()}
var b=pdfBlob(await out.save());msg("Done. "+t+" pages merged.");result(b,"merged.pdf",t+" pages")})};
// ===== SPLIT =====
M.split=function(){onFiles=async function(){var f=files[0];$("info").textContent=f.name+" · "+f.n+" pages · "+fmt(f.size);$("act").hidden=false;$("opts").hidden=false;opt()};
function opt(){var m=$("smode").value;$("rngw").hidden=!(m==="range"||m==="extract"||m==="remove");$("nw").hidden=m!=="chunk";
$("hint").textContent={range:"Each range becomes its own PDF. Example: 1-3, 5, 8-10 gives 3 files.",extract:"All listed pages are combined into one new PDF.",remove:"The listed pages are removed; everything else is kept in one PDF.",every:"Every page is saved as its own PDF.",chunk:"The file is cut into parts with the page count you choose."}[m]}
$("smode").onchange=opt;
$("go").onclick=run(async function(){var f=files[0],m=$("smode").value,groups=[],n=f.n;
if(m==="range")groups=ranges($("rng").value,n);
else if(m==="extract"){groups=[[].concat.apply([],ranges($("rng").value,n))]}
else if(m==="remove"){var del={};ranges($("rng").value,n).forEach(function(g){g.forEach(function(i){del[i]=1})});var k=[];for(var i=0;i<n;i++)if(!del[i])k.push(i);if(!k.length)throw new Error("You cannot remove every page.");groups=[k]}
else if(m==="every"){for(var i=0;i<n;i++)groups.push([i])}
else{var c=parseInt($("nn").value,10);if(!(c>0))throw new Error("Pages per part must be 1 or more.");for(var s=0;s<n;s+=c){var g=[];for(var j=s;j<Math.min(n,s+c);j++)g.push(j);groups.push(g)}}
var nm=base(f.name),outs=[];
for(var i=0;i<groups.length;i++){msg("Creating file "+(i+1)+" of "+groups.length+"…");var d=await sub(f.doc,groups[i]),g=groups[i],label=g.length===1?"page-"+(g[0]+1):"pages-"+(g[0]+1)+"-"+(g[g.length-1]+1);
if(m==="extract")label="extracted";if(m==="remove")label="edited";outs.push({name:nm+"-"+label+".pdf",bytes:await d.save(),n:g.length});await wait()}
if(outs.length===1){var b=pdfBlob(outs[0].bytes);msg("Done.");result(b,outs[0].name,outs[0].n+" pages");return}
needZip();var z=new JZ();outs.forEach(function(o){z.file(o.name,o.bytes)});var zb=await z.generateAsync({type:"blob"});msg("Done. "+outs.length+" files created.");
result(zb,nm+"-split.zip",outs.length+" PDFs");
if(outs.length<=12)outs.forEach(function(o){result(pdfBlob(o.bytes),o.name,o.n+(o.n===1?" page":" pages"))})})};
// ===== ORGANIZE =====
M.organize=function(){var pages=[],js=null,drag=-1;
onFiles=async function(){var f=files[0];$("act").hidden=true;$("grid").textContent="";pages=[];msg("Loading pages…");js=await openJs(f.ab);
for(var i=0;i<f.n;i++){var pg=await js.getPage(i+1),b=pg.getViewport({scale:1}),c=await render(pg,Math.min(1,260/Math.max(b.width,b.height)));pages.push({i:i,r:0,del:false,c:c,base:((pg.rotate%360)+360)%360});if(i%4===3){show();await wait()}}
msg("");show();$("act").hidden=false};
function show(){var g=$("grid");g.textContent="";var kept=0;pages.forEach(function(p,k){if(!p.del)kept++;
var d=el("div","pg"+(p.del?" del":""));d.draggable=true;d.setAttribute("data-k",k);
var th=el("div","th");var c=p.c;c.style.transform="rotate("+p.r+"deg)";th.appendChild(c);d.appendChild(th);d.appendChild(el("small",null,"Page "+(p.i+1)+(p.r?" · "+p.r+"°":"")+(p.del?" · removed":"")));
var pb=el("div","pb");[["⟲","Rotate left",function(){p.r=(p.r+270)%360}],["⟳","Rotate right",function(){p.r=(p.r+90)%360}],["◀","Move earlier",function(){mv(k,k-1)}],["▶","Move later",function(){mv(k,k+1)}],[p.del?"↩":"🗑",p.del?"Restore page":"Remove page",function(){p.del=!p.del}]].forEach(function(x){var b=el("button",null,x[0]);b.type="button";b.title=x[1];b.setAttribute("aria-label",x[1]+" "+(p.i+1));b.onclick=function(){x[2]();show()};pb.appendChild(b)});
d.appendChild(pb);
d.addEventListener("dragstart",function(e){drag=k;e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setData("text/plain",String(k))}catch(x){}});
d.addEventListener("dragover",function(e){e.preventDefault();d.classList.add("over")});d.addEventListener("dragleave",function(){d.classList.remove("over")});
d.addEventListener("drop",function(e){e.preventDefault();if(drag>-1&&drag!==k)mv(drag,k);drag=-1;show()});g.appendChild(d)});
$("cnt").textContent=kept+" of "+pages.length+" pages will be saved"}
function mv(a,b){if(b<0||b>=pages.length)return;var x=pages.splice(a,1)[0];pages.splice(b,0,x)}
$("rall").onclick=function(){pages.forEach(function(p){p.r=(p.r+90)%360});show()};
$("rst").onclick=function(){var f=files[0];pages.sort(function(a,b){return a.i-b.i});pages.forEach(function(p){p.r=0;p.del=false});show()};
$("rev").onclick=function(){pages.reverse();show()};
$("go").onclick=run(async function(){var f=files[0],keep=pages.filter(function(p){return!p.del});if(!keep.length)throw new Error("Keep at least one page.");
var d=await PL.PDFDocument.create(),c=await d.copyPages(f.doc,keep.map(function(p){return p.i}));
c.forEach(function(pg,k){var cur=pg.getRotation().angle;pg.setRotation(PL.degrees((cur+keep[k].r)%360));d.addPage(pg)});
var b=pdfBlob(await d.save());msg("Done.");result(b,base(f.name)+"-organized.pdf",keep.length+" pages")})};
// ===== COMPRESS =====
M.compress=function(){onFiles=async function(){var f=files[0];$("info").textContent=f.name+" · "+f.n+" pages · "+fmt(f.size);$("act").hidden=false;$("opts").hidden=false};
$("go").onclick=run(async function(){var f=files[0],m=$("cm").value,out,t0=f.size;
if(m==="lossless"){msg("Optimizing…");var d=await PL.PDFDocument.load(f.ab,{updateMetadata:false});d.setProducer("");d.setCreator("");out=await d.save({useObjectStreams:true})}
else{var L={high:[2,.8],med:[1.5,.65],low:[1.1,.5]}[$("lv").value],js=await openJs(f.ab),d=await PL.PDFDocument.create();
for(var i=1;i<=f.n;i++){msg("Compressing page "+i+" of "+f.n+"…");var pg=await js.getPage(i),vp=pg.getViewport({scale:1}),c=await render(pg,L[0]),b=await toBlob(c,"image/jpeg",L[1]),im=await d.embedJpg(await b.arrayBuffer()),np=d.addPage([vp.width,vp.height]);np.drawImage(im,{x:0,y:0,width:vp.width,height:vp.height});c.width=c.height=1;pg.cleanup();await wait()}
out=await d.save()}
var b=pdfBlob(out),pc=Math.round((1-b.size/t0)*100);
if(b.size>=t0){msg("This file is already well optimized. The result is not smaller, so you may keep your original.",true);result(b,base(f.name)+"-compressed.pdf","not smaller than the original");return}
msg("Done. "+fmt(t0)+" → "+fmt(b.size)+" ("+pc+"% smaller).");result(b,base(f.name)+"-compressed.pdf",pc+"% smaller than "+fmt(t0))});
$("cm").onchange=function(){$("lvw").hidden=this.value==="lossless"}};
// ===== IMAGES -> PDF =====
M.img2pdf=function(){multi=true;accept=isImg;prep=async function(f){var bmp=await createImageBitmap(f,{imageOrientation:"from-image"}).catch(function(){throw new Error("“"+f.name+"” could not be opened as an image.")});
var c=document.createElement("canvas"),s=Math.min(1,90/Math.max(bmp.width,bmp.height));c.width=Math.max(1,Math.round(bmp.width*s));c.height=Math.max(1,Math.round(bmp.height*s));c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
return{file:f,name:f.name,size:f.size,thumb:c.toDataURL("image/png"),w:bmp.width,h:bmp.height}};
onFiles=async function(){list(null,true)};
var SZ={a4:[595.28,841.89],a3:[841.89,1190.55],a5:[419.53,595.28],letter:[612,792],legal:[612,1008]};
$("go").onclick=run(async function(){var d=await PL.PDFDocument.create(),ps=$("ps").value,ori=$("or").value,mg=+$("mg").value,q=+$("iq").value;
for(var i=0;i<files.length;i++){msg("Adding image "+(i+1)+" of "+files.length+"…");var f=files[i].file,bmp=await createImageBitmap(f,{imageOrientation:"from-image"}),w=bmp.width,h=bmp.height,s=1;
var cap=q<.8?1800:q<.9?2600:100000;if(Math.max(w,h)>cap)s=cap/Math.max(w,h);
var c=document.createElement("canvas");c.width=Math.round(w*s);c.height=Math.round(h*s);var x=c.getContext("2d"),png=/png|gif|svg|webp/i.test(f.type)||/\.(png|gif|svg|webp)$/i.test(f.name);
if(!png){x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height)}x.drawImage(bmp,0,0,c.width,c.height);
var b=await toBlob(c,png?"image/png":"image/jpeg",q),im=png?await d.embedPng(await b.arrayBuffer()):await d.embedJpg(await b.arrayBuffer()),pw,ph;
if(ps==="fit"){pw=w+mg*2;ph=h+mg*2}else{var z=SZ[ps];pw=z[0];ph=z[1];var land=ori==="land"||(ori==="auto"&&w>h);if(land){var t=pw;pw=ph;ph=t}}
var pg=d.addPage([pw,ph]),aw=pw-mg*2,ah=ph-mg*2,k=Math.min(aw/w,ah/h),dw=w*k,dh=h*k;pg.drawImage(im,{x:(pw-dw)/2,y:(ph-dh)/2,width:dw,height:dh});await wait()}
var b=pdfBlob(await d.save());msg("Done. "+files.length+(files.length===1?" image":" images")+" converted.");result(b,"images.pdf",files.length+" pages")});
$("ps").onchange=function(){$("orw").hidden=this.value==="fit"}};
// ===== PDF -> IMAGES =====
M.pdf2img=function(){onFiles=async function(){var f=files[0];$("info").textContent=f.name+" · "+f.n+" pages · "+fmt(f.size);$("act").hidden=false;$("opts").hidden=false};
$("go").onclick=run(async function(){var f=files[0],js=await openJs(f.ab),n=f.n,sel=[],tp=$("ft").value,ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[tp],sc=+$("dp").value/72,q=+$("qq").value;
var rv=$("pr").value.trim();if(rv){ranges(rv,n).forEach(function(g){g.forEach(function(i){if(sel.indexOf(i)<0)sel.push(i)})});sel.sort(function(a,b){return a-b})}else for(var i=0;i<n;i++)sel.push(i);
var out=[],nm=base(f.name),pad=String(n).length;
for(var k=0;k<sel.length;k++){msg("Converting page "+(k+1)+" of "+sel.length+"…");var pg=await js.getPage(sel[k]+1),vp=pg.getViewport({scale:sc});
if(vp.width*vp.height>1.2e8)throw new Error("Page "+(sel[k]+1)+" is too large at this resolution. Pick a lower DPI.");
var c=await render(pg,sc),b=await toBlob(c,tp,q);if(!b)throw new Error("Your browser cannot save "+ext.toUpperCase()+". Choose another format.");
var name=nm+"-page-"+String(sel[k]+1).padStart(pad,"0")+"."+ext;out.push({name:name,blob:b});
var th=document.createElement("canvas");th.width=60;th.height=Math.max(1,Math.round(60*c.height/c.width));th.getContext("2d").drawImage(c,0,0,th.width,th.height);out[k].th=th.toDataURL("image/jpeg",.7);c.width=c.height=1;pg.cleanup();await wait()}
if(out.length>1){needZip();var z=new JZ();out.forEach(function(o){z.file(o.name,o.blob)});var zb=await z.generateAsync({type:"blob"});msg("Done. "+out.length+" images created.");result(zb,nm+"-images.zip",out.length+" images")}else msg("Done.");
out.forEach(function(o){result(o.blob,o.name,null,o.th)})});
$("ft").onchange=function(){$("qw").hidden=this.value==="image/png"}};
// ===== PDF -> TEXT =====
M.pdf2txt=function(){onFiles=async function(){var f=files[0];$("info").textContent=f.name+" · "+f.n+" pages · "+fmt(f.size);$("act").hidden=false};
$("go").onclick=run(async function(){var f=files[0],js=await openJs(f.ab),sep=$("sep").checked,t="",chars=0;
for(var i=1;i<=f.n;i++){msg("Reading page "+i+" of "+f.n+"…");var pg=await js.getPage(i),tc=await pg.getTextContent(),s="";tc.items.forEach(function(x){s+=x.str+(x.hasEOL?"\n":"")});
s=s.replace(/[ \t]+\n/g,"\n").trim();chars+=s.length;t+=(sep?"--- Page "+i+" ---\n":"")+s+"\n\n";pg.cleanup();await wait()}
t=t.trim();$("txt").hidden=false;$("tact").hidden=false;$("txt").value=t;
if(!chars){msg("No text found. This PDF is probably scanned images, which need OCR (not included).",true);return}
msg("Done. "+t.split(/\s+/).filter(Boolean).length+" words extracted.");$("tact").hidden=false;
$("tdl").onclick=function(){dl(new Blob([t],{type:"text/plain;charset=utf-8"}),base(f.name)+".txt")};
$("tcp").onclick=function(){var b=this;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){b.textContent="Copied";setTimeout(function(){b.textContent="Copy text"},1500)},function(){$("txt").select();document.execCommand("copy")})}})};
// ===== PAGE NUMBERS =====
M.numbers=function(){onFiles=async function(){var f=files[0];$("info").textContent=f.name+" · "+f.n+" pages · "+fmt(f.size);$("act").hidden=false;$("opts").hidden=false};
$("go").onclick=run(async function(){var f=files[0],d=await PL.PDFDocument.load(f.ab,{updateMetadata:false}),font=await d.embedFont(PL.StandardFonts.Helvetica),pos=$("pos").value,fm=$("nf").value,st=parseInt($("st").value,10)||1,sz=+$("fs").value,mg=+$("mg").value,skip=$("sk").checked,col=hex($("cl").value),pgs=d.getPages(),N=pgs.length+st-1;
pgs.forEach(function(pg,i){if(skip&&i===0)return;var n=i+st,t=fm.replace("{n}",n).replace("{N}",N),tw=font.widthOfTextAtSize(t,sz),v=vsize(pg),x,y;
var h=pos.charAt(1);x=h==="l"?mg:h==="c"?(v.w-tw)/2:v.w-mg-tw;y=pos.charAt(0)==="b"?mg:v.h-mg-sz*.75;var p=u(pg,x,y);pg.drawText(t,{x:p[0],y:p[1],size:sz,font:font,color:col,rotate:PL.degrees(v.r)})});
var b=pdfBlob(await d.save());msg("Done.");result(b,base(f.name)+"-numbered.pdf",pgs.length+" pages")})};
// ===== WATERMARK =====
M.watermark=function(){var img=null;onFiles=async function(){var f=files[0];$("info").textContent=f.name+" · "+f.n+" pages · "+fmt(f.size);$("act").hidden=false;$("opts").hidden=false};
$("wt").onchange=function(){var im=this.value==="image",z=$("sz");$("tw").hidden=im;$("iw").hidden=!im;z.min=im?10:16;z.max=im?100:200;z.value=im?50:64;$("szl").textContent=im?"Size (% of page width)":"Font size"};
$("wimg").onchange=function(e){img=e.target.files[0]||null};
$("go").onclick=run(async function(){var f=files[0],d=await PL.PDFDocument.load(f.ab,{updateMetadata:false}),isI=$("wt").value==="image",op=+$("op").value/100,ang=+$("an").value,tile=$("tl").checked,sz=+$("sz").value,col=hex($("cl").value),font=null,im=null,text=$("wx").value;
if(isI){if(!img)throw new Error("Choose an image first (PNG or JPG).");var bb=await readFile(img);im=/png/i.test(img.type)?await d.embedPng(bb):await d.embedJpg(bb)}
else{if(!text.trim())throw new Error("Type the watermark text.");font=await d.embedFont(PL.StandardFonts.HelveticaBold);try{font.widthOfTextAtSize(text,10)}catch(e){throw new Error("Standard fonts support Latin letters only. Remove emoji or non-Latin characters, or use an image watermark.")}}
d.getPages().forEach(function(pg){var v=vsize(pg),w,h,spots=[];
if(isI){var s=sz/100*v.w/im.width;w=im.width*s;h=im.height*s}else{w=font.widthOfTextAtSize(text,sz);h=sz*.72}
if(tile){var gx=w*1.6+40,gy=h*4+60;for(var y=gy/2;y<v.h+gy;y+=gy)for(var x=gx/2;x<v.w+gx;x+=gx)spots.push([x-gx/4,y-gy/4])}else spots.push([v.w/2,v.h/2]);
spots.forEach(function(c){var a=ang*Math.PI/180,bx=c[0]-(w/2*Math.cos(a)-h/2*Math.sin(a)),by=c[1]-(w/2*Math.sin(a)+h/2*Math.cos(a)),p=u(pg,bx,by);
if(isI)pg.drawImage(im,{x:p[0],y:p[1],width:w,height:h,rotate:PL.degrees(ang+v.r),opacity:op});else pg.drawText(text,{x:p[0],y:p[1],size:sz,font:font,color:col,opacity:op,rotate:PL.degrees(ang+v.r)})})});
var b=pdfBlob(await d.save());msg("Done.");result(b,base(f.name)+"-watermarked.pdf",d.getPageCount()+" pages")})};
// ===== SIGN =====
M.sign=function(){var js=null,cur=1,fx=.7,fy=.85,sigC=null,sigURL=null,tab="draw",dr=false,lx=0,ly=0,pc=$("sg"),px=pc.getContext("2d"),vw=null;
function setTab(t){tab=t;["draw","type","up"].forEach(function(k){$("t-"+k).setAttribute("aria-pressed",k===t?"true":"false");$("p-"+k).hidden=k!==t});if(t==="type")typed()}
["draw","type","up"].forEach(function(k){$("t-"+k).onclick=function(){setTab(k)}});
function pos(e){var r=pc.getBoundingClientRect();return[(e.clientX-r.left)*pc.width/r.width,(e.clientY-r.top)*pc.height/r.height]}
pc.width=640;pc.height=200;px.lineWidth=3.2;px.lineCap=px.lineJoin="round";px.strokeStyle="#111";
pc.addEventListener("pointerdown",function(e){dr=true;pc.setPointerCapture(e.pointerId);var p=pos(e);lx=p[0];ly=p[1];px.beginPath();px.arc(lx,ly,1.6,0,7);px.fill();e.preventDefault()});
pc.addEventListener("pointermove",function(e){if(!dr)return;var p=pos(e);px.beginPath();px.moveTo(lx,ly);px.lineTo(p[0],p[1]);px.stroke();lx=p[0];ly=p[1]});
["pointerup","pointercancel"].forEach(function(t){pc.addEventListener(t,function(){if(dr){dr=false;grab()}})});
$("sclr").onclick=function(){px.clearRect(0,0,pc.width,pc.height);sigC=null;sigURL=null;box()};
function trim(c){var x=c.getContext("2d"),d=x.getImageData(0,0,c.width,c.height).data,a=c.width,b=c.height,e=0,f=0;
for(var y=0;y<c.height;y++)for(var i=0;i<c.width;i++)if(d[(y*c.width+i)*4+3]>10){if(i<a)a=i;if(i>e)e=i;if(y<b)b=y;if(y>f)f=y}
if(e<a)return null;var o=document.createElement("canvas");o.width=e-a+1;o.height=f-b+1;o.getContext("2d").drawImage(c,a,b,o.width,o.height,0,0,o.width,o.height);return o}
function grab(){sigC=trim(pc);sigURL=sigC?sigC.toDataURL("image/png"):null;box()}
function typed(){var t=$("tx").value.trim()||"",c=document.createElement("canvas");c.width=900;c.height=220;var x=c.getContext("2d");x.fillStyle="#111";x.font="italic 600 110px 'Segoe Script','Brush Script MT','Snell Roundhand',cursive";x.textBaseline="middle";x.fillText(t,20,110,860);sigC=t?trim(c):null;sigURL=sigC?sigC.toDataURL("image/png"):null;box()}
$("tx").oninput=typed;
$("sup").onchange=async function(e){var f=e.target.files[0];if(!f)return;var bmp=await createImageBitmap(f),c=document.createElement("canvas"),s=Math.min(1,800/bmp.width);c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);var x=c.getContext("2d");x.drawImage(bmp,0,0,c.width,c.height);
var d=x.getImageData(0,0,c.width,c.height),a=d.data;if($("wh").checked)for(var i=0;i<a.length;i+=4){var l=(a[i]+a[i+1]+a[i+2])/3;if(l>200){a[i+3]=0}else if(l>140)a[i+3]=Math.round(a[i+3]*(200-l)/60)}x.putImageData(d,0,0);sigC=trim(c);sigURL=sigC?sigC.toDataURL("image/png"):null;box()};
$("wh").onchange=function(){var f=$("sup").files[0];if(f)$("sup").onchange({target:{files:[f]}})};
onFiles=async function(){var f=files[0];js=await openJs(f.ab);cur=1;$("opts").hidden=false;$("act").hidden=false;$("pn").max=f.n;$("pn").value=1;$("pof").textContent="of "+f.n;await page()};
async function page(){msg("Loading page…");var pg=await js.getPage(cur),vp=pg.getViewport({scale:1}),c=await render(pg,Math.min(2,900/vp.width));var w=$("pvw");vw=c;[].slice.call(w.querySelectorAll("canvas")).forEach(function(x){x.remove()});w.insertBefore(c,w.firstChild);msg("");box()}
$("pn").onchange=async function(){var v=parseInt(this.value,10)||1;cur=Math.max(1,Math.min(files[0].n,v));this.value=cur;await page()};
function box(){var b=$("sbox");if(!sigURL||!vw){b.hidden=true;return}var w=$("pvw"),W=w.clientWidth,bw=+$("ss").value/100*W,bh=bw*sigC.height/sigC.width;b.hidden=false;b.style.width=bw+"px";b.style.height=bh+"px";
fx=Math.max(bw/2/W,Math.min(1-bw/2/W,fx));var H=w.clientHeight;fy=Math.max(bh/2/H,Math.min(1-bh/2/H,fy));b.style.left=(fx*W-bw/2)+"px";b.style.top=(fy*H-bh/2)+"px";$("sim").src=sigURL}
$("ss").oninput=box;window.addEventListener("resize",box);
var mv=false;function mvto(e){var r=$("pvw").getBoundingClientRect();fx=(e.clientX-r.left)/r.width;fy=(e.clientY-r.top)/r.height;box()}
$("pvw").addEventListener("pointerdown",function(e){if(!sigURL)return;mv=true;this.setPointerCapture(e.pointerId);mvto(e);e.preventDefault()});
$("pvw").addEventListener("pointermove",function(e){if(mv)mvto(e)});["pointerup","pointercancel"].forEach(function(t){$("pvw").addEventListener(t,function(){mv=false})});
$("go").onclick=run(async function(){if(!sigURL)throw new Error("Create your signature first (step 2).");var f=files[0],d=await PL.PDFDocument.load(f.ab,{updateMetadata:false}),im=await d.embedPng(Uint8Array.from(atob(sigURL.split(",")[1]),function(c){return c.charCodeAt(0)})),sc=$("sc").value,pgs=d.getPages(),idx=[];
if(sc==="all")pgs.forEach(function(p,i){idx.push(i)});else if(sc==="last")idx=[pgs.length-1];else if(sc==="first")idx=[0];else idx=[cur-1];
idx.forEach(function(i){var pg=pgs[i],v=vsize(pg),w=+$("ss").value/100*v.w,h=w*im.height/im.width,cc=u(pg,fx*v.w,v.h-fy*v.h),a=v.r*Math.PI/180;
// pdf-lib rotates around the image corner, so move the corner such that the image CENTER lands where the user placed it
pg.drawImage(im,{x:cc[0]-(w/2*Math.cos(a)-h/2*Math.sin(a)),y:cc[1]-(w/2*Math.sin(a)+h/2*Math.cos(a)),width:w,height:h,rotate:PL.degrees(v.r)})});
var b=pdfBlob(await d.save());msg("Done. Signature added to "+idx.length+(idx.length===1?" page.":" pages."));result(b,base(f.name)+"-signed.pdf",idx.length+(idx.length===1?" page":" pages")+" signed")});
setTab("draw")};

wire();(M[MODE]||function(){})();
})();
