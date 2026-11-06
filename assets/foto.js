(function(){
 var $=function(i){return document.getElementById(i)};if(!$("fin"))return;
 var url=null;
 function blobAt(c,q){return new Promise(function(r){c.toBlob(r,"image/jpeg",q)})}
 function draw(img,ratio,maxw,scale){
  var sw=img.width,sh=img.height,sx=0,sy=0;
  if(ratio){var tr=ratio[0]/ratio[1];if(sw/sh>tr){var nw=sh*tr;sx=(sw-nw)/2;sw=nw}else{var nh=sw/tr;sy=(sh-nh)/2;sh=nh}}
  var w=sw*scale;if(maxw&&w>maxw)w=maxw;var h=w*sh/sw;
  var c=document.createElement("canvas");c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));
  var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);return c}
 async function fit(img,kb,ratio,maxw){
  var target=kb*1024,scale=1,best=null;
  for(var tries=0;tries<14;tries++){
   var c=draw(img,ratio,maxw,scale),b=await blobAt(c,0.92);
   if(b.size<=target){best=b;var lo=0.92,hi=1;break}
   var l=0.2,h=0.92,ok=null;
   for(var i=0;i<8;i++){var q=(l+h)/2,bb=await blobAt(c,q);if(bb.size<=target){ok=bb;l=q}else h=q}
   if(ok){best=ok;break}
   scale*=0.85;if(c.width<120)break}
  return {blob:best,w:Math.round(img.width*scale)}}
 $("fgo").onclick=async function(){
  var f=$("fin").files[0],m=$("fmsg");if(!f){m.textContent="Pilih foto terlebih dahulu.";return}
  var kb=parseFloat($("fkb").value);if(!(kb>=5)){m.textContent="Isi ukuran target minimal 5 KB.";return}
  var rv=$("frat").value,ratio=rv?rv.split(":").map(Number):null,maxw=parseInt($("fw").value,10)||0;
  m.textContent="Memproses…";$("fgo").disabled=true;
  try{var img=await createImageBitmap(f);var r=await fit(img,kb,ratio,maxw);
   if(!r.blob){m.textContent="Tidak bisa mencapai ukuran itu. Coba target yang lebih besar.";return}
   if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(r.blob);
   var t=document.createElement("canvas");var im=new Image();
   im.onload=function(){$("finfo").textContent=im.naturalWidth+"×"+im.naturalHeight+" px, "+(r.blob.size/1024).toFixed(1).replace(".",",")+" KB (target "+kb+" KB)"};
   im.src=url;$("fprev").src=url;$("fprev").hidden=false;
   var a=$("fdl");a.href=url;a.download=f.name.replace(/\.[^.]+$/,"")+"-"+kb+"kb.jpg";a.hidden=false;m.textContent="Selesai."}
  catch(e){m.textContent="Gagal membaca gambar. Gunakan JPG, PNG, atau WebP."}
  $("fgo").disabled=false};
})();
