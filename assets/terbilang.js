var TB=(function(){
var S=["","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan","sepuluh","sebelas"];
var G=["","ribu","juta","miliar","triliun","kuadriliun","kuintiliun","sekstiliun","septiliun","oktiliun","noniliun","desiliun"];
function b1000(n,seribu){
 if(n<12)return n===1&&seribu?"seribu":S[n];
 if(n<20)return S[n-10]+" belas";
 if(n<100)return S[Math.floor(n/10)]+" puluh"+(n%10?" "+S[n%10]:"");
 if(n<200)return "seratus"+(n>100?" "+b1000(n-100,false):"");
 return S[Math.floor(n/100)]+" ratus"+(n%100?" "+b1000(n%100,false):"")}
function int(str){
 str=str.replace(/^0+(?=\d)/,"");if(str==="0")return "nol";
 var parts=[];while(str.length){parts.unshift(str.slice(-3));str=str.slice(0,-3)}
 var out=[],L=parts.length;
 parts.forEach(function(p,i){var n=parseInt(p,10),g=L-1-i;if(!n)return;
  out.push(g===1&&n===1?"seribu":b1000(n,false)+(G[g]?" "+G[g]:""))});
 return out.join(" ")}
function parse(raw){
 var s=String(raw).trim().replace(/^rp\.?\s*/i,"").replace(/\s+/g,""),neg=false;
 if(s[0]==="-"||s[0]==="−"){neg=true;s=s.slice(1)}
 var ip,dp="";
 if(s.indexOf(",")>-1){var k=s.lastIndexOf(",");ip=s.slice(0,k).replace(/\./g,"");dp=s.slice(k+1)}
 else if(/^\d{1,3}(\.\d{3})+$/.test(s)){ip=s.replace(/\./g,"")}
 else if(/^\d*\.\d+$/.test(s)){var j=s.indexOf(".");ip=s.slice(0,j)||"0";dp=s.slice(j+1)}
 else ip=s;
 if(!/^\d+$/.test(ip||"0")||(dp&&!/^\d+$/.test(dp)))return null;
 ip=ip||"0";if(ip.replace(/^0+/,"").length>33)return null;
 return {neg:neg,ip:ip,dp:dp}}
function say(raw,opt){opt=opt||{};var p=parse(raw);if(!p)return null;
 var t=int(p.ip);
 if(p.dp)t+=" koma "+p.dp.split("").map(function(d){return d==="0"?"nol":S[+d]}).join(" ");
 if(p.neg&&t!=="nol")t="minus "+t;
 if(opt.rupiah)t+=" rupiah";
 if(opt.cap)t=t.charAt(0).toUpperCase()+t.slice(1);
 return t}
return {say:say}})();
if(typeof module!=="undefined")module.exports=TB;
if(typeof document!=="undefined"&&document.getElementById("tbin")){
 var $=function(i){return document.getElementById(i)};
 function up(){var v=$("tbin").value.trim(),o=$("tbout"),m=$("tbmsg");
  if(!v){o.value="";m.textContent="";return}
  var r=TB.say(v,{rupiah:$("tbrp").checked,cap:$("tbcap").checked});
  if(r===null){o.value="";m.textContent="Angka tidak valid. Gunakan digit, titik untuk ribuan dan koma untuk desimal (maks. 33 digit).";return}
  o.value=r;m.textContent=""}
 ["tbin","tbrp","tbcap"].forEach(function(i){$(i).addEventListener("input",up);$(i).addEventListener("change",up)});
 $("tbcopy").onclick=function(){var o=$("tbout");if(!o.value)return;o.select();(navigator.clipboard?navigator.clipboard.writeText(o.value):Promise.reject()).catch(function(){document.execCommand("copy")});$("tbmsg").textContent="Tersalin."};
}
