import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=readFileSync('src/js/05-entities.js','utf8');
const helper=source.indexOf('function advanceArrowMotion(');
const start=source.indexOf('function arrowTick(');
const end=source.indexOf('// ---- 雲',start);
assert.ok(start>=0&&end>start,'arrow tick section present');
const code=source.slice(helper>=0?helper:start,end);

function fixture({block=0,own=false,mobs=[],shield=false,player={x:0,y:1,z:0}}={}){
 const graphics=[],removed=[],targetHits=[],hurts=[],killed=[];
 const g={position:{set:(...p)=>graphics.push(['position',...p])},lookAt:(...p)=>graphics.push(['aim',...p])};
 const a={g,x:0,y:2,z:0,vx:2,vy:3,vz:0,life:6,own};
 const arrows=[a];
 const ctx={
  arrows,mobs,P:player,TARGET:27,
  Math:Object.assign(Object.create(Math),{random:()=>.5}),
  getB:()=>block,solid:v=>v!==0,
  targetHit:(...args)=>targetHits.push(args.slice(0,3)),
  rmMob:m=>killed.push(m),hurt:n=>hurts.push(n),
  shieldUp:shield,shieldFlash:0,shieldBlocks:()=>true,
  scene:{remove:obj=>removed.push(obj)}
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {a,arrows,mobs,graphics,removed,targetHits,hurts,killed,ctx,run:(dt=.1)=>ctx.arrowTick(dt)};
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,String(a)+' != '+String(b));

test('arrow applies gravity before translation and updates the visual transform',()=>{
 const f=fixture({player:{x:30,y:1,z:30}});
 f.run();
 close(f.a.life,5.9);close(f.a.vy,2);close(f.a.x,.2);close(f.a.y,2.2);
 assert.equal(f.arrows.length,1);
 assert.equal(f.graphics.length,2);
 assert.deepEqual(f.graphics[0],['position',.2,2.2,0]);
 assert.deepEqual(f.graphics[1],['aim',2.2,4.2,0]);
});

test('solid target hits are reported before projectile cleanup',()=>{
 const f=fixture({block:27,player:{x:30,y:1,z:30}});
 f.run();
 assert.deepEqual(f.targetHits,[[0,2,0]]);
 assert.equal(f.arrows.length,0);
 assert.equal(f.removed.length,1);
 assert.deepEqual(f.graphics,[]);
});

test('player-owned projectile damages a mob and removes a killed target',()=>{
 const mob={x:.2,z:0,y:1,T:{w:1,h:2},hp:5};
 const f=fixture({own:true,mobs:[mob],player:{x:30,y:1,z:30}});
 f.run();
 assert.equal(mob.hp,0);
 assert.deepEqual(f.killed,[mob]);
 assert.equal(f.arrows.length,0);
 assert.equal(f.hurts.length,0);
});

test('hostile projectile hurts the player unless the shield blocks',()=>{
 const plain=fixture();plain.run();
 assert.deepEqual(plain.hurts,[3]);
 assert.equal(plain.arrows.length,0);
 const protectedPlayer=fixture({shield:true});protectedPlayer.run();
 assert.deepEqual(protectedPlayer.hurts,[]);
 close(protectedPlayer.ctx.shieldFlash,.15);
 assert.equal(protectedPlayer.arrows.length,0);
});

test('expired arrow is removed even with no solid block',()=>{
 const f=fixture({player:{x:30,y:1,z:30}});
 f.a.life=.05;f.run();
 assert.equal(f.arrows.length,0);
 assert.equal(f.removed.length,1);
});
