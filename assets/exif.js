var $=function(i){return document.getElementById(i)};
// ---- Metadata remover: JPEG, PNG and WebP are rewritten byte for byte, pixels are never re-encoded.
var results=[];
function fmt(n){return n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(2)+" MB"}
function ascii(u,a,b){var s="";for(var i=a;i<b&&i<u.length;i++)s+=String.fromCharCode(u[i]);return s}
function cat(list){var n=0,i;for(i=0;i<list.length;i++)n+=list[i].length;var o=new Uint8Array(n),p=0;for(i=0;i<list.length;i++){o.set(list[i],p);p+=list[i].length}return o}
function sniff(u){
  if(u.length>3&&u[0]===0xFF&&u[1]===0xD8&&u[2]===0xFF)return"jpeg";
  if(u.length>8&&u[0]===0x89&&ascii(u,1,4)==="PNG")return"png";
  if(u.length>12&&ascii(u,0,4)==="RIFF"&&ascii(u,8,12)==="WEBP")return"webp";
  return"";
}

// ---- TIFF/EXIF reader (only used to show what was found)
function parseTiff(u,base){
  var dv=new DataView(u.buffer,u.byteOffset,u.byteLength),len=u.length;
  if(base+8>len)return null;
  var bo=dv.getUint16(base),le;
  if(bo===0x4949)le=true;else if(bo===0x4D4D)le=false;else return null;
  if(dv.getUint16(base+2,le)!==42)return null;
  var SZ={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8};
  function val(type,cnt,e){
    var sz=(SZ[type]||1)*cnt,o=sz>4?base+dv.getUint32(e+8,le):e+8;
    if(cnt>256||o<0||o+sz>len)return null;
    if(type===2)return ascii(u,o,o+cnt).replace(/\0+$/,"").trim();
    var out=[],i;
    for(i=0;i<cnt;i++){
      if(type===3)out.push(dv.getUint16(o+i*2,le));
      else if(type===4)out.push(dv.getUint32(o+i*4,le));
      else if(type===5){var d=dv.getUint32(o+i*8+4,le);out.push(d?dv.getUint32(o+i*8,le)/d:0)}
      else if(type===1||type===7)out.push(u[o+i]);
      else return null;
    }
    return cnt===1?out[0]:out;
  }
  function ifd(off,store){
    var p=base+off;if(off<8||p+2>len)return;
    var n=dv.getUint16(p,le),i;if(n>200)n=200;
    for(i=0;i<n;i++){var e=p+2+i*12;if(e+12>len)break;store[dv.getUint16(e,le)]=val(dv.getUint16(e+2,le),dv.getUint32(e+4,le),e)}
  }
  var t0={},tx={},tg={};
  ifd(dv.getUint32(base+4,le),t0);
  if(typeof t0[0x8769]==="number")ifd(t0[0x8769],tx);
  if(typeof t0[0x8825]==="number")ifd(t0[0x8825],tg);
  return{t0:t0,tx:tx,tg:tg};
}
function dms(a,ref){if(!a||a.length<3||typeof a==="number")return null;var v=a[0]+a[1]/60+a[2]/3600;return(ref==="S"||ref==="W"?-1:1)*v}
function describeTiff(t,found){
  var rows=[],t0=t.t0,tx=t.tx,tg=t.tg,s=function(x){return typeof x==="string"&&x?x:""};
  var cam=(s(t0[0x010F])+" "+s(t0[0x0110])).trim();if(cam)rows.push(["Camera",cam]);
  if(s(tx[0xA434]))rows.push(["Lens",s(tx[0xA434])]);
  var when=s(tx[0x9003])||s(t0[0x0132]);if(when)rows.push(["Date taken",when]);
  if(s(t0[0x0131]))rows.push(["Software",s(t0[0x0131])]);
  if(s(t0[0x013B]))rows.push(["Artist",s(t0[0x013B])]);
  if(s(t0[0x8298]))rows.push(["Copyright",s(t0[0x8298])]);
  if(s(t0[0x010E]))rows.push(["Description",s(t0[0x010E])]);
  if(s(tx[0xA431]))rows.push(["Camera serial",s(tx[0xA431])]);
  var lat=dms(tg[2],tg[1]),lon=dms(tg[4],tg[3]);
  if(lat!==null&&lon!==null){rows.push(["GPS location",lat.toFixed(5)+", "+lon.toFixed(5)]);found.gps=true}
  if(typeof tg[6]==="number")rows.push(["GPS altitude",Math.round(tg[6])+" m"]);
  if(typeof t0[0x0112]==="number")found.orient=t0[0x0112];
  return rows;
}

