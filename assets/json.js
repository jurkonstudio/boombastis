var $=function(i){return document.getElementById(i)};
function run(min){var m=$("jmsg");try{var v=JSON.parse($("jin").value);$("jout").value=min?JSON.stringify(v):JSON.stringify(v,null,2);m.textContent="Valid JSON."}catch(e){$("jout").value="";m.textContent="Invalid JSON: "+e.message}}
$("jf").onclick=function(){run(false)};$("jm").onclick=function(){run(true)};
$("jc").onclick=function(){var o=$("jout");if(!o.value)return;o.select();(navigator.clipboard?navigator.clipboard.writeText(o.value):Promise.reject()).catch(function(){document.execCommand("copy")});$("jmsg").textContent="Copied."};
