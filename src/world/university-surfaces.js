import * as THREE from 'three';
import data from './generated/university-surfaces.json';
import { campusPlanKey } from './university-plan.js';
import { stdMat } from './geo.js';
import { pointInPolygon } from '../util/math.js';
export function polygonsGeometry(polygons,y){
  const shapes=polygons.map(poly=>{
    const pts=ring=>ring.map(([x,z])=>new THREE.Vector2(x,-z));const s=new THREE.Shape(pts(poly[0]));for(const hole of poly.slice(1))s.holes.push(new THREE.Path(pts(hole)));return s;
  });
  const g=new THREE.ShapeGeometry(shapes);g.rotateX(-Math.PI/2);g.translate(0,y,0);const uv=g.attributes.uv,p=g.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,p.getX(i)/4,p.getZ(i)/4);return g;
}
export function buildCampusSurfaces(ctx,plan,root){
  if(data.key!==campusPlanKey(plan))throw new Error('Campus road cache is stale. Run npm run bake-campus.');
  const materials={asphalt:stdMat(ctx.T,ctx.T.asphalt),paving:stdMat(ctx.T,ctx.T.paving),sidewalk:stdMat(ctx.T,ctx.T.paving),curb:new THREE.MeshStandardMaterial({color:0xd9d2c0,roughness:.9,side:THREE.DoubleSide})};
  const lookup=new Map();
  for(const tile of data.tiles){lookup.set(`${Math.floor(tile.x/400)},${Math.floor(tile.z/400)}`,tile);
    for(const key of Object.keys(materials))if(tile[key]){const mesh=new THREE.Mesh(polygonsGeometry(tile[key],key==='curb'?.14:key==='sidewalk'?.12:.06),materials[key]);mesh.receiveShadow=true;mesh.name=`university-${key}-${tile.x}-${tile.z}`;root.add(mesh);}
  }
  // Vertical kerb faces close the raised edge; a flat ribbon exposes grass from the driver's eye level.
  for(const tile of data.tiles){if(!tile.curb)continue;const pos=[];
    for(const poly of tile.curb)for(const ring of poly)for(let i=1;i<ring.length;i++){const [ax,az]=ring[i-1],[bx,bz]=ring[i];pos.push(ax,.025,az,bx,.025,bz,bx,.14,bz,ax,.025,az,bx,.14,bz,ax,.14,az);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.computeVertexNormals();const m=new THREE.Mesh(geo,materials.curb);m.name='university-kerb-faces';m.receiveShadow=true;root.add(m);
  }
  const has=(polys,x,z)=>polys?.some(poly=>pointInPolygon(x,z,poly[0])&&!poly.slice(1).some(h=>pointInPolygon(x,z,h)));
  plan.isPaved=(x,z)=>{const t=lookup.get(`${Math.floor(x/400)},${Math.floor(z/400)}`);return !!t&&['asphalt','paving','sidewalk','curb'].some(k=>has(t[k],x,z));};
  plan.surfaceData=data;plan.paved=[];
}
