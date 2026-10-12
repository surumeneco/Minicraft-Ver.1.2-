import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source=readFileSync('src/js/05-entities.js','utf8');
const a=source.indexOf('let spT=-4,hpT=0;');
const b=source.indexOf('// ---- 矢 ----',a);
assert.ok(a>=0&&b>a);
const fragment=source.slice(a,b);
const init=fragment.lastIndexOf('updateHp();');
assert.ok(init>=0);
const code=fragment.slice(0,init);
function harness({hp=18,mobs=[]}={}){
 const events=[],live=[...mobs];
 const ctx={
  P:{x:0,z:0},mobs:live,Math,
  spawnMob:()=>events.push(['spawn']),
  updateHp:()=>events.push(['health']),
  rmMob:m=>{events.push(['remove',m.id]);live.splice(live.indexOf(m),1)},
  stepMob:(m,dt)=>events.push(['step',m.id,dt])
 };
 vm.createContext(ctx);vm.runInContext('let hp='+hp+';\n'+code,ctx);
 return {ctx,events,live,step:dt=>ctx.mobTick(dt),
  hp:()=>vm.runInContext('hp',ctx),setHp:value=>vm.runInContext('hp='+value,ctx),
  timers:()=>[vm.runInContext('spT',ctx),vm.runInContext('hpT',ctx)]};
}
test('spawn timer starts at -4, triggers only after greater than two seconds, then resets',()=>{
 const f=harness({hp:20});
 f.step(6);
 assert.equal(f.events.filter(e=>e[0]==='spawn').length,0);
 f.step(.01);
 assert.equal(f.events.filter(e=>e[0]==='spawn').length,1);
 assert.ok(Math.abs(f.timers()[0])<1e-10);
 f.step(2);
 assert.equal(f.events.filter(e=>e[0]==='spawn').length,1);
 f.step(.01);
 assert.equal(f.events.filter(e=>e[0]==='spawn').length,2);
});
test('health recovery occurs after four seconds, increments one and resets timer',()=>{
 const f=harness({hp:18});
 f.step(4);
 assert.equal(f.hp(),18);
 f.step(.01);
 assert.equal(f.hp(),19);
 assert.deepEqual(f.events.filter(e=>e[0]==='health'),[['health']]);
 assert.ok(Math.abs(f.timers()[1])<1e-10);
 f.step(4.01);
 assert.equal(f.hp(),20);
 assert.deepEqual(f.events.filter(e=>e[0]==='health'),[['health'],['health']]);
});
test('at full health recovery timer accumulates and becomes immediately eligible after later injury',()=>{
 const f=harness({hp:20});
 f.step(100);
 assert.equal(f.hp(),20);
 assert.equal(f.timers()[1],100);
 f.setHp(19);f.step(.01);
 assert.equal(f.hp(),20);
 assert.equal(f.timers()[1],0);
});
test('distant mob removal is done before nearby AI and preserves snapshot iteration order',()=>{
 const a={id:'near',x:0,z:0},b={id:'far',x:61,z:0},c={id:'at60',x:60,z:0};
 const f=harness({hp:20,mobs:[a,b,c]});f.step(.1);
 assert.deepEqual(f.events,[['step','near',.1],['remove','far'],['step','at60',.1]]);
 assert.deepEqual(f.live,[a,c]);
});
test('long update invokes at most one spawn per invocation and still updates nearby mob once',()=>{
 const m={id:'m',x:0,z:0},f=harness({mobs:[m],hp:18});
 f.step(50);
 assert.deepEqual(f.events,[['spawn'],['health'],['step','m',50]]);
 assert.equal(f.hp(),19);
});
