import * as THREE from 'three';
import { box, cyl, ico, merge, patchGeo, stdMat } from './geo.js';
import { instancedChunks } from './instancing.js';
import { textBoard } from './campus.js';
import { rng } from '../util/math.js';
import { createCampusPlan, campusPoint, projectPath, pathSamples, inAirfield, nearestCampusRoad, registerCampus } from './university-plan.js';

// All architecture is generated once and instanced. No new downloads, runtime lights or frame callbacks.
const STONE = 0xd4c8ad, TRIM = 0xece3cf, ROOF = 0x4c595c, DARK = 0x263b43;
function tint(g, hex) { const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function archShape(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0); return s; }
function architecture(kind) {
  const out = { stone: [], trim: [], roof: [], glass: [], glow: [] }, solid = [];
  const H = kind === 'residence' ? 19.5 : 15.5, floors = kind === 'residence' ? 4 : 3;
  const stone = (w, h, d, x, y, z) => out.stone.push(box(w, h, d, STONE, { x, y, z }));
  const trim = (w, h, d, x, y, z) => out.trim.push(box(w, h, d, TRIM, { x, y, z }));
  const solidBox = (w, d, x, z, top) => solid.push({ x: x - w / 2, z: z - d / 2, w, d, top });
  const window = tint(new THREE.ShapeGeometry(archShape(2.3, 3.25), 8), 0x91a8ab);
  const frameShape = archShape(3.0, 3.7), holeShape = archShape(2.3, 3.25);
  const hole = new THREE.Path(holeShape.getPoints(8).map(p => new THREE.Vector2(p.x, p.y + 0.16))); frameShape.holes.push(hole);
  const frame = tint(new THREE.ExtrudeGeometry(frameShape, { depth: 0.18, bevelEnabled: false, curveSegments: 8 }), TRIM);
  function wing(x, z, w, d) {
    stone(w, H, d, x, H / 2, z); solidBox(w, d, x, z, H + 4);
    trim(w + 0.6, 1, d + 0.6, x, 0.5, z);
    for (let f = 1; f <= floors; f++) trim(w + 0.5, 0.3, d + 0.5, x, f * 4.4 + 0.4, z);
    trim(w + 1.6, 0.65, d + 1.6, x, H, z);
    // Hipped slate roof with a raised ridge, rather than a flat box.
    const pos = [-w/2,0,-d/2,w/2,0,-d/2,w/2,0,d/2,-w/2,0,d/2,-w/2+6,3.5,0,w/2-6,3.5,0];
    const g = new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex([0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0]); g.computeVertexNormals(); tint(g,ROOF); g.translate(x,H+0.35,z); out.roof.push(g);
    for (const [len, ox, oz, rot] of [[w, 0, d/2+0.03, 0], [w, 0, -d/2-0.03, Math.PI], [d, w/2+0.03, 0, Math.PI/2], [d, -w/2-0.03, 0, -Math.PI/2]]) {
      const n = Math.floor((len-5)/6.8);
      for (let i = 0; i < n; i++) { const u = (i-(n-1)/2)*6.8;
        for (let f = 0; f < floors; f++) { const yy = 1 + f*4.4, xx = x+ox+Math.cos(rot)*u, zz=z+oz-Math.sin(rot)*u;
          out.glass.push(window.clone().rotateY(rot).translate(xx,yy,zz));
          out.trim.push(frame.clone().rotateY(rot).translate(xx,yy-0.16,zz));
          const mullion = box(0.1,2.9,0.1,0x465354,{y:1.5}); mullion.rotateY(rot); mullion.translate(xx,yy,zz); out.trim.push(mullion);
        }
      }
    }
    // Warm cornice lighting uses the existing time-of-day system.
    out.glow.push(box(w,0.09,0.12,0xffe0a9,{x,y:H-0.35,z:z+d/2+0.15}));
  }
  wing(0,-48,160,23); wing(-69,2,22,77); wing(69,2,22,77);
  // A walkable colonnade facing the courtyard, with open arches between actual columns.
  for (const side of [-1,1]) for(let z=-25;z<=38;z+=9) {
    out.trim.push(cyl(0.48,0.58,5.4,10,TRIM,{x:side*54,y:2.7,z}));
    trim(1.5,0.35,1.5,side*54,5.45,z); trim(1.3,0.25,1.3,side*54,0.125,z);
    solidBox(1.2,1.2,side*54,z,5.7);
  }
  for(const side of [-1,1]) trim(8,0.5,78,side*56,5.9,2);
  // Formal portico and pediment on the central hall.
  for (const x of [-18,-11,11,18]) { out.trim.push(cyl(0.65,0.8,7,12,TRIM,{x,y:3.5,z:-27})); trim(2,0.4,2,x,7,-27); solidBox(1.7,1.7,x,-27,7.5); }
  trim(44,0.9,12,0,7.7,-31);
  const ped = new THREE.BufferGeometry(); ped.setAttribute('position',new THREE.Float32BufferAttribute([-23,0,0,23,0,0,0,6,0],3)); ped.setIndex([0,1,2]); ped.computeVertexNormals(); tint(ped,TRIM); ped.translate(0,8.2,-24.8); out.trim.push(ped);
  out.glass.push(box(8,5.8,0.1,DARK,{x:0,y:2.9,z:-36.4}));
  if(kind==='library') {
    out.stone.push(cyl(13,13,8,24,STONE,{x:0,y:H+4,z:-48})); solidBox(26,26,0,-48,H+18);
    const dome=tint(new THREE.SphereGeometry(14,24,12,0,Math.PI*2,0,Math.PI/2),0x497f79); dome.scale(1,0.7,1); dome.translate(0,H+8,-48); out.roof.push(dome);
    out.trim.push(cyl(14,14,0.7,24,TRIM,{y:H+8,z:-48}));
    out.trim.push(cyl(0.3,0.7,5,8,0xc2a96c,{y:H+18,z:-48}));
  } else if(kind==='hall') {
    stone(16,30,16,0,15,-48); solidBox(16,16,0,-48,36);
    trim(18,0.8,18,0,27,-48); trim(18,0.8,18,0,30.3,-48);
    out.roof.push(cyl(0,13,6,4,ROOF,{y:34,z:-48}).rotateY(0));
    out.glass.push(box(5,5,0.15,0xe4dcc1,{y:24,z:-39.9}));
    out.trim.push(box(0.15,2.1,0.15,DARK,{y:24.6,z:-39.75}),box(1.6,0.15,0.15,DARK,{x:0.75,y:24,z:-39.75}));
  } else {
    for(const x of [-76,76]) { trim(9,1,9,x,H+1.3,-48); out.roof.push(cyl(0,7,4,4,ROOF,{x,y:H+3.7,z:-48})); }
  }
  window.dispose(); frame.dispose();
  return { geos:Object.fromEntries(Object.entries(out).map(([k,v])=>[k,merge(v)])), solid };
}
function ribbon(path, a, b, y) {
  const pos=[],uv=[],idx=[];
  path.points.forEach((p,i)=>{
    const prev=path.points[Math.max(0,i-1)], next=path.points[Math.min(path.points.length-1,i+1)];
    let dx=next.x-prev.x,dz=next.z-prev.z;
    if(path.loop&&(i===0||i===path.points.length-1)){const pp=path.points[path.points.length-2],nn=path.points[1];dx=nn.x-pp.x;dz=nn.z-pp.z;}
    const l=Math.hypot(dx,dz),nx=-dz/l,nz=dx/l;
    for(const off of [a,b]){const x=p.x+nx*off,z=p.z+nz*off;pos.push(x,y,z);uv.push(x/4,z/4);}
    if(i){const j=i*2;idx.push(j-2,j-1,j,j-1,j+1,j);}
  });
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function buildUniversity(ctx) {
  const {scene,T,colliders,world}=ctx, plan=createCampusPlan(), random=rng(9625); ctx.university=plan;
  const mats={stone:stdMat(T,T.stone,{vertexColors:true,emissive:0xffd6a3,emissiveIntensity:0}),trim:new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.8,emissive:0xffdfb0,emissiveIntensity:0}),roof:new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.8}),glass:new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.24,metalness:0.25,emissive:0xffd39a,emissiveIntensity:0}),glow:ctx.lampHeadMat};
  ctx.universityMats=mats;
  const root=new THREE.Group();root.name='university';scene.add(root);
  const mesh=(g,mat,name)=>{if(!g)return;const m=new THREE.Mesh(g,mat);m.name=name;m.receiveShadow=true;root.add(m);return m;};
  const chunkMesh=(list,mat,name)=>{const chunks=new Map();for(const g of list){g.computeBoundingBox();const c=g.boundingBox.getCenter(new THREE.Vector3()),key=`${Math.floor(c.x/400)},${Math.floor(c.z/400)}`;(chunks.get(key)||chunks.set(key,[]).get(key)).push(g);}for(const [key,parts]of chunks)mesh(merge(parts),mat,`${name}-${key}`);};
  const paved=[],gardens=[],hedges=[],lamps=[],trees=[],benches=[],lights=[],basins=[],marks=[],footpaths=[],kerbs=[];
  // Paths share world UVs and a single surface height, so intersections form a continuous road.
  const roadSurfaces=[], courtDrives=[];
  const nearOther=(road,x,z,margin=0)=>plan.roads.some(o=>o!==road&&projectPath(o,x,z).dist<o.width/2+margin);
  for(const r of plan.roads){
    (r.drive ? courtDrives : roadSurfaces).push(ribbon(r,-r.width/2,r.width/2,0.06));
    // Short strips stop before junction mouths, with no kerb across any campus entrance.
    for(const p of pathSamples(r,3))for(const side of [-1,1]){
      const off=r.width/2+1.6,x=p.x+p.nx*off*side,z=p.z+p.nz*off*side;
      if(nearOther(r,x,z,3)||r.id==='gate-link'||(r.drive&&p.at<64))continue;
      const q={points:[{x:x-p.dx*1.55,z:z-p.dz*1.55},{x:x+p.dx*1.55,z:z+p.dz*1.55}]};
      footpaths.push(ribbon(q,-1.5,1.5,0.12));
      const curb=box(3.1,0.16,0.24,TRIM,{y:0.08});curb.rotateY(-Math.atan2(p.dz,p.dx));curb.translate(x-p.nx*1.46*side,0,z-p.nz*1.46*side);kerbs.push(curb);
    }
    if(!r.drive)for(const p of pathSamples(r,14)){
      if(nearOther(r,p.x,p.z,12))continue;
      const g=patchGeo(-3, -0.1,6,0.2,4,0.075);g.rotateY(-Math.atan2(p.dz,p.dx));g.translate(p.x,0,p.z);marks.push(g);
    }
    for(const p of pathSamples(r,r.drive?28:42))for(const side of [-1,1]){
      const off=r.width/2+2.2,x=p.x+p.nx*off*side,z=p.z+p.nz*off*side;
      if(nearOther(r,x,z,10)||inAirfield(plan,x,z,10)||(r.drive&&p.at<65))continue;
      lamps.push({x,z});lights.push({x,z,r:18});colliders.add(x-0.2,z-0.2,x+0.2,z+0.2,'lamp',null,7);
    }
    if(r.loop)for(const p of pathSamples(r,23))for(const side of [-1,1]){
      const off=side<0?22:31,x=p.x+p.nx*off*side,z=p.z+p.nz*off*side;
      if(nearOther(r,x,z,14)||inAirfield(plan,x,z,18))continue;trees.push({x,z});
    }
  }
  mesh(merge(roadSurfaces),stdMat(T,T.asphalt),'university-roads');
  mesh(merge(courtDrives),stdMat(T,T.paving),'university-drives');
  chunkMesh(footpaths,stdMat(T,T.paving),'university-walks');chunkMesh(kerbs,mats.trim,'university-kerbs');
  mesh(merge(marks),new THREE.MeshStandardMaterial({color:0xe9e4d5,roughness:1}),'university-markings');
  for(const kind of ['college','library','residence','hall']){
    const a=architecture(kind),items=plan.precincts.filter(p=>p.kind===kind);
    for(const [part,g]of Object.entries(a.geos)){
      const group=instancedChunks(g,mats[part],items,{name:`university-${kind}-${part}`,chunk:400,castShadow:part!=='glass'&&part!=='glow',receiveShadow:true});root.add(group);
      if(part==='glass'||part==='trim'||part==='glow')(ctx.cullGroups ||= []).push({root:group,dist:950});
    }
    for(const p of items)for(const b of a.solid){const corners=[[b.x,b.z],[b.x+b.w,b.z],[b.x,b.z+b.d],[b.x+b.w,b.z+b.d]].map(([x,z])=>campusPoint(p,x,z));colliders.add(Math.min(...corners.map(c=>c.x)),Math.min(...corners.map(c=>c.z)),Math.max(...corners.map(c=>c.x)),Math.max(...corners.map(c=>c.z)),'amenity',p.id,b.top);}
  }
  const localPatch=(p,x,z,w,d,mat,y)=>{const g=patchGeo(x,z,w,d,4,y);g.rotateY(p.rot);g.translate(p.x,0,p.z);const uv=g.attributes.uv,pos=g.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)/4,pos.getZ(i)/4);mat.push(g);};
  for(const p of plan.precincts){
    localPatch(p,-86,-64,172,144,paved,0.045);
    const cs=[[ -33,14],[33,14]];
    for(const [x,z]of cs){localPatch(p,x-17,z-20,34,40,gardens,0.09);
      for(const dz of [-20,20]){const g=box(34,0.65,0.65,0x42633a,{x,y:0.36,z:z+dz});g.rotateY(p.rot);g.translate(p.x,0,p.z);hedges.push(g);}
      for(const dx of [-17,17]){const g=box(0.65,0.65,40,0x42633a,{x:x+dx,y:0.36,z});g.rotateY(p.rot);g.translate(p.x,0,p.z);hedges.push(g);}
      for(const dz of [-11,11]){const t=campusPoint(p,x,z+dz);trees.push({...t,small:true});}
    }
    // Reflecting basin off the drive axis. Never block the driveable courtyard centre.
    const fp=campusPoint(p,33,14);basins.push({...fp,rot:p.rot});colliders.add(fp.x-5,fp.z-5,fp.x+5,fp.z+5,'pool',p.id,0.8);
    for(const x of [-46,46])for(const z of [-14,45]){const b=campusPoint(p,x,z);benches.push({...b,rot:p.rot});const l=campusPoint(p,x,z+5);lamps.push(l);lights.push({...l,r:12});colliders.add(l.x-.2,l.z-.2,l.x+.2,l.z+.2,'lamp',null,7);}
    const wash=campusPoint(p,0,-21);(plan.pools ||= []).push({...wash,sx:60,sz:19});
    const sign=textBoard(26,2,[p.name.toUpperCase()],'#333e3b','#f2e5c6','600 64px Georgia, serif');const sp=campusPoint(p,0,-24.55);sign.position.set(sp.x,8.1,sp.z);sign.rotation.y=p.rot;root.add(sign);
    // Avenue to each quad, behind the curb and outside all junction sight lines.
    for(const z of [92,122,152])for(const x of [-17,17]){const q=campusPoint(p,x,z);if(!inAirfield(plan,q.x,q.z,12)&&nearestCampusRoad(plan,q.x,q.z).dist>5)trees.push(q);}
  }
  mesh(merge(paved),stdMat(T,T.paving),'university-quadrangles');mesh(merge(gardens),stdMat(T,T.lawn),'university-lawns');mesh(merge(hedges),new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),'university-hedges');
  // Planted buffer along the original wall remains green and unbuilt.
  for(let t=40;t<2980;t+=29)for(const q of [{x:t,z:-50},{x:-50,z:t},{x:3050,z:t},{x:t,z:3050}]){
    if(inAirfield(plan,q.x,q.z,10)||nearestCampusRoad(plan,q.x,q.z).dist<18)continue;trees.push(q);
  }
  // A sports lawn on the outer east campus, with marked pitch, goal frames and flood masts.
  const sp=plan.sports;mesh(patchGeo(sp.x,sp.z,sp.w,sp.h,4,0.025),stdMat(T,T.lawn),'university-sports-ground');
  const sportMarks=[];for(const x of [sp.x+5,sp.x+sp.w-5])sportMarks.push(patchGeo(x,sp.z+5,.25,sp.h-10,4,.08));for(const z of [sp.z+5,sp.z+sp.h/2,sp.z+sp.h-5])sportMarks.push(patchGeo(sp.x+5,z,sp.w-10,.25,4,.08));mesh(merge(sportMarks),new THREE.MeshStandardMaterial({color:0xf2eee4}),'university-pitch-lines');
  const sport=[];for(const z of [sp.z+5,sp.z+sp.h-5]){for(const x of [sp.x+sp.w/2-4,sp.x+sp.w/2+4]){sport.push(box(.15,3,.15,0xffffff,{x,z}));colliders.add(x-.15,z-.15,x+.15,z+.15,'sign',null,3);}sport.push(box(8,.15,.15,0xffffff,{x:sp.x+sp.w/2,y:3,z}));}
  mesh(merge(sport),mats.trim,'university-goals');
  for(const x of [sp.x-6,sp.x+sp.w+6])for(const z of [sp.z+14,sp.z+sp.h-14]){lamps.push({x,z});lights.push({x,z,r:40});}
  (plan.pools ||= []).push({x:sp.x+sp.w/2,z:sp.z+sp.h/2,sx:75,sz:120});
  // Monument entrance: clear 22m vehicle opening and a side guard lodge.
  const entrance=[];for(const x of [2145,2175]){entrance.push(box(5,12,5,STONE,{x,z:3660}),box(6,.8,6,TRIM,{x,y:12.4,z:3660}));colliders.add(x-2.5,3657.5,x+2.5,3662.5,'gate',null,13);}
  entrance.push(box(35,2.2,4,STONE,{x:2160,y:12.2,z:3660}),box(36,.4,5,TRIM,{x:2160,y:13.5,z:3660}));
  mesh(merge(entrance),mats.stone,'university-entry');
  for(const side of [-1,1]){const sign=textBoard(28,1.7,['GVP UNIVERSITY'],'#333e3b','#f2e5c6','600 64px Georgia, serif');sign.position.set(2160,12.2,3660+side*2.05);sign.rotation.y=side<0?Math.PI:0;root.add(sign);}
  const lodge=mesh(merge([box(12,4.5,9,STONE,{x:2194,z:3653}),box(13,.5,10,TRIM,{x:2194,y:4.7,z:3653}),box(.1,2,5,DARK,{x:2187.9,y:2.5,z:3653})]),mats.stone,'university-lodge');lodge.castShadow=true;colliders.add(2188,3648.5,2200,3657.5,'amenity',null,5);
  for(const x of [2138,2182])for(const z of [3630,3665]){lamps.push({x,z});lights.push({x,z,r:22});}
  // Junction signage beside, never inside, the driving corridor.
  for(const [x,z,text,rot]of [[2176,3397,'CAMPUS LOOP  ·  VILLAGE ↑',Math.PI],[2176,3080,'← VILLAGE & GVP AIRSTRIP',0],[1520,3070,'UNIVERSITY CAMPUS →',0]]){
    const sign=textBoard(10,1.4,[text],'#304940','#f2e5c6','600 64px Arial, sans-serif');sign.position.set(x,3,z);sign.rotation.y=rot;root.add(sign);
  }
  const benchGeo=merge([box(3.3,.2,.8,0x71563c,{y:.7}),box(3.3,.8,.12,0x71563c,{y:1.1,z:.4}),box(.18,.65,.65,DARK,{x:-1.2}),box(.18,.65,.65,DARK,{x:1.2})]);root.add(instancedChunks(benchGeo,new THREE.MeshStandardMaterial({vertexColors:true}),benches,{name:'university-benches',chunk:400,castShadow:true}));
  const basinGeo=merge([cyl(5,5,.65,32,TRIM,{y:.325}),cyl(1,1.4,1.8,16,STONE,{y:1.2}),cyl(2.2,1.6,.3,24,TRIM,{y:2.15})]);root.add(instancedChunks(basinGeo,mats.trim,basins,{name:'university-fountains',chunk:400,castShadow:true}));
  root.add(instancedChunks(cyl(4.6,4.6,.08,32,0x568b98,{y:.68}),new THREE.MeshStandardMaterial({vertexColors:true,metalness:.45,roughness:.18}),basins,{name:'university-basin-water',chunk:400}));
  const poleGeo=merge([cyl(.1,.17,6.2,8,DARK,{y:3.1}),box(.8,.18,.8,DARK,{y:6.3}),box(.65,.16,.65,DARK,{y:5.55}),cyl(0,.7,.55,4,DARK,{y:6.6})]);
  root.add(instancedChunks(poleGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6}),lamps,{name:'university-lanterns',chunk:400,castShadow:true}));
  root.add(instancedChunks(box(.46,.6,.46,0xffe4b7,{y:5.94}),ctx.lampHeadMat,lamps,{name:'university-lantern-glass',chunk:400}));
  ctx.lightPoints.push(...lights);
  // Chunked tree instances reuse the already downloaded oak; simple canopies at distance.
  const fallback=merge([cyl(.3,.45,5,6,0x65523a),ico(4,1,0x477349,{y:8,sy:1.1})]);
  const density=ctx.qualityPreset.treeDensity;
  const treeItems=trees.filter(()=>random()<density).map(t=>{const s=(t.small?.62:.9)+random()*.18;return {...t,rot:random()*Math.PI*2,sx:s,sy:s,sz:s};});
  const hi=instancedChunks(ctx.models.tree_oak?.geo||fallback,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),treeItems,{name:'university-trees',chunk:300,castShadow:true});
  const lo=instancedChunks(fallback,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),treeItems,{name:'university-trees-distant',chunk:300});root.add(hi,lo);ctx.lod.push({hi,lo});
  for(const t of treeItems)colliders.add(t.x-.45,t.z-.45,t.x+.45,t.z+.45,'tree',null,12*t.sy);
  plan.treeCount=treeItems.length;plan.lampCount=lamps.length;
  // Driveable court paving participates in surface detection independently of the CAD data.
  plan.paved=plan.precincts.map(p=>({x:p.x-86,y:p.z-86,w:172,h:172}));
  registerCampus(world,plan);
}
