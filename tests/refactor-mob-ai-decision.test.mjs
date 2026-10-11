import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=readFileSync('src/js/05-entities.js','utf8');
const helperStart=source.indexOf('function chooseMobSpeed(');
const oldStart=source.indexOf('function stepMob(');
const aiStart=source.indexOf(' if(T.host&&dist<20',oldStart);
const aiEnd=source.indexOf(' if(m.fuse>0)',aiStart);
assert.ok(oldStart>=0&&(helperStart>=0||(aiStart>=0&&aiEnd>aiStart)));
const implementation=helperStart>=0?
 source.slice(helperStart,oldStart):
 'function chooseMobSpeed(m,dt,dx,dz,dist){const T=m.T;let mv=0;m.t+=dt;'+source.slice(aiStart,aiEnd)+' return mv;}';

function fixture({host=true,cr=false,rng=false,dist=1,dt=.2,random=.5}={}){
 const events=[];
 const m={T:{host,cr,rng,sp:4},x:0,y:0,z:0,yaw:0,t:2,
   atk:0,sh:0,turn:.1,go:false,fleeT:0,fuse:0};
 const ctx={
  P:{x:dist,y:0,z:0,yaw:0},shieldUp:false,shieldFlash:0,
  shieldFaces:()=>true,hurt:n=>events.push(['hurt',n]),
  shoot:()=>events.push(['shoot']),Math:Object.assign(Object.create(Math),{random:()=>random})
 };
 vm.createContext(ctx);
 vm.runInContext(implementation,ctx);
 const run=()=>ctx.chooseMobSpeed(m,dt,dist,0,dist);
 return {m,ctx,events,run};
}
test('hostile melee mob attacks once on cooldown and stops within reach',()=>{
 const s=fixture();
 assert.equal(s.run(),0);
 assert.deepEqual(s.events,[['hurt',3]]);
 assert.equal(s.m.atk,1);
 assert.equal(s.m.t,2.2);
 s.run();
 assert.equal(s.events.length,1);
});
test('ranged mob holds position at medium distance and shoots on timer',()=>{
 const s=fixture({rng:true,dist:8,dt:.3});
 assert.equal(s.run(),0);
 assert.deepEqual(s.events,[['shoot']]);
 assert.equal(s.m.sh,2);
});
test('creeper primes its fuse at close range without moving',()=>{
 const s=fixture({cr:true,dist:2.3});
 assert.equal(s.run(),0);
 assert.equal(s.m.fuse,1.4);
});
test('passive mob chooses a new random wandering direction and speed',()=>{
 const s=fixture({host:false,dist:30,dt:.2,random:.5});
 assert.equal(s.run(),2.4);
 assert.equal(s.m.turn,4);
 assert.equal(s.m.go,true);
 assert.equal(s.m.yaw,Math.PI);
});
