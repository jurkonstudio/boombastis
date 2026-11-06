var UM=(function(){
 var HARI=["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"],PAS=["Legi","Pahing","Pon","Wage","Kliwon"];
 var utc=function(s){var p=s.split("-");return Date.UTC(+p[0],+p[1]-1,+p[2])};
 var dim=function(y,m){return new Date(Date.UTC(y,m+1,0)).getUTCDate()};
 function diff(a,b){ // a<=b strings YYYY-MM-DD
  var A=a.split("-").map(Number),B=b.split("-").map(Number);
  var months=(B[0]-A[0])*12+(B[1]-A[1]);
  var anchor=function(mo){var t=A[1]-1+mo,y=A[0]+Math.floor(t/12),m=((t%12)+12)%12;return Date.UTC(y,m,Math.min(A[2],dim(y,m)))};
  if(anchor(months)>utc(b))months--;
  return {y:Math.floor(months/12),m:months%12,d:Math.round((utc(b)-anchor(months))/864e5),days:Math.round((utc(b)-utc(a))/864e5)}}
 function weton(s){var days=Math.round(utc(s)/864e5);var w=new Date(utc(s)).getUTCDay();return HARI[w]+" "+PAS[(((days+3)%5)+5)%5]}
 function nextBirthday(dob,today){var D=dob.split("-").map(Number),T=today.split("-").map(Number);
  var mk=function(y){var d=D[2],m=D[1];if(m===2&&d===29&&dim(y,1)<29)d=28;return y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0")};
  var n=mk(T[0]);if(n<today)n=mk(T[0]+1);return n}
 return {diff:diff,weton:weton,nextBirthday:nextBirthday,HARI:HARI}})();
if(typeof module!=="undefined")module.exports=UM;
if(typeof document!=="undefined"&&document.getElementById("umbtn")){
 var $=function(i){return document.getElementById(i)};
 var iso=function(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
 $("umto").value=iso(new Date());
 var fm=function(s){return new Date(s+"T00:00:00Z").toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})};
 $("umbtn").onclick=function(){var a=$("umfrom").value,b=$("umto").value,o=$("umout");o.innerHTML="";
  var add=function(x,y){var d=document.createElement("div");d.className="row";d.innerHTML="<span></span><b></b>";d.firstChild.textContent=x;d.lastChild.textContent=y;o.appendChild(d)};
  if(!a||!b){add("Hasil","Isi kedua tanggal.");return}
  var rev=a>b;if(rev){var t=a;a=b;b=t}
  var r=UM.diff(a,b),n=Number;
  add("Selisih",r.y+" tahun "+r.m+" bulan "+r.d+" hari");
  add("Total hari",r.days.toLocaleString("id-ID")+" hari");
  add("Total minggu",Math.floor(r.days/7).toLocaleString("id-ID")+" minggu "+r.days%7+" hari");
  add("Total bulan",(r.y*12+r.m).toLocaleString("id-ID")+" bulan");
  if($("umnote").checked){add("Hari lahir",fm(a));add("Weton",UM.weton(a));
   var nb=UM.nextBirthday(a,b);add("Ulang tahun berikutnya",fm(nb)+" ("+UM.diff(b,nb).days+" hari lagi)")}
  if(rev)add("Catatan","Tanggal ditukar agar urutannya benar.")}
}
