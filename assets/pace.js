var PC=(function(){
 function fmt(sec){sec=Math.round(sec);var h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60,p=function(x){return x<10?"0"+x:""+x};return (h?h+":"+p(m):m)+":"+p(s)}
 return {fmt:fmt,pace:function(km,sec){return sec/km},time:function(km,pace){return km*pace},dist:function(sec,pace){return sec/pace}}})();
if(typeof module!=="undefined")module.exports=PC;
if(typeof document!=="undefined"&&document.getElementById("pkm")){
 var $=function(i){return document.getElementById(i)},n=function(i){return parseFloat($(i).value.replace(",","."))||0};
 var tsec=function(){return n("ph")*3600+n("pm")*60+n("ps")},psec=function(){return n("ppm")*60+n("pps")};
 function setT(s){s=Math.round(s);$("ph").value=Math.floor(s/3600);$("pm").value=Math.floor(s%3600/60);$("ps").value=s%60}
 function setP(s){s=Math.round(s);$("ppm").value=Math.floor(s/60);$("pps").value=s%60}
 function show(p,km){var o=$("pres");o.innerHTML="";var e=function(a,b){var d=document.createElement("div");d.className="row";d.innerHTML="<span></span><b></b>";d.firstChild.textContent=a;d.lastChild.textContent=b;o.appendChild(d)};
  e("Pace",PC.fmt(p)+" /km");e("Kecepatan",(3600/p).toFixed(2).replace(".",",")+" km/jam");
  [[5,"5K"],[10,"10K"],[21.0975,"Half marathon"],[42.195,"Marathon"]].forEach(function(x){e("Prediksi "+x[1],PC.fmt(PC.time(x[0],p)))});
  $("pmsg").textContent=""}
 var bad=function(t){$("pmsg").textContent=t;$("pres").innerHTML=""};
 $("pc1").onclick=function(){var km=n("pkm"),t=tsec();if(km<=0||t<=0)return bad("Isi jarak dan waktu.");var p=PC.pace(km,t);setP(p);show(p,km)};
 $("pc2").onclick=function(){var km=n("pkm"),p=psec();if(km<=0||p<=0)return bad("Isi jarak dan pace.");setT(PC.time(km,p));show(p,km)};
 $("pc3").onclick=function(){var t=tsec(),p=psec();if(t<=0||p<=0)return bad("Isi waktu dan pace.");var km=PC.dist(t,p);$("pkm").value=km.toFixed(2).replace(".",",");show(p,km)};
 document.querySelectorAll("[data-km]").forEach(function(b){b.onclick=function(){$("pkm").value=b.getAttribute("data-km").replace(".",",")}});
}
