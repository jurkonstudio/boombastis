var $=function(i){return document.getElementById(i)};
// ---- QR generator
function drawQR(){var t=$("qt").value||" ",n=+$("qs").value,c=$("qc");
try{var q=qrcode(0,$("qe").value);q.addData(t);q.make();var m=q.getModuleCount(),pad=4,cell=Math.floor(n/(m+pad*2)),sz=cell*(m+pad*2);
c.width=c.height=sz;var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,sz,sz);x.fillStyle="#000";
for(var r=0;r<m;r++)for(var k=0;k<m;k++)if(q.isDark(r,k))x.fillRect((k+pad)*cell,(r+pad)*cell,cell,cell);
$("qd").href=c.toDataURL("image/png")}catch(e){}}
["qt","qs","qe"].forEach(function(i){$(i).addEventListener("input",drawQR)});

drawQR();
