import {rng} from '../util/math.js';
import {insideCampus,inAirfield,inBox,nearestCampusRoad} from './university-plan.js';

// Shared planting exclusions keep both the visible canopy and trunk colliders off access routes.
export function canPlant(plan,x,z){
  if(x>-12&&x<3012&&z>-12&&z<3012)return false;
  if(!insideCampus(plan,x,z,22)||inAirfield(plan,x,z,22)||inBox(plan.arrival,x,z,10))return false;
  if(plan.precincts.some(p=>p.boxes.some(b=>inBox(b,x,z,12))||inBox(p.courtBox,x,z,10)))return false;
  const s=plan.sports;if(x>s.x-14&&x<s.x+s.w+14&&z>s.z-14&&z<s.z+s.h+14)return false;
  return nearestCampusRoad(plan,x,z).dist>13;
}
export function forestSites(plan){
  const random=rng(738211),sites=[];
  // Jittered coverage fills all plantable ground instead of leaving isolated groves in a lawn ring.
  // Density reduction happens at render quality selection; the canonical footprint is stable.
  for(let z=-700;z<3650;z+=11.5)for(let x=-700;x<3650;x+=11.5){
    if(x>0&&x<3000&&z>0&&z<3000)continue;
    const px=x+(random()-.5)*8,pz=z+(random()-.5)*8;
    if(canPlant(plan,px,pz))sites.push({x:px,z:pz});
  }
  return sites;
}
