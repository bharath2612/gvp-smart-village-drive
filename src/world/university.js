import * as THREE from 'three';
import { box,cyl,ico,merge,patchGeo,stdMat } from './geo.js';
import { instancedChunks } from './instancing.js';
import { textBoard } from './campus.js';
import { canPlant,forestSites } from './university-forest.js';
import { addUniversityTrees } from './university-tree-models.js';
import { rng } from '../util/math.js';
import { createCampusPlan,campusPoint,localRect,boundsOf,inBox,projectPath,pathSamples,insideCampus,inAirfield,nearestCampusRoad,registerCampus } from './university-plan.js';
import { buildingGeometry,STONE,TRIM,DARK } from './university-buildings.js';
import { buildCampusSurfaces,polygonsGeometry } from './university-surfaces.js';

// Landscape and architecture are generated once, with seeded placement and spatially culled instances.
export function buildUniversity(ctx){
  const {scene,T,colliders,world}=ctx,plan=createCampusPlan(),random=rng(962509);ctx.university=plan;
  const root=new THREE.Group();root.name='university';scene.add(root);
  const mats={stone:stdMat(T,T.stone,{vertexColors:true,emissive:0xffd6a3,emissiveIntensity:0}),trim:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,emissive:0xffdfb0,emissiveIntensity:0}),roof:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8}),glass:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.24,metalness:.25,emissive:0xffd39a,emissiveIntensity:0}),glow:ctx.lampHeadMat};ctx.universityMats=mats;
  const mesh=(g,mat,name)=>{if(!g)return;const m=new THREE.Mesh(g,mat);m.name=name;m.receiveShadow=true;root.add(m);return m;};
  const instances=(g,mat,items,name,shadow=false)=>{const r=instancedChunks(g,mat,items,{name,chunk:350,castShadow:shadow,receiveShadow:true});root.add(r);return r;};
  // Woodland follows the estate boundary, independently of the campus roads.
  const landMat=stdMat(T,T.grass,{color:0x84996b});
  landMat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vEstate;').replace('#include <begin_vertex>','#include <begin_vertex>\nvEstate=position.xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vEstate;').replace('#include <color_fragment>','#include <color_fragment>\nfloat forestTone=sin(vEstate.x*.023+sin(vEstate.y*.013))*sin(vEstate.y*.031)+.4*sin((vEstate.x+vEstate.y)*.071);diffuseColor.rgb*=.94+forestTone*.08;');
  };
  mesh(polygonsGeometry([[plan.boundary,[[0,0],[3000,0],[3000,3000],[0,3000]]]],0),landMat,'university-land');
  buildCampusSurfaces(ctx,plan,root);
  const lamps=[],trees=[],benches=[],lights=[],marks=[],bushes=[],basins=[];
  const nearOther=(road,x,z,margin)=>plan.roads.some(o=>o!==road&&projectPath(o,x,z).dist<o.width/2+margin);
  const footprintBlocked=(x,z,m=0)=>plan.precincts.some(p=>p.boxes.some(b=>inBox(b,x,z,m)));
  const treeSafe=(x,z)=>canPlant(plan,x,z);
  for(const road of plan.roads){
    if(!road.drive)for(const p of pathSamples(road,14)){
      if(nearOther(road,p.x,p.z,14)||road.roundabout)continue;
      const g=patchGeo(-2.7,-.1,5.4,.2,4,.075);g.rotateY(-Math.atan2(p.dz,p.dx));g.translate(p.x,0,p.z);marks.push(g);
    }
    for(const p of pathSamples(road,road.drive?35:46))for(const side of [-1,1]){
      const off=road.width/2+1.65,x=p.x+p.nx*off*side,z=p.z+p.nz*off*side;
      if(nearOther(road,x,z,9)||inBox(plan.airfield,x,z,10)||footprintBlocked(x,z,4)||plan.precincts.some(b=>inBox(b.courtBox,x,z,2)))continue;
      lamps.push({x,z});lights.push({x,z,r:17});colliders.add(x-.2,z-.2,x+.2,z+.2,'lamp',null,7);
    }
    if(road.width===25&&!road.roundabout)for(const p of pathSamples(road,19))for(const side of [-1,1]){
      if(random()<.22)continue;const off=23+random()*15,x=p.x+p.nx*off*side,z=p.z+p.nz*off*side;
      if(treeSafe(x,z))trees.push({x,z});
    }
  }
  // Matching edge lines and directional arrows make both avenues visibly two-way.
  for(const road of plan.roads.filter(r=>r.width>=25)){
    for(const p of pathSamples(road,4))for(const side of [-1,1]){
      const x=p.x+p.nx*(road.width/2-1)*side,z=p.z+p.nz*(road.width/2-1)*side;
      if(nearOther(road,x,z,4))continue;
      const g=patchGeo(-2,-.09,4.05,.18,4,.08);g.rotateY(-Math.atan2(p.dz,p.dx));g.translate(x,0,z);marks.push(g);
    }
    for(const p of pathSamples(road,road.roundabout?94:140))for(const side of road.roundabout?[0]:[-1,1]){
      if(!road.roundabout&&(p.at<35||nearOther(road,p.x,p.z,25)))continue;
      const x=p.x+p.nx*road.width*.23*side,z=p.z+p.nz*road.width*.23*side;
      const arrow=merge([patchGeo(-2.5,-.18,4,.36,4,.08),patchGeo(-1.2,-.16,2.4,.32,4,.08).rotateY(Math.PI/4).translate(1.4,0,-.7),patchGeo(-1.2,-.16,2.4,.32,4,.08).rotateY(-Math.PI/4).translate(1.4,0,.7)]);
      arrow.rotateY(-Math.atan2(p.dz,p.dx)+(road.roundabout||side>0?Math.PI:0));arrow.translate(x,0,z);marks.push(arrow);
    }
  }
  mesh(merge(marks),new THREE.MeshStandardMaterial({color:0xe9e4d5,roughness:1}),'university-markings');
  const types=[...new Set(plan.precincts.map(p=>p.kind))];
  for(const kind of types){
    const a=buildingGeometry(kind),items=plan.precincts.filter(p=>p.kind===kind);
    for(const [part,g]of Object.entries(a.geos)){
      const tinted=part==='stone'?items.map((p,i)=>({...p,color:new THREE.Color([0xffffff,0xd9d2c4,0xe5decf,0xf3dfc0][i%4])})):items;
      const group=instances(g,mats[part],tinted,`university-${kind}-${part}`,part!=='glass'&&part!=='glow');
      if(['glass','trim','glow'].includes(part))(ctx.cullGroups ||= []).push({root:group,dist:780});
    }
    for(const p of items){
      for(const b of a.solid){
        // Small rotated tiles follow the footprint; one enclosing AABB would block angled forecourts.
        const nx=Math.ceil(b.w/6),nz=Math.ceil(b.d/6),w=b.w/nx,d=b.d/nz;
        for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const r=boundsOf(localRect(p,b.x-b.w/2+(i+.5)*w,b.z-b.d/2+(j+.5)*d,w,d));colliders.add(r.x0,r.z0,r.x1,r.z1,'amenity',p.id,b.top);}
      }
      // Compact, readable signage, without separate downloaded image assets.
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;const g=canvas.getContext('2d');g.fillStyle='#333e3b';g.fillRect(0,0,512,64);g.fillStyle='#f2e5c6';g.font='600 28px Georgia,serif';g.textAlign='center';g.textBaseline='middle';g.fillText(p.name.toUpperCase(),256,32,490);
      const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(kind==='pavilion'?15:22,1.15),new THREE.MeshStandardMaterial({map:tex,emissiveMap:tex,emissive:0xffffff,emissiveIntensity:.25}));const q=campusPoint(p,0,a.front+7.16);sign.position.set(q.x,a.signY,q.z);sign.rotation.y=p.rot;root.add(sign);
    }
  }
  // Individual forecourts: separate planted edges, occasional basins and small garden seats.
  const lawnMat=stdMat(T,T.lawn);
  for(const q of plan.roundabouts){
    mesh(cyl(34,34,.12,64,0x77925a,{x:q.x,y:.06,z:q.z}),lawnMat,`${q.id}-garden`);
    for(let i=0;i<20;i++){const a=i*Math.PI/10;bushes.push({x:q.x+28*Math.cos(a),z:q.z+28*Math.sin(a)});}
    trees.push({x:q.x,z:q.z});
  }
  for(let i=0;i<plan.precincts.length;i++){
    const p=plan.precincts[i];
    for(const side of [-1,1]){
      const q=campusPoint(p,side*(p.plaza.w/2-4),p.plaza.z+3);benches.push({...q,rot:p.rot+side*Math.PI/2});
      const l=campusPoint(p,side*(p.plaza.w/2-2),p.plaza.z-9);lamps.push(l);lights.push({...l,r:10});colliders.add(l.x-.2,l.z-.2,l.x+.2,l.z+.2,'lamp',null,7);
      for(let t=-20;t<=20;t+=8){const b=campusPoint(p,side*(p.plaza.w/2+8),p.plaza.z+t);if(treeSafe(b.x,b.z))bushes.push(b);}
    }
    if(i%5===0){const q=campusPoint(p,p.plaza.w/2-10,p.plaza.z);basins.push({...q,rot:p.rot});colliders.add(q.x-2.6,q.z-2.6,q.x+2.6,q.z+2.6,'pool',p.id,.8);}
    const wash=campusPoint(p,0,p.front+10);(plan.pools ||= []).push({...wash,sx:37,sz:16});
    // Offset garden lawns, different sizes and bearings, away from road mouths.
    const cx=(i%2?-1:1)*(p.plaza.w/2+20),cz=p.front+4;
    const lawn=localRect(p,cx,cz,24+i%3*5,30);const centre=campusPoint(p,cx,cz);
    if(treeSafe(centre.x,centre.z)&&lawn.every(([x,z])=>insideCampus(plan,x,z,14))){mesh(polygonsGeometry([[lawn]],.025),lawnMat,`university-garden-${i}`);for(const [dx,dz]of [[-6,-8],[7,9]]){const q=campusPoint(p,cx+dx,cz+dz);if(treeSafe(q.x,q.z))trees.push({...q,small:true});}}
  }
  trees.push(...forestSites(plan));
  // A low understory adds depth without needing grass blades or additional texture assets.
  for(let i=0;i<trees.length;i+=11){const q=trees[i],x=q.x+2,z=q.z-2;if(treeSafe(x,z))bushes.push({x,z});}
  const sp=plan.sports;mesh(patchGeo(sp.x,sp.z,sp.w,sp.h,4,.025),lawnMat,'university-sports-ground');
  const sportMarks=[];for(const x of [sp.x+5,sp.x+sp.w-5])sportMarks.push(patchGeo(x,sp.z+5,.25,sp.h-10,4,.08));for(const z of [sp.z+5,sp.z+sp.h/2,sp.z+sp.h-5])sportMarks.push(patchGeo(sp.x+5,z,sp.w-10,.25,4,.08));mesh(merge(sportMarks),new THREE.MeshStandardMaterial({color:0xf2eee4}),'university-pitch-lines');
  const goals=[];for(const z of [sp.z+5,sp.z+sp.h-5]){for(const x of [sp.x+sp.w/2-4,sp.x+sp.w/2+4]){goals.push(box(.15,3,.15,0xffffff,{x,z}));colliders.add(x-.15,z-.15,x+.15,z+.15,'sign',null,3);}goals.push(box(8,.15,.15,0xffffff,{x:sp.x+sp.w/2,y:3,z}));}mesh(merge(goals),mats.trim,'university-goals');
  for(const x of [sp.x-6,sp.x+sp.w+6])for(const z of [sp.z+14,sp.z+sp.h-14]){lamps.push({x,z});lights.push({x,z,r:40});}
  (plan.pools ||= []).push({x:sp.x+sp.w/2,z:sp.z+sp.h/2,sx:75,sz:120});
  const {x:gx,z:gz,width:gw}=plan.gate;
  const entrance=[];for(const side of [-1,1]){const x=gx+side*(gw/2+4);entrance.push(box(5,12,5,STONE,{x,z:gz}),box(6,.8,6,TRIM,{x,y:12.4,z:gz}));colliders.add(x-2.5,gz-2.5,x+2.5,gz+2.5,'gate',null,13);}
  entrance.push(box(gw+13,2.2,4,STONE,{x:gx,y:12.2,z:gz}),box(gw+14,.4,5,TRIM,{x:gx,y:13.5,z:gz}));mesh(merge(entrance),mats.stone,'university-entry');
  for(const side of [-1,1]){const sign=textBoard(32,1.7,['GVP UNIVERSITY'],'#333e3b','#f2e5c6','600 64px Georgia, serif');sign.position.set(gx,12.2,gz+side*2.05);sign.rotation.y=side<0?Math.PI:0;root.add(sign);}
  const lx=gx+gw/2+22,lz=gz-7;
  const lodge=mesh(merge([box(12,4.5,9,STONE,{x:lx,z:lz}),box(13,.5,10,TRIM,{x:lx,y:4.7,z:lz}),box(.1,2,5,DARK,{x:lx-6.1,y:2.5,z:lz})]),mats.stone,'university-lodge');lodge.castShadow=true;colliders.add(lx-6,lz-4.5,lx+6,lz+4.5,'amenity',null,5);
  for(const [x,z,text,rot]of [[1536,3410,'← WEST CAMPUS · EAST CAMPUS →',0],[1536,3330,'VILLAGE GATE ↑',0],[1462,3075,'← GVP AIRSTRIP',0]]){const sign=textBoard(14,1.4,[text],'#304940','#f2e5c6','600 64px Arial,sans-serif');sign.position.set(x,3,z);sign.rotation.y=rot;root.add(sign);}
  const benchGeo=merge([box(3.3,.2,.8,0x71563c,{y:.7}),box(3.3,.8,.12,0x71563c,{y:1.1,z:.4}),box(.18,.65,.65,DARK,{x:-1.2}),box(.18,.65,.65,DARK,{x:1.2})]);instances(benchGeo,new THREE.MeshStandardMaterial({vertexColors:true}),benches,'university-benches',true);
  instances(merge([cyl(2.6,2.6,.65,24,TRIM,{y:.325}),cyl(.5,.8,1.3,12,STONE,{y:.9})]),mats.trim,basins,'university-basins',true);
  instances(cyl(2.3,2.3,.08,24,0x568b98,{y:.68}),new THREE.MeshStandardMaterial({vertexColors:true,metalness:.4,roughness:.2}),basins,'university-basin-water');
  const poleGeo=merge([cyl(.1,.17,6.2,8,DARK,{y:3.1}),box(.8,.18,.8,DARK,{y:6.3}),box(.65,.16,.65,DARK,{y:5.55}),cyl(0,.7,.55,4,DARK,{y:6.6})]);instances(poleGeo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6}),lamps,'university-lanterns',true);instances(box(.46,.6,.46,0xffe4b7,{y:5.94}),ctx.lampHeadMat,lamps,'university-lantern-glass');ctx.lightPoints.push(...lights);
  const species=['tree_oak','tree_detailed','tree_fat','tree_default'],palette=[0x668653,0x7b945f,0x547c58,0x929d66],groups=species.map(()=>[]);let count=0;
  const occupied=new Set();plan.treeSites=[];
  for(const t of trees){
    if(random()>ctx.qualityPreset.treeDensity)continue;const cell=`${Math.round(t.x/4)},${Math.round(t.z/4)}`;if(occupied.has(cell))continue;occupied.add(cell);
    const s=(t.small ? .55 : ctx.universityTrees ? .85 : 1.15)+random()*.4,sp=Math.floor(random()*species.length),tint=.8+random()*.2;
    groups[sp].push({...t,rot:random()*Math.PI*2,sx:s,sy:s,sz:s,color:new THREE.Color(tint,tint,tint*.96)});
    colliders.add(t.x-.8*s,t.z-.8*s,t.x+.8*s,t.z+.8*s,'tree','university-forest',(ctx.universityTrees?[16,20,15,16][sp]:15)*s);plan.treeSites.push({x:t.x,z:t.z});count++;
  }
  const treeMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
  if(ctx.universityTrees)addUniversityTrees(ctx,root,groups);
  else groups.forEach((items,i)=>{
    const size=ctx.models[species[i]]?.size||new THREE.Vector3(7,10,7);
    const fallback=merge([cyl(.25,.4,size.y*.5,5,0x65523a),ico(1,0,palette[i],{y:size.y*.65,sx:size.x*.55,sy:size.y*.38,sz:size.z*.55})]);
    const geo=(ctx.models[species[i]]?.geo||fallback).clone(),colors=geo.attributes.color,c=new THREE.Color(),base=new THREE.Color(palette[i]);
    // Recolour foliage only; preserve bark. Species and per-tree brightness give restrained forest tones.
    for(let j=0;j<colors.count;j++){c.fromBufferAttribute(colors,j);if(c.g>c.r*1.1&&c.g>c.b*1.1){const light=.85+Math.min(1,c.g)*.3;c.copy(base).multiplyScalar(light);colors.setXYZ(j,c.r,c.g,c.b);}}
    const hi=instances(geo,treeMat,items,`university-trees-${i}`,true),lo=instances(fallback,treeMat,items,`university-trees-far-${i}`);ctx.lod.push({hi,lo});
  });
  const shrub=ctx.models.plant_bushDetailed?.geo||ico(1,0,0x426c38,{y:.7,sy:.6});instances(shrub,treeMat,bushes.map(q=>({...q,rot:random()*6.28,sx:1.5+random(),sy:1+random()*.4,sz:1.4+random()})),'university-understory');
  plan.treeCount=count;plan.lampCount=lamps.length;plan.shrubCount=bushes.length;
  registerCampus(world,plan);
}
