var THR=(function(){
 function hitung(o){var bulan=o.tahun*12+o.bulan;
  if(bulan<1)return {ok:false,bulan:bulan,thr:0,rumus:"Masa kerja kurang dari 1 bulan terus-menerus: belum berhak THR."};
  var upah=o.upah;
  if(bulan>=12)return {ok:true,bulan:bulan,thr:upah,rumus:"Masa kerja 12 bulan atau lebih: 1 × upah sebulan."};
  return {ok:true,bulan:bulan,thr:Math.round(bulan/12*upah),rumus:"Masa kerja "+bulan+" bulan: ("+bulan+" ÷ 12) × upah sebulan."}}
 function batas(tgl){var d=new Date(tgl+"T00:00:00Z");d.setUTCDate(d.getUTCDate()-7);return d.toISOString().slice(0,10)}
 return {hitung:hitung,batas:batas}})();
if(typeof module!=="undefined")module.exports=THR;
if(typeof document!=="undefined"&&document.getElementById("thrbtn")){
 var $=function(i){return document.getElementById(i)},num=function(i){return Math.max(0,parseFloat(String($(i).value).replace(/\./g,"").replace(",","."))||0)};
 var rp=function(x){return "Rp"+Math.round(x).toLocaleString("id-ID")};
 $("thrjenis").onchange=function(){var h=$("thrjenis").value==="harian";$("thrbulanan").hidden=h;$("thrharian").hidden=!h};
 $("thrbtn").onclick=function(){var o=$("throut");o.innerHTML="";
  var upah=$("thrjenis").value==="harian"?num("thrrata"):num("thrpokok")+num("thrtunj");
  var r=THR.hitung({upah:upah,tahun:num("thrth"),bulan:num("thrbl")});
  var add=function(a,b){var d=document.createElement("div");d.className="row";d.innerHTML="<span></span><b></b>";d.firstChild.textContent=a;d.lastChild.textContent=b;o.appendChild(d)};
  if(!r.ok){add("Hasil",r.rumus);return}
  if(upah<=0){add("Hasil","Isi upah sebulan terlebih dahulu.");return}
  add("Upah sebulan dipakai",rp(upah));add("Masa kerja",r.bulan+" bulan");add("THR",rp(r.thr));add("Rumus",r.rumus);
  var t=$("thrtgl").value;if(t)add("Batas bayar (H-7)",new Date(THR.batas(t)+"T00:00:00Z").toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}))};
}