// ---- inspect: what metadata does this file hold?
function inspect(u,kind){
  var f={kinds:[],rows:[],gps:false,orient:1},i,n=u.length;
  if(kind==="jpeg"){
    i=2;
    while(i+3<n){
      if(u[i]!==0xFF){i++;continue}
      var m=u[i+1];
      if(m===0xFF){i++;continue}
      if(m===0xD9||m===0xDA)break;
      if(m===0x00||m===0x01||(m>=0xD0&&m<=0xD8)){i+=2;continue}
      var L=(u[i+2]<<8)|u[i+3],end=i+2+L;if(L<2||end>n)break;
      if(m===0xE1&&ascii(u,i+4,i+10)==="Exif\0\0"){
        f.kinds.push("EXIF");var t=parseTiff(u,i+10);if(t)f.rows=f.rows.concat(describeTiff(t,f));
      }else if(m===0xE1)f.kinds.push("XMP");
      else if(m===0xED)f.kinds.push("IPTC / Photoshop");
      else if(m===0xFE)f.kinds.push("Comment");
      else if(m===0xE2&&ascii(u,i+4,i+7)==="MPF")f.kinds.push("Multi-picture data");
      else if(m>=0xE3&&m<=0xEF&&m!==0xEE)f.kinds.push("Other app data");
      i=end;
    }
    // data after the first end-of-image marker (e.g. a hidden second photo or video)
    var first=findEoi(u);if(first>0&&first+2<n)f.kinds.push("Extra data after image ("+fmt(n-first-2)+")");
  }else if(kind==="png"){
    i=8;
    var txt=[];
    while(i+8<=n){
      var cl=((u[i]<<24)|(u[i+1]<<16)|(u[i+2]<<8)|u[i+3])>>>0,ty=ascii(u,i+4,i+8);
      if(ty==="eXIf"){f.kinds.push("EXIF");var tt=parseTiff(u,i+8);if(tt)f.rows=f.rows.concat(describeTiff(tt,f))}
      else if(ty==="tEXt"||ty==="iTXt"||ty==="zTXt"){var z=i+8;while(z<i+8+cl&&u[z]!==0)z++;txt.push(ascii(u,i+8,Math.min(z,i+8+40)))}
      else if(ty==="tIME")f.kinds.push("Modified time");
      if(ty==="IEND")break;
      i+=12+cl;
    }
    if(txt.length)f.kinds.push("Text chunks: "+txt.slice(0,6).join(", ")+(txt.length>6?"…":""));
  }else if(kind==="webp"){
    i=12;
    while(i+8<=n){
      var wt=ascii(u,i,i+4),ws=(u[i+4]|(u[i+5]<<8)|(u[i+6]<<16)|(u[i+7]<<24))>>>0;
      if(wt==="EXIF"){f.kinds.push("EXIF");var e0=i+8;if(ascii(u,e0,e0+6)==="Exif\0\0")e0+=6;var tw=parseTiff(u,e0);if(tw)f.rows=f.rows.concat(describeTiff(tw,f))}
      else if(wt==="XMP ")f.kinds.push("XMP");
      i+=8+ws+(ws&1);
    }
  }
  return f;
}
function findEoi(u){
  var n=u.length,i=2;
  while(i+1<n){
    if(u[i]!==0xFF){i++;continue}
    var m=u[i+1];
    if(m===0xFF){i++;continue}
    if(m===0xD9)return i;
    if(m===0x00||m===0x01||(m>=0xD0&&m<=0xD8)){i+=2;continue}
    var L=(u[i+2]<<8)|u[i+3];if(L<2||i+2+L>n)return-1;
    i+=2+L;
    if(m===0xDA)while(i+1<n){if(u[i]===0xFF){var b=u[i+1];if(b!==0x00&&!(b>=0xD0&&b<=0xD7)&&b!==0xFF)break}i++}
  }
  return-1;
}

