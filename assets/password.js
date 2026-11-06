var $=function(i){return document.getElementById(i)};
// ---- Password generator
function gen(){var len=+$("plen").value,set="abcdefghijklmnopqrstuvwxyz";
if($("pu").checked)set+="ABCDEFGHIJKLMNOPQRSTUVWXYZ";if($("pn").checked)set+="0123456789";if($("ps").checked)set+="!@#$%^&*()-_=+[]{};:,.?";
var a=new Uint32Array(len),max=Math.floor(4294967296/set.length)*set.length,o="";
while(o.length<len){crypto.getRandomValues(a);for(var i=0;i<len&&o.length<len;i++)if(a[i]<max)o+=set[a[i]%set.length]}
$("pw").textContent=o}
$("plen").oninput=function(){$("pl").textContent=this.value;gen()};["pu","pn","ps"].forEach(function(i){$(i).onchange=gen});
$("pg").onclick=gen;$("pc").onclick=function(){var b=this;try{navigator.clipboard.writeText($("pw").textContent).then(function(){b.textContent="Copied!";setTimeout(function(){b.textContent="Copy"},1200)})}catch(e){}};

gen();
