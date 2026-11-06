var $=function(i){return document.getElementById(i)};
// ---- Word counter
$("wt").oninput=function(){var t=this.value,w=(t.trim().match(/\S+/g)||[]).length;
$("w1").textContent=w;$("w2").textContent=t.length;$("w3").textContent=t.replace(/\s/g,"").length;$("w4").textContent=(w?Math.max(1,Math.round(w/200)):0)+" min"};
