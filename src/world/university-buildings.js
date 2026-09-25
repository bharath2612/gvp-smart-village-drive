import * as THREE from 'three';
import { box, cyl, merge } from './geo.js';
import { BUILDING_TYPES } from './university-plan.js';
export const STONE=0xd4c8ad,TRIM=0xece3cf,ROOF=0x4c595c,DARK=0x263b43;
export function tint(g,hex){const c=new THREE.Color(hex),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g;}
function arch(w,h){const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.lineTo(-w/2,0);return s;}
export function buildingGeometry(kind){
  const type=BUILDING_TYPES[kind],H=type.height,front=Math.max(...type.blocks.map(([,z,,d])=>z+d/2));
  const out={stone:[],trim:[],roof:[],glass:[],glow:[]},solid=[];
  const stone=(w,h,d,x,y,z)=>out.stone.push(box(w,h,d,STONE,{x,y,z}));
  const trim=(w,h,d,x,y,z)=>out.trim.push(box(w,h,d,TRIM,{x,y,z}));
  const collider=(x,z,w,d,top)=>solid.push({x,z,w,d,top});
  const window=tint(new THREE.ShapeGeometry(arch(2.3,3.25),6),0x91a8ab);
  const shape=arch(3,3.7),inner=arch(2.3,3.25);shape.holes.push(new THREE.Path(inner.getPoints(6).map(p=>new THREE.Vector2(p.x,p.y+.16))));
  const frame=tint(new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false,curveSegments:6}),TRIM);
  for(const [x,z,w,d]of type.blocks){
    stone(w,H,d,x,H/2,z);collider(x,z,w,d,H+4.5);trim(w+.6,1,d+.6,x,.5,z);
    for(let f=1;f<=type.floors;f++)trim(w+.5,.3,d+.5,x,f*4.4+.4,z);
    trim(w+1.5,.65,d+1.5,x,H,z);
    const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute([-w/2,0,-d/2,w/2,0,-d/2,w/2,0,d/2,-w/2,0,d/2,-w/2+7,4.5,0,w/2-7,4.5,0],3));roof.setIndex([0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0]);roof.computeVertexNormals();tint(roof,ROOF);roof.translate(x,H+.35,z);out.roof.push(roof);
    for(const [len,ox,oz,rot]of [[w,0,d/2+.04,0],[w,0,-d/2-.04,Math.PI],[d,w/2+.04,0,Math.PI/2],[d,-w/2-.04,0,-Math.PI/2]]){
      const n=Math.floor((len-4)/6.6);
      for(let i=0;i<n;i++)for(let f=0;f<type.floors;f++){
        const u=(i-(n-1)/2)*6.6,xx=x+ox+Math.cos(rot)*u,zz=z+oz-Math.sin(rot)*u,y=1+f*4.4;
        out.glass.push(window.clone().rotateY(rot).translate(xx,y,zz));out.trim.push(frame.clone().rotateY(rot).translate(xx,y-.16,zz));
        const m=box(.1,2.9,.1,DARK,{y:1.5});m.rotateY(rot);m.translate(xx,y,zz);out.trim.push(m);
      }
    }
    out.glow.push(box(w,.08,.12,0xffe0a9,{x,y:H-.35,z:z+d/2+.15}));
    // Chimneys, pilasters and roof ridges break up the separate buildings' silhouettes.
    for(const side of [-1,1]){stone(1.8,4,2.3,x+side*(w/2-8),H+2,z-3);trim(2.4,.35,2.9,x+side*(w/2-8),H+4,z-3);}
  }
  const porticoW=kind==='pavilion'?19:kind==='library'?40:29,porticoH=kind==='pavilion'?4.4:6.8;
  for(const x of [-porticoW/2+2,-porticoW/4,porticoW/4,porticoW/2-2]){
    out.trim.push(cyl(.48,.65,porticoH,10,TRIM,{x,y:porticoH/2,z:front+6}));trim(1.6,.3,1.6,x,porticoH,front+6);trim(1.6,.2,1.6,x,.1,front+6);collider(x,front+6,1.5,1.5,porticoH+.4);
  }
  trim(porticoW+3,.7,9,0,porticoH+.5,front+2.5);
  const ped=new THREE.BufferGeometry();ped.setAttribute('position',new THREE.Float32BufferAttribute([-porticoW/2-2,0,0,porticoW/2+2,0,0,0,4,0],3));ped.setIndex([0,1,2]);ped.computeVertexNormals();tint(ped,TRIM);ped.translate(0,porticoH+.85,front+7.1);out.trim.push(ped);
  out.glass.push(box(5,4.4,.1,DARK,{y:2.2,z:front+.07}));
  if(kind==='library'){
    out.stone.push(cyl(12,12,6,24,STONE,{y:H+3}));collider(0,0,24,24,H+18);
    const dome=tint(new THREE.SphereGeometry(13,24,12,0,Math.PI*2,0,Math.PI/2),0x527f79);dome.scale(1,.7,1);dome.translate(0,H+6,0);out.roof.push(dome);out.trim.push(cyl(13,13,.6,24,TRIM,{y:H+6}),cyl(.25,.55,3,8,0xc2a96c,{y:H+16.5}));
  }else if(kind==='hall'){
    const tx=-19;stone(12,28,12,tx,14,-7);collider(tx,-7,12,12,33);trim(14,.7,14,tx,27.5,-7);out.roof.push(cyl(0,10,5,4,ROOF,{x:tx,y:30.5,z:-7}));
    const clock=tint(new THREE.CircleGeometry(2,24),0xf3e9d2);clock.translate(tx,23,-.93);out.trim.push(clock);
    out.glass.push(box(.14,1.5,.12,DARK,{x:tx,y:23.6,z:-.8}),box(1.2,.14,.12,DARK,{x:tx+.52,y:23,z:-.8}));
  }else if(kind==='residence'){
    for(const x of [-28,28]){trim(12,.4,3,x,5,13.4);for(let j=-4;j<=4;j+=2)trim(.1,1.1,.1,x+j,5.7,14.8);trim(12,.15,.15,x,6.3,14.8);}
  }
  window.dispose();frame.dispose();
  return {geos:Object.fromEntries(Object.entries(out).map(([k,v])=>[k,merge(v)])),solid,front,signY:porticoH+.5};
}
