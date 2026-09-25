# Requires Python playwright and a running Vite dev server. Writes screenshots/results to CAMPUS_QA_OUT.
from playwright.sync_api import sync_playwright
import json,pathlib,os
OUT=pathlib.Path(os.environ.get('CAMPUS_QA_OUT','/tmp/gvp-campus-qa'));OUT.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get('CAMPUS_QA_URL','http://127.0.0.1:5173')
with sync_playwright() as p:
 chrome=os.environ.get('CHROME_BIN','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
 browser=p.chromium.launch(headless=True,**({'executable_path':chrome,'args':['--use-angle=metal']} if pathlib.Path(chrome).exists() else {}))
 page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:errors.append(e.text) if e.type=='error' and ('WebGLProgram' in e.text or '[boot]' in e.text) else None)
 page.goto(BASE+'/?quality=medium&vehicle=car',wait_until='networkidle');page.wait_for_function("!!window.__svd||!document.querySelector('#fatal').hidden",timeout=90000);assert page.evaluate('!!window.__svd'),page.locator('#fatal').inner_text()
 page.locator('#start-btn').click();page.evaluate('''()=>{const S=__svd;S.finishSwoop();S.loop.running=false;S.loop.paused=true;S.loop.render(.016,1);}''');page.wait_for_timeout(100)
 if os.environ.get('ROAD_BOUNDARY_QA')=='1': page.evaluate('__svd.settings.set("roadBoundary",true)')
 result=page.evaluate('''async()=>{
 const S=__svd,P=S.ctx.university,{pathSamples,projectPath,campusPoint,nearestCampusRoad,insideCampus}=await import('/src/world/university-plan.js'),{roadPlacement}=await import('/src/world/layout.js');
 const results={};const failures=[];const check=(ok,msg)=>{if(!ok)failures.push(msg);};
 check(S.car.x===P.spawn.x&&S.car.z===P.spawn.z,'outside spawn');
 check(S.world.L.farms.length===564&&S.world.L.villas.length===560&&S.world.L.townhouses.length===504,'CAD counts');
 let surfaceNormals=true;S.ctx.scene.getObjectByName('university').traverse(m=>{if(m.name.startsWith('university-asphalt-')){const n=m.geometry.attributes.normal;for(let i=0;i<n.count;i++)if(n.getY(i)<.99)surfaceNormals=false;}});check(surfaceNormals,'road surfaces upwards');
 results.campus={buildings:P.precincts.length,trees:P.treeCount,shrubs:P.shrubCount,lamps:P.lampCount};
 const outsideTrees=P.treeSites.filter(t=>!insideCampus(P,t.x,t.z,20));check(!outsideTrees.length,'trees restricted to campus interior');check(P.treeCount>10000,'woodland density');
 const rearTrees=P.treeSites.filter(t=>t.z<1500);check(rearTrees.length>P.treeCount*.4,'rear half filled with woodland');
 check(P.precincts.every(p=>p.z>1500&&p.footprints.flat().every(([x,z])=>insideCampus(P,x,z,19))),'all buildings inside front half');
 results.forest={rearTrees:rearTrees.length,outsideTrees:outsideTrees.length};
 check(!S.ctx.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'all terrain and foliage shaders compile');
 const blocked=[];let samples=0;
 for(const road of P.roads){for(const q of pathSamples(road,4)){
   for(const side of (road.loop?[-4,0,4]:[0])){
    S.car.reset(q.x+q.nx*side,q.z+q.nz*side,Math.atan2(q.dx,-q.dz));samples++;
    for(const pt of S.car.samplePoints())for(const c of S.ctx.colliders.near(pt.x,pt.z)){
      if(!c.dead&&pt.x>c.x0&&pt.x<c.x1&&pt.z>c.z0&&pt.z<c.z1){blocked.push({road:road.id,x:pt.x,z:pt.z,tag:c.tag,ref:c.ref,id:c.id});break;}
    }
   }
 }}
 results.roadEnvelopeSamples=samples;results.blocked=blocked.slice(0,20);check(blocked.length===0,`${blocked.length} obstructed road samples`);
 const neutral={throttle:1,brake:0,steer:0,handbrake:false,boost:false};
 const drives=[];
 for(const p of P.precincts){const a=p.road.points[1],b=p.road.points[0],len=Math.hypot(b.x-a.x,b.z-a.z);S.car.reset(a.x,a.z,Math.atan2(b.x-a.x,-(b.z-a.z)));S.car.takeEvents();let impact=0,maxOffroad=0;for(let i=0;i<6000&&Math.hypot(S.car.x-a.x,S.car.z-a.z)<len-4;i++){S.car.step(1/120,{...neutral,throttle:S.car.speed<9?1:0});impact+=S.car.takeEvents().filter(e=>e.type==='impact'||e.type==='stuckReset').length;if(S.car.offroad)maxOffroad++;}drives.push({name:p.name,len,travel:Math.hypot(S.car.x-a.x,S.car.z-a.z),impact,maxOffroad});check(!impact,`building drive ${p.name}`);check(Math.hypot(S.car.x-b.x,S.car.z-b.z)<6,`building entry ${p.name}`);check(!maxOffroad,`paved grip ${p.name}`);}
 results.buildingDrives=drives;
 // Navigate a complete lap using actual steering, maintaining 55 km/h on bends.
 const ring=P.roads[0];let progress=0,impact=0;const route=pathSamples(ring,8);S.car.reset(route[0].x,route[0].z,Math.atan2(route[0].dx,-route[0].dz));
 for(let step=0;step<200000&&progress<route.length-1;step++){
  while(progress<route.length-1&&Math.hypot(S.car.x-route[progress].x,S.car.z-route[progress].z)<20)progress++;
  const target=route[progress];const desired=Math.atan2(target.x-S.car.x,-(target.z-S.car.z));let delta=Math.atan2(Math.sin(desired-S.car.yaw),Math.cos(desired-S.car.yaw));
  S.car.step(1/120,{...neutral,throttle:S.car.speed<17?1:0,steer:Math.max(-1,Math.min(1,delta*2.7))});
  impact+=S.car.takeEvents().filter(e=>e.type==='impact'||e.type==='stuckReset').length;
 }
 results.fullLap={progress,total:route.length,impact};check(progress===route.length-1,'complete campus lap');check(!impact,'collision-free campus lap');
 // Both directions through the village gate and existing airstrip gate.
 results.links=[];
 for(const [x,z,yaw,ticks]of [[1500,3050,0,480],[1500,2970,Math.PI,480],[1500,3050,Math.PI,520]]){S.car.reset(x,z,yaw);for(let i=0;i<ticks;i++)S.car.step(1/120,neutral);const ev=S.car.takeEvents().filter(e=>e.type==='impact'||e.type==='stuckReset');results.links.push({x:S.car.x,z:S.car.z,impacts:ev.length});check(!ev.length,'gate/airstrip access');}
 S.enterPlane({silent:true});S.plane.reset(-410,1200,0);S.plane.y=150;S.plane.onGround=false;S.exitPlane({silent:true});check(S.car.x<0&&nearestCampusRoad(P,S.car.x,S.car.z).dist<.01,'airborne switch returns to campus road below');
 S.enterPlane({silent:true});for(let i=0;i<4800;i++)S.plane.step(1/120,{throttleUp:true,throttleDown:false,boost:true,pitch:S.plane.speed>28&&S.plane.y<60?.45:0,roll:0,yaw:0,handbrake:false});results.flight={x:S.plane.x,y:S.plane.y,z:S.plane.z,speed:S.plane.speed,crashed:S.plane.crashed,onGround:S.plane.onGround};check(!S.plane.crashed&&!S.plane.onGround&&S.plane.y>8,'runway takeoff');S.exitPlane({silent:true});
 S.enterBoat();check(S.G.boating,'boat enter');S.exitBoat();check(!S.G.boating&&!S.car.frozen,'boat return');
 S.car.reset(P.spawn.x,P.spawn.z,P.spawn.yaw);S.rig.snapTo(S.car);S.loop.render(.016,1);return{results,failures};}''')
 print(json.dumps({k:v for k,v in result.items() if k!='results'}),flush=True);print(json.dumps({k:v for k,v in result['results'].items() if k!='buildingDrives'},indent=2),flush=True)
 # Interact through the rendered map; click a location north of the old map bounds.
 page.locator('#minimap').click();page.screenshot(path=str(OUT/'campus-map.png'))
 bb=page.locator('#bigmap-canvas').bounding_box();x=bb['x']+(1710+1100)/5200*bb['width'];y=bb['y']+(-620+1100)/5200*bb['height']
 page.mouse.click(x,y);print('MAP_PIN',page.locator('#fly-text').inner_text(),flush=True);page.locator('#fly-btn').click()
 page.evaluate('''()=>{for(let i=0;i<330;i++)__svd.loop.render(1/60,1);}''');point=page.evaluate('({x:__svd.car.x,z:__svd.car.z})');print('MAP_TRAVEL',point,flush=True);assert abs(point['z']+620)<4
 if os.environ.get('ROAD_BOUNDARY_QA')=='1': assert page.evaluate('__svd.ctx.roadBoundary.fits(__svd.car.x,__svd.car.z,__svd.car.yaw,__svd.car.halfL,__svd.car.halfW)')
 # Settings open/close and outside reset hotkey.
 page.keyboard.press('r');page.evaluate('()=>__svd.loop.render(.016,1)');assert page.evaluate('__svd.car.z<0')
 page.keyboard.press('Escape');page.locator('[data-act="settings"]').click();page.screenshot(path=str(OUT/'settings-regression.png'));page.keyboard.press('Escape');assert page.evaluate('__svd.G.overlay===null')
 print('BROWSER_ERRORS',errors,flush=True);result['browserErrors']=errors;result['mapTravel']=point
 (OUT/'qa-results.json').write_text(json.dumps(result,indent=2))
 assert not result['failures'], result['failures'];assert not errors
 browser.close()
