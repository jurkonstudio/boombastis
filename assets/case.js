var $=function(i){return document.getElementById(i)};
function words(s){return s.normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/([a-z0-9])([A-Z])/g,"$1 $2").split(/[^A-Za-z0-9]+/).filter(Boolean).map(function(w){return w.toLowerCase()})}
var cap=function(w){return w.charAt(0).toUpperCase()+w.slice(1)};
var F={upper:function(s){return s.toUpperCase()},lower:function(s){return s.toLowerCase()},
title:function(s){return s.toLowerCase().replace(/(^|[\s\-(\["'])(\S)/g,function(m,a,b){return a+b.toUpperCase()})},
sentence:function(s){return s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\S)/g,function(m,a,b){return a+b.toUpperCase()})},
camel:function(s){return words(s).map(function(w,i){return i?cap(w):w}).join("")},
snake:function(s){return words(s).join("_")},kebab:function(s){return words(s).join("-")},slug:function(s){return words(s).join("-")}};
$("cbtns").onclick=function(e){var m=e.target.getAttribute&&e.target.getAttribute("data-m");if(m)$("cout").value=F[m]($("cin").value)};
$("cc").onclick=function(){var o=$("cout");if(!o.value)return;o.select();(navigator.clipboard?navigator.clipboard.writeText(o.value):Promise.reject()).catch(function(){document.execCommand("copy")})};
