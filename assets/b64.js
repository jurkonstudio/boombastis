var $=function(i){return document.getElementById(i)};
function enc(s,u){var b=new TextEncoder().encode(s),r="";for(var i=0;i<b.length;i++)r+=String.fromCharCode(b[i]);r=btoa(r);return u?r.replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""):r}
function dec(s){s=s.trim().replace(/-/g,"+").replace(/_/g,"/").replace(/\s+/g,"");while(s.length%4)s+="=";var r=atob(s),b=new Uint8Array(r.length);for(var i=0;i<r.length;i++)b[i]=r.charCodeAt(i);return new TextDecoder("utf-8",{fatal:true}).decode(b)}
$("be").onclick=function(){$("bmsg").textContent="";$("bout").value=enc($("bin").value,$("bu").checked)};
$("bd").onclick=function(){try{$("bout").value=dec($("bin").value);$("bmsg").textContent=""}catch(e){$("bout").value="";$("bmsg").textContent="Could not decode. Check that the input is valid Base64 text."}};
$("bc").onclick=function(){var o=$("bout");if(!o.value)return;o.select();(navigator.clipboard?navigator.clipboard.writeText(o.value):Promise.reject()).catch(function(){document.execCommand("copy")});$("bmsg").textContent="Copied."};
