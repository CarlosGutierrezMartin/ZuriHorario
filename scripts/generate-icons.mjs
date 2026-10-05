// Code-drawn flower mark; no external image assets or build dependency required.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
function crc32(buffer) { let c=0xffffffff;for(const b of buffer){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0; }
function chunk(type,data){const t=Buffer.from(type);const n=Buffer.alloc(4);n.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([n,t,data,crc]);}
function draw(n,filename){
  const raw=Buffer.alloc(n*(1+n*4));const colors={bg:[241,220,229],petal:[199,137,163],center:[249,235,240],heart:[164,78,110]};
  for(let y=0;y<n;y++){raw[y*(1+n*4)]=0;for(let x=0;x<n;x++){let rgb=[0,0,0];const aa=3;for(let iy=0;iy<aa;iy++)for(let ix=0;ix<aa;ix++){
    const px=(x+(ix+.5)/aa)*512/n-256,py=(y+(iy+.5)/aa)*512/n-256;let c=colors.bg;
    for(let k=0;k<6;k++){const a=k*Math.PI/3,u=px*Math.cos(a)+py*Math.sin(a),v=-px*Math.sin(a)+py*Math.cos(a);if(u*u/55**2+(v+76)**2/80**2<=1)c=colors.petal;}
    if(px*px+py*py<=58**2)c=colors.center;
    const hx=px/34,hy=-(py+2)/32; if((hx*hx+hy*hy-1)**3-hx*hx*hy**3<=0)c=colors.heart;
    rgb=rgb.map((v,j)=>v+c[j]/aa**2);
  }const at=y*(1+n*4)+1+x*4;rgb.forEach((v,j)=>raw[at+j]=Math.round(v));raw[at+3]=255;}}
  const header=Buffer.alloc(13);header.writeUInt32BE(n);header.writeUInt32BE(n,4);header[8]=8;header[9]=6;
  writeFileSync(filename,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
draw(192,'public/icon-192.png');draw(512,'public/icon-512.png');draw(512,'public/icon-maskable.png');draw(180,'public/apple-touch-icon.png');
