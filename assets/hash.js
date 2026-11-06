var $=function(i){return document.getElementById(i)};
// ---- Hash generator (runs only in your browser)
function md5(buf){var K=[],S=[7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21],i;
for(i=0;i<64;i++)K[i]=Math.floor(Math.abs(Math.sin(i+1))*4294967296)>>>0;
var len=buf.length,n=((len+8)>>>6)+1,w=new Uint32Array(n*16);
for(i=0;i<len;i++)w[i>>2]|=buf[i]<<((i%4)*8);w[len>>2]|=0x80<<((len%4)*8);w[n*16-2]=(len*8)>>>0;w[n*16-1]=Math.floor(len*8/4294967296);
var a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
for(var j=0;j<n;j++){var A=a0,B=b0,C=c0,D=d0;
for(i=0;i<64;i++){var F,g;if(i<16){F=(B&C)|(~B&D);g=i}else if(i<32){F=(D&B)|(~D&C);g=(5*i+1)%16}else if(i<48){F=B^C^D;g=(3*i+5)%16}else{F=C^(B|~D);g=(7*i)%16}
F=(F+A+K[i]+w[j*16+g])>>>0;A=D;D=C;C=B;B=(B+((F<<S[i])|(F>>>(32-S[i]))))>>>0}
a0=(a0+A)>>>0;b0=(b0+B)>>>0;c0=(c0+C)>>>0;d0=(d0+D)>>>0}
return[a0,b0,c0,d0].map(function(x){var s="";for(var k=0;k<4;k++)s+=("0"+((x>>>(k*8))&255).toString(16)).slice(-2);return s}).join("")}
function hex(ab){return Array.prototype.map.call(new Uint8Array(ab),function(b){return("0"+b.toString(16)).slice(-2)}).join("")}
var ALG=[["MD5",null],["SHA-1","SHA-1"],["SHA-256","SHA-256"],["SHA-384","SHA-384"],["SHA-512","SHA-512"]],cur=null,seqn=0;
async function hashAll(buf){var id=++seqn,o=$("hout"),up=$("hu").checked,res=[];
for(var i=0;i<ALG.length;i++){var v=ALG[i][1]?hex(await crypto.subtle.digest(ALG[i][1],buf)):md5(new Uint8Array(buf));res.push([ALG[i][0],up?v.toUpperCase():v])}
if(id!==seqn)return;o.textContent="";
res.forEach(function(r){var d=document.createElement("div");d.className="hrow";var k=document.createElement("span");k.textContent=r[0];var v=document.createElement("code");v.textContent=r[1];
var b=document.createElement("button");b.className="cp";b.textContent="Copy";b.onclick=function(){try{navigator.clipboard.writeText(r[1]).then(function(){b.textContent="Copied!";setTimeout(function(){b.textContent="Copy"},1200)})}catch(e){}};
d.appendChild(k);d.appendChild(v);d.appendChild(b);o.appendChild(d)})}
async function fromText(){cur=null;$("fn").textContent="";hashAll(new TextEncoder().encode($("ht").value).buffer)}
$("ht").oninput=fromText;$("hu").onchange=function(){cur?hashAll(cur):fromText()};
$("hf").onchange=async function(e){var f=e.target.files[0];if(!f)return;cur=await f.arrayBuffer();$("fn").textContent=f.name+" ("+f.size+" bytes)";hashAll(cur)};
fromText();
