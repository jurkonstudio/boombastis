var $=function(i){return document.getElementById(i)};
// ---- Image compressor
var files=[],results=[],timer=null,EXT={"image/webp":"webp","image/jpeg":"jpg","image/png":"png"};
function fmt(n){return n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(2)+" MB"}
function add(l){Array.prototype.forEach.call(l,function(f){if(/^image\//.test(f.type))files.push(f)});run()}
$("file").onchange=function(e){add(e.target.files);e.target.value=""};
var dz=$("drop");["dragover","dragenter"].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.add("on")})});
["dragleave","drop"].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.remove("on")})});
dz.addEventListener("drop",function(e){add(e.dataTransfer.files)});
function sched(){clearTimeout(timer);timer=setTimeout(run,250)}
$("q").oninput=function(){$("qv").textContent=this.value;sched()};$("fmt").onchange=sched;$("mw").onchange=sched;
async function conv(f,type,q,mw){var bmp=await createImageBitmap(f,{imageOrientation:"from-image"}),w=bmp.width,h=bmp.height;
if(mw&&w>mw){h=Math.round(h*mw/w);w=mw}var c=document.createElement("canvas");c.width=w;c.height=h;var x=c.getContext("2d");
if(type==="image/jpeg"){x.fillStyle="#fff";x.fillRect(0,0,w,h)}x.drawImage(bmp,0,0,w,h);
return new Promise(function(r){c.toBlob(r,type,q)})}
async function run(){results.forEach(function(r){URL.revokeObjectURL(r.url)});results=[];
var type=$("fmt").value,q=$("q").value/100,mw=+$("mw").value;
for(var i=0;i<files.length;i++){var f=files[i];try{var b=await conv(f,type,q,mw)||f;
results.push({name:f.name.replace(/\.[^.]+$/,"")+"-boom."+(EXT[b.type]||"png"),orig:f.size,size:b.size,url:URL.createObjectURL(b)})}
catch(e){results.push({name:f.name,orig:f.size,size:f.size,url:URL.createObjectURL(f),err:1})}}render()}
function render(){var L=$("list");L.innerHTML="";var to=0,tn=0;
results.forEach(function(r){to+=r.orig;tn+=Math.min(r.size,r.orig);var p=Math.round((1-r.size/r.orig)*100),d=document.createElement("div");d.className="item";
d.innerHTML='<img alt=""><div class="info"><div class="nm"></div><div class="sz"></div><span class="badge'+(p>0?'':' no')+'"></span></div><a class="btn" download>Download</a>';
d.querySelector("img").src=r.url;d.querySelector(".nm").textContent=r.name;d.querySelector(".sz").textContent=fmt(r.orig)+" → "+fmt(r.size);
d.querySelector(".badge").textContent=r.err?"Could not read":p>0?"BOOM! -"+p+"%":"Already optimal";
var a=d.querySelector("a");a.href=r.url;a.download=r.name;L.appendChild(d)});
var s=$("sum");if(results.length){s.classList.add("show");$("sn").textContent="-"+Math.max(0,Math.round((1-tn/to)*100))+"%";$("st").textContent=results.length+" image(s): "+fmt(to)+" down to "+fmt(tn)}else s.classList.remove("show")}

