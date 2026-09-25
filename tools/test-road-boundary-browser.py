# Requires Python Playwright and a running game; BOUNDARY_QA_URL / BOUNDARY_QA_OUT override defaults.
from playwright.sync_api import sync_playwright
import json,os,pathlib
OUT=pathlib.Path(os.environ.get('BOUNDARY_QA_OUT','/tmp/gvp-road-boundary-qa'));OUT.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get('BOUNDARY_QA_URL','http://127.0.0.1:5173')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--use-angle=metal'])
 page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def boot():
  page.goto(BASE+'/?quality=medium&vehicle=car',wait_until='networkidle');page.wait_for_function('!!window.__svd',timeout=90000)
  page.locator('#start-btn').click();page.evaluate('()=>{__svd.finishSwoop();__svd.loop.running=false;__svd.loop.paused=true;}');page.wait_for_timeout(100)
 def settings():
  page.keyboard.press('Escape');page.locator('[data-act="settings"]').click();page.wait_for_timeout(400)
 boot();assert page.evaluate('__svd.settings.get("roadBoundary")') is False
 settings();switch=page.get_by_role('switch',name='Road-boundary collisions');assert switch.get_attribute('aria-checked')=='false'
 switch.click();assert page.evaluate('__svd.car.roadBoundaryEnabled') and switch.get_attribute('aria-checked')=='true'
 switch.press('Space');assert not page.evaluate('__svd.car.roadBoundaryEnabled')
 switch.press('Space');assert page.evaluate('__svd.car.roadBoundaryEnabled')
 switch.press('Enter');assert page.evaluate('__svd.car.roadBoundaryEnabled') is False
 page.keyboard.press('ArrowRight');assert page.evaluate('__svd.car.roadBoundaryEnabled')
 page.evaluate('()=>{for(let i=0;i<20;i++)__svd.loop.render(.016,1)}');page.screenshot(path=str(OUT/'settings-verified.png'))
 boot();assert page.evaluate('__svd.car.roadBoundaryEnabled'),'reload persistence'
 result=page.evaluate('''async()=>{const S=__svd,C=S.car,B=S.ctx.roadBoundary,inp={throttle:1,brake:0,steer:0,handbrake:false,boost:false},out={},check=(x,m)=>{if(!x)throw Error(m)},fits=()=>B.fits(C.x,C.z,C.yaw,C.halfL,C.halfW);
 const r=S.world.roads.find(r=>r.kind==='10m'),x=r.x+r.w/2,z=r.y+r.h/2;
 C.reset(x,z,0);for(let i=0;i<500;i++)C.step(1/120,inp);out.on={x:C.x,z:C.z,fits:fits()};check(fits(),'on keeps body inside');
 S.settings.set('roadBoundary',false);C.reset(x,z,0);for(let i=0;i<500;i++)C.step(1/120,inp);out.off={x:C.x,z:C.z,fits:fits()};check(!fits(),'off permits footpath crossing');
 let t=performance.now();S.settings.set('roadBoundary',true);out.recoveryMs=performance.now()-t;check(fits()&&B.clear(C.x,C.z,C.yaw,C.halfL,C.halfW),'offroad activation recovery');
 C.reset(-950,-850,2.2);check(fits(),'offroad reset corrected');
 const target=S.ctx.parkedRegistry.find(e=>!e.taken&&e.x>2075&&e.x<2180&&e.z>2350&&e.z<2500);check(target,'parked car found');
 C.reset(target.x+6,target.z,Math.PI/2);S.swap.update();check(S.swap.nearest,'swap reachable with boundaries');let count=S.ctx.parkedRegistry.length;await S.swap.swap();check(S.ctx.parkedRegistry.length===count+1&&fits(),'swap preserves safe footprint');out.swap=S.swap.current.name;
 S.enterBoat();const boatX=S.boat.x;S.settings.set('roadBoundary',false);S.settings.set('roadBoundary',true);check(S.G.boating&&C.frozen&&S.boat.x===boatX,'toggle while boating');S.exitBoat();check(!C.frozen&&fits(),'boat return');
 S.enterPlane({silent:true});const planeX=S.plane.x;S.settings.set('roadBoundary',false);S.settings.set('roadBoundary',true);check(S.G.flying&&C.frozen&&S.plane.x===planeX,'toggle while flying');S.exitPlane({silent:true});check(!C.frozen&&fits(),'plane return');
 // Sweep every village road centre and both divided carriageways. Avoid end caps
 // where a perpendicular road or a wall dictates the available turning envelope.
 out.roadSamples=0;out.roadSampleFailures=[];for(const r of S.world.roads){const len=r.horizontal?r.w:r.h;for(let d=8;d<len-8;d+=24)for(const off of r.kind==='spine'?[-7.5,7.5]:[0]){const px=r.horizontal?r.x+d:r.x+r.w/2+off,pz=r.horizontal?r.y+r.h/2:r.y+d;out.roadSamples++;if(!B.fits(px,pz,r.horizontal?Math.PI/2:0,2.3,.95))out.roadSampleFailures.push({id:r.id,px,pz});}}
 // Parking lot can be reached across the junction opposite the residential street.
 C.reset(2062.3,2449.95,Math.PI/2);for(let i=0;i<650;i++)C.step(1/120,inp);check(C.x>2080&&fits(),'parking access across junction');out.parkingAccess={x:C.x,z:C.z};
 // Measure CPU cost on the same route after warming its surface tiles.
 out.cpu={};for(const enabled of [false,true]){S.settings.set('roadBoundary',enabled);C.reset(1507.35,1500,0);for(let i=0;i<240;i++)C.step(1/120,inp);let t=performance.now();for(let i=0;i<10000;i++)C.step(1/120,{...inp,steer:0});out.cpu[enabled?'onMsPerStep':'offMsPerStep']=(performance.now()-t)/10000;}
 S.settings.set('roadBoundary',true);let cacheT=performance.now();for(const key of B.cells.keys()){const [gx,gz]=key.split(',').map(Number);B.region(gx,gz);}out.surfaceTiles=B.cache.size;out.remainingTilesBuildMs=performance.now()-cacheT;check(!out.roadSampleFailures.length,'all village road centre samples');return out;}''')
 print(json.dumps(result,indent=2),flush=True);(OUT/'results.json').write_text(json.dumps(result,indent=2))
 settings();page.get_by_text('Restore defaults',exact=True).click();assert not page.evaluate('__svd.car.roadBoundaryEnabled');assert switch.get_attribute('aria-checked')=='false'
 print('PASS mouse, keyboard, persistence, defaults, on/off driving, offroad reset, car swap, boat and plane transitions, parking access. Browser errors:',errors,flush=True);assert not errors
 b.close()
