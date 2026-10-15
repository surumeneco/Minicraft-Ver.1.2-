import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/05-entities.js','utf8');
const start=src.indexOf('function stepMob('),end=src.indexOf('function pickMob(',start);
assert.ok(start>=0&&end>start);
const code=src.slice(start,end);

function fixture({speed=2,move=(m)=>{m.x+=1;m.y+=.5;m.z+=2}}={}){
 const events=[];
 const ctx={P:{x:4,y:5,z:4},Math,
  chooseMobSpeed:(m,dt,dx,dz,dist)=>{events.push(['choose',dt,dx,dz,dist]);return speed},
  advanceMobPhysics:(m,dt,mv)=>{events.push(['physics',dt,mv]);move(m)},
  explode:m=>events.push(['explode',m]),
  rmMob:m=>events.push(['remove',m])};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const legs=Array.from({length:4},()=>({rotation:{x:100}}));
 const m={T:{host:1,h:1.8,w:.6},x:0,y:5,z:0,yaw:.6,wp:1,
  fuse:0,legs,
  g:{position:{set:(x,y,z)=>events.push(['position',x,y,z])},
   rotation:{y:0},scale:{setScalar:n=>events.push(['scale',n])}}};
 return {ctx,m,events};
}

test('mob pose applies leg swing, group position, and yaw after physics in original order',()=>{
 const f=fixture();
 f.ctx.stepMob(f.m,.5);
 assert.equal(f.m.wp,6);
 const swing=Math.sin(6)*.8;
 for(let i=0;i<4;i++)
  assert.equal(f.m.legs[i].rotation.x,swing*((i===0||i===3)?1:-1));
 assert.deepEqual(f.events.slice(0,3),[
  ['choose',.5,4,4,Math.hypot(4,4)],
  ['physics',.5,2],['position',1,5.5,2]
 ]);
 assert.equal(f.m.g.rotation.y,.6);
});

test('stationary mob resets visible leg rotations while retaining walk phase',()=>{
 const f=fixture({speed:0,move:()=>{}});
 f.ctx.stepMob(f.m,.25);
 assert.equal(f.m.wp,1);
 assert.deepEqual(f.m.legs.map(l=>l.rotation.x),[0,0,0,0]);
 assert.deepEqual(f.events.at(-1),['position',0,5,0]);
});

test('fuse expiration explodes immediately before physics or walking animation',()=>{
 const f=fixture();f.m.fuse=.05;
 f.ctx.stepMob(f.m,.1);
 assert.equal(f.events[1][0],'scale');
 assert.deepEqual(f.events.slice(2).map(e=>e[0]),['explode']);
 assert.equal(f.m.wp,1);
 assert.ok(f.m.fuse<=0);
});

test('mob falling below the world is removed without updating pose',()=>{
 const f=fixture({move:m=>{m.y=0}});
 f.ctx.stepMob(f.m,.2);
 assert.deepEqual(f.events.map(e=>e[0]),['choose','physics','remove']);
 assert.equal(f.m.wp,1);
});
