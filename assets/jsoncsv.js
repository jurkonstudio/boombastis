var JC=(function(){
 function parseCSV(t,d){var rows=[],r=[],f="",q=false,i=0;t=t.replace(/^﻿/,"");
  for(;i<t.length;i++){var c=t[i];
   if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
   else if(c==='"')q=true;
   else if(c===d){r.push(f);f=""}
   else if(c==="\n"||c==="\r"){if(c==="\r"&&t[i+1]==="\n")i++;r.push(f);rows.push(r);r=[];f=""}
   else f+=c}
  if(f!==""||r.length){r.push(f);rows.push(r)}
  return rows.filter(function(x){return !(x.length===1&&x[0]==="")})}
 function conv(v){if(v==="")return v;if(v==="true")return true;if(v==="false")return false;if(v==="null")return null;if(/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v)&&v.length<16)return Number(v);return v}
 function csvToJson(t,d,auto){var rows=parseCSV(t,d);if(!rows.length)return [];var h=rows[0];
  return rows.slice(1).map(function(r){var o={};h.forEach(function(k,i){var v=r[i]===undefined?"":r[i];o[k]=auto?conv(v):v});return o})}
 function flat(o,p,out){Object.keys(o).forEach(function(k){var v=o[k],key=p?p+"."+k:k;
  if(v&&typeof v==="object"&&!Array.isArray(v))flat(v,key,out);else out[key]=v});return out}
 function esc(v,d){if(v===null||v===undefined)return "";if(typeof v==="object")v=JSON.stringify(v);v=String(v);return (v.indexOf(d)>-1||/["\r\n]/.test(v))?'"'+v.replace(/"/g,'""')+'"':v}
 function jsonToCsv(data,d){if(!Array.isArray(data))data=[data];
  var rows=data.map(function(x){return x&&typeof x==="object"&&!Array.isArray(x)?flat(x,"",{}):{value:x}});
  var h=[];rows.forEach(function(r){Object.keys(r).forEach(function(k){if(h.indexOf(k)<0)h.push(k)})});
  return [h.map(function(k){return esc(k,d)}).join(d)].concat(rows.map(function(r){return h.map(function(k){return esc(r[k],d)}).join(d)})).join("\r\n")}
 return {parseCSV:parseCSV,csvToJson:csvToJson,jsonToCsv:jsonToCsv}})();
if(typeof module!=="undefined")module.exports=JC;
if(typeof document!=="undefined"&&document.getElementById("jcin")){
 var $=function(i){return document.getElementById(i)},dl=function(){return $("jcd").value==="tab"?"\t":$("jcd").value};
 var run=function(mode){var m=$("jcmsg");m.textContent="";try{var t=$("jcin").value;
  if(mode==="j2c")$("jcout").value=JC.jsonToCsv(JSON.parse(t),dl());
  else $("jcout").value=JSON.stringify(JC.csvToJson(t,dl(),$("jcauto").checked),null,2)}
  catch(e){$("jcout").value="";m.textContent=mode==="j2c"?"JSON tidak valid: "+e.message:"Gagal membaca CSV: "+e.message}};
 $("jcj2c").onclick=function(){run("j2c")};$("jcc2j").onclick=function(){run("c2j")};
 $("jccopy").onclick=function(){var o=$("jcout");if(!o.value)return;o.select();(navigator.clipboard?navigator.clipboard.writeText(o.value):Promise.reject()).catch(function(){document.execCommand("copy")});$("jcmsg").textContent="Tersalin."};
 $("jcdl").onclick=function(){var o=$("jcout").value;if(!o)return;var j=o.trim().charAt(0)==="[";var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([o],{type:j?"application/json":"text/csv"}));a.download=j?"data.json":"data.csv";a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},1000)};
}