// ---- strippers
function stripJpeg(u,keepRot){
  var n=u.length,i=2,out=[u.subarray(0,2)],rot=1;
  while(i+1<n){
    if(u[i]!==0xFF){i++;continue}
    var m=u[i+1];
    if(m===0xFF){i++;continue}
    if(m===0xD9){out.push(u.subarray(i,i+2));i=n;break}
    if(m===0x00||m===0x01||(m>=0xD0&&m<=0xD8)){out.push(u.subarray(i,i+2));i+=2;continue}
    if(i+4>n)break;
    var L=(u[i+2]<<8)|u[i+3],end=i+2+L;
    if(L<2||end>n)throw new Error("Damaged JPEG");
    var keep;
    if(m===0xE0||m===0xEE||(m>=0xC0&&m<=0xCF)||m===0xDB||m===0xDD||m===0xDA)keep=true; // JFIF, Adobe colour flag, frame, tables, scan
    else if(m===0xE2)keep=ascii(u,i+4,i+16)==="ICC_PROFILE\0"; // colour profile only
    else if(m===0xE1||m===0xED||m===0xFE||(m>=0xE3&&m<=0xEF))keep=false; // EXIF, XMP, IPTC, comments, other app data
    else keep=true; // DHT, DNL, DRI and the like
    if(m===0xE1&&ascii(u,i+4,i+10)==="Exif\0\0"){var t=parseTiff(u,i+10);if(t&&typeof t.t0[0x0112]==="number")rot=t.t0[0x0112]}
    if(keep)out.push(u.subarray(i,end));
    i=end;
    if(m===0xDA){var s=i;while(i+1<n){if(u[i]===0xFF){var b=u[i+1];if(b!==0x00&&!(b>=0xD0&&b<=0xD7)&&b!==0xFF)break}i++}out.push(u.subarray(s,i))}
  }
  if(keepRot&&rot>1&&rot<=8){
    // minimal EXIF that holds only the rotation, so the photo does not turn sideways
    out.splice(1,0,new Uint8Array([0xFF,0xE1,0x00,0x22,0x45,0x78,0x69,0x66,0,0,0x4D,0x4D,0,0x2A,0,0,0,8,0,1,0x01,0x12,0,3,0,0,0,1,0,rot,0,0,0,0,0,0]));
  }
  return{data:cat(out),rot:rot};
}
function stripPng(u){
  var n=u.length,i=8,out=[u.subarray(0,8)],DROP={tEXt:1,iTXt:1,zTXt:1,eXIf:1,tIME:1};
  while(i+12<=n){
    var cl=((u[i]<<24)|(u[i+1]<<16)|(u[i+2]<<8)|u[i+3])>>>0,ty=ascii(u,i+4,i+8),end=i+12+cl;
    if(end>n)throw new Error("Damaged PNG");
    if(!DROP[ty])out.push(u.subarray(i,end));
    i=end;
    if(ty==="IEND")break;
  }
  return{data:cat(out),rot:1};
}
function stripWebp(u){
  var n=u.length,i=12,out=[];
  while(i+8<=n){
    var wt=ascii(u,i,i+4),ws=(u[i+4]|(u[i+5]<<8)|(u[i+6]<<16)|(u[i+7]<<24))>>>0,end=i+8+ws+(ws&1);
    if(end>n+1)throw new Error("Damaged WebP");
    if(wt!=="EXIF"&&wt!=="XMP "){
      var c=u.slice(i,Math.min(end,n));
      if(wt==="VP8X"&&c.length>8)c[8]=c[8]&~0x0C; // clear the EXIF and XMP flags
      out.push(c);
    }
    i=end;
  }
  var body=cat(out),res=new Uint8Array(12+body.length);
  res.set(u.subarray(0,12));res.set(body,12);
  var sz=res.length-8;res[4]=sz&255;res[5]=(sz>>8)&255;res[6]=(sz>>16)&255;res[7]=(sz>>24)&255;
  return{data:res,rot:1};
}

