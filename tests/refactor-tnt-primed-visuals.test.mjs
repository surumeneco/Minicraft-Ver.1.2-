import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/06-circuits.js','utf8');
const start=src.indexOf('function primedTick(');
const end=src.indexOf('// ---- メインtick',start);
assert.ok(start>=0&&end>start,'TNT fuse and explosion FX update section');

function graphic(name,events){
 return {
  position:{set:(x,y,z)=>events.push([name,'position',x,y,z])},
  scale:{setScalar:s=>events.push([name,'scale',s])},
  material:{opacity:0}
 };
}
function fixture({floor=false,primed=[],fxs=[]}={}){
 const events=[];
 const objects=primed.map((p,i)=>({
  ...p,g:graphic('tnt'+i,events),m:{},b:{}
 }));
 const visuals=fxs.map((f,i)=>({...f,g:graphic('fx'+i,events)}));
 const white={color:'white'},red={color:'red'},band={color:'band'};
 const ctx={
  primed:objects,fxs:visuals,
  tMatW:white,tMatR:red,tMatB:band,
  solid:()=>floor,getB:()=>floor?3:0,Math,
  scene:{remove:g=>events.push(['remove',g])},
  blast:(x,y,z)=>{
   events.push(['blast',x,y,z]);
   const fx=graphic('createdFX',events);
   visuals.push({g:fx,t:0});
  }
 };
 vm.createContext(ctx);vm.runInContext(src.slice(start,end),ctx);
 return {ctx,objects,visuals,white,red,band,events,run:dt=>ctx.primedTick(dt)};
}

test('active TNT advances fuse, material flash and gravity before updating position',()=>{
 const f=fixture({primed:[{x:1.5,y:5,z:-2,t:1.8,vy:0}]});
 f.run(.1);
 assert.equal(f.ctx.primed.length,1);
 assert.equal(f.objects[0].t,1.7);
 assert.ok(Math.abs(f.objects[0].vy+1.2)<1e-12);
 assert.ok(Math.abs(f.objects[0].y-4.88)<1e-12);
 assert.equal(f.objects[0].m.material,f.white);
 assert.equal(f.objects[0].b.material,f.white);
 assert.deepEqual(f.events,[
  ['tnt0','scale',1.06],
  ['tnt0','position',1.5,4.88,-2]
 ]);
});

test('falling TNT collides at floor and explodes after moving its visual mesh',()=>{
 const f=fixture({floor:true,primed:[{x:.5,y:2,z:.5,t:.1,vy:0}]});
 f.run(.2);
 assert.equal(f.ctx.primed.length,0);
 assert.equal(f.objects[0].y,2);assert.equal(f.objects[0].vy,0);
 assert.equal(f.objects[0].m.material,f.red);assert.equal(f.objects[0].b.material,f.band);
 assert.deepEqual(f.events.slice(0,5).map(e=>e[0]),['tnt0','tnt0','remove','blast','createdFX']);
 assert.deepEqual(f.events.find(e=>e[0]==='blast'),['blast',.5,2.5,.5]);
 assert.equal(f.visuals.length,1);
 assert.equal(f.visuals[0].t,.2);
 assert.equal(f.visuals[0].g.material.opacity,.32);
});

test('preexisting blast flashes are scaled, faded, removed when over .35 seconds',()=>{
 const f=fixture({fxs:[{t:.3}]});
 f.run(.1);
 assert.equal(f.visuals.length,0);
 assert.equal(f.events[0][0],'fx0');
 assert.equal(f.events[0][1],'scale');
 assert.ok(Math.abs(f.events[0][2]-5.3)<1e-12);
 assert.equal(f.events.at(-1)[0],'remove');
});

test('reverse iteration removes multiple detonated TNTs without skipping entities',()=>{
 const f=fixture({primed:[
  {x:0,y:4,z:0,t:.01,vy:0},
  {x:1,y:4,z:0,t:.01,vy:0}
 ]});
 f.run(.05);
 assert.equal(f.ctx.primed.length,0);
 assert.deepEqual(f.events.filter(e=>e[0]==='blast').map(e=>e[1]),[1,0]);
 assert.equal(f.visuals.length,2);
 assert.ok(f.visuals.every(v=>v.t===.05));
});