// ---- store-only ZIP (photos are already compressed, so no deflate needed)
var CRC=(function(){var t=[],c,k;for(var n=0;n<256;n++){c=n;for(k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u){var c=0xFFFFFFFF;for(var i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function zip(files){
  var parts=[],cd=[],off=0,enc=new TextEncoder(),w16=function(a,v){a.push(v&255,(v>>8)&255)},w32=function(a,v){a.push(v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255)};
  files.forEach(function(f){
    var nm=enc.encode(f.name),crc=crc32(f.data),h=[];
    w32(h,0x04034B50);w16(h,20);w16(h,0x0800);w16(h,0);w16(h,0);w16(h,0x21);w32(h,crc);w32(h,f.data.length);w32(h,f.data.length);w16(h,nm.length);w16(h,0);
    parts.push(new Uint8Array(h),nm,f.data);
    var c=[];w32(c,0x02014B50);w16(c,20);w16(c,20);w16(c,0x0800);w16(c,0);w16(c,0);w16(c,0x21);w32(c,crc);w32(c,f.data.length);w32(c,f.data.length);w16(c,nm.length);w16(c,0);w16(c,0);w16(c,0);w16(c,0);w32(c,0);w32(c,off);
    cd.push(new Uint8Array(c),nm);
    off+=h.length+nm.length+f.data.length;
  });
  var cds=cat(cd),e=[];w32(e,0x06054B50);w16(e,0);w16(e,0);w16(e,files.length);w16(e,files.length);w32(e,cds.length);w32(e,off);w16(e,0);
  return new Blob(parts.concat([cds,new Uint8Array(e)]),{type:"application/zip"});
}

// ---- UI
var MIME={jpeg:"image/jpeg",png:"image/png",webp:"image/webp"},EXT={jpeg:"jpg",png:"png",webp:"webp"};
function add(l){Array.prototype.forEach.call(l,function(f){queue.push(f)});drain()}
var queue=[],busy=false;
async function drain(){
  if(busy)return;busy=true;
  while(queue.length){var f=queue.shift();await handle(f)}
  busy=false;render();
}
async function handle(f){
  var r={name:f.name,orig:f.size};
  try{
    var u=new Uint8Array(await f.arrayBuffer()),kind=sniff(u);
    if(!kind){r.err="Not supported. Use JPG, PNG or WebP. For other formats, the Image Compressor re-encodes the file, which also drops metadata.";results.push(r);return}
    var before=inspect(u,kind),res=kind==="jpeg"?stripJpeg(u,$("rot").checked):kind==="png"?stripPng(u):stripWebp(u);
    var after=inspect(res.data,kind);
    r.kind=kind;r.before=before;r.out=res.data.length;r.keptRot=after.kinds.indexOf("EXIF")>-1&&res.rot>1;
    r.left=after.kinds.filter(function(k){return k!=="EXIF"||!r.keptRot});
    r.name=f.name.replace(/\.[^.]+$/,"")+"-clean."+EXT[kind];
    r.blob=new Blob([res.data],{type:MIME[kind]});r.data=res.data;r.url=URL.createObjectURL(r.blob);
  }catch(e){r.err="Could not read this file ("+(e&&e.message?e.message:"error")+")."}
  results.push(r);
}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
function render(){
  var L=$("list");L.innerHTML="";var ok=0,gps=0,removed=0,okFiles=[];
  results.forEach(function(r){
    var d=el("div","item"),img=el("img");img.alt="";if(r.url)img.src=r.url;d.appendChild(img);
    var info=el("div","info");info.appendChild(el("div","nm",r.name));
    if(r.err){info.appendChild(el("div","sz",r.err));info.appendChild(el("span","badge no","Skipped"));d.appendChild(info);L.appendChild(d);return}
    ok++;okFiles.push(r);var b=r.before,found=b.kinds.length;if(b.gps)gps++;removed+=r.orig-r.out;
    info.appendChild(el("div","sz",fmt(r.orig)+" → "+fmt(r.out)));
    var bd=el("span","badge"+(b.gps?" warn":found?"":" no"),b.gps?"Had GPS location":found?"Metadata removed":"No metadata found");info.appendChild(bd);
    if(r.left.length)info.appendChild(el("div","sz","Still present: "+r.left.join(", ")));
    else info.appendChild(el("div","sz","Checked the new file again: no metadata found"+(r.keptRot?" (only the rotation flag is kept)":"")+"."));
    if(found||b.rows.length){
      var dt=el("details","mdet"),sm=el("summary","","What was in this file");dt.appendChild(sm);
      var ul=el("ul","mlist");
      b.rows.forEach(function(x){var li=el("li");li.appendChild(el("b","",x[0]+": "));li.appendChild(document.createTextNode(x[1]));ul.appendChild(li)});
      b.kinds.forEach(function(k){ul.appendChild(el("li","",k))});
      dt.appendChild(ul);info.appendChild(dt);
    }
    d.appendChild(info);
    var a=el("a","btn","Download");a.href=r.url;a.download=r.name;d.appendChild(a);L.appendChild(d);
  });
  var s=$("sum");
  if(ok){s.classList.add("show");$("sn").textContent=ok+(ok===1?" file":" files")+" cleaned";
    $("st").textContent=gps?gps+" had a GPS location. ":"";$("st").textContent+=removed>0?"Removed "+fmt(removed)+" of metadata.":"No size change.";
    $("zipb").hidden=ok<2;
  }else{s.classList.remove("show");$("zipb").hidden=true}
  $("clr").hidden=!results.length;
}
$("file").onchange=function(e){add(e.target.files);e.target.value=""};
var dz=$("drop");["dragover","dragenter"].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.add("on")})});
["dragleave","drop"].forEach(function(t){dz.addEventListener(t,function(e){e.preventDefault();dz.classList.remove("on")})});
dz.addEventListener("drop",function(e){add(e.dataTransfer.files)});
$("zipb").onclick=function(){
  var seen={},files=results.filter(function(r){return r.data}).map(function(r){var nm=r.name,k=1;while(seen[nm]){nm=r.name.replace(/(\.[^.]+)$/,"-"+(++k)+"$1")}seen[nm]=1;return{name:nm,data:r.data}});
  var url=URL.createObjectURL(zip(files)),a=document.createElement("a");a.href=url;a.download="boombastis-clean-photos.zip";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},4000);
};
$("clr").onclick=function(){results.forEach(function(r){if(r.url)URL.revokeObjectURL(r.url)});results=[];render()};
