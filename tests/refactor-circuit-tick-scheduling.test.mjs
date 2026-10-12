import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/06-circuits.js','utf8');
const helper=src.indexOf('function advanceCircuitClock(');
const tick=src.indexOf('function circuitTick(');
const end=src.indexOf('function breakRS(',tick);
assert.ok(tick>=0&&end>tick,'circuit scheduler present');
const code=src.slice(helper>=0?helper:tick,end);

function setup(){
 const events=[],ctx={
  fluidTick:dt=>events.push(['fluid',dt]),
  rsTick:()=>events.push(['rs']),
  primedTick:dt=>events.push(['tnt',dt]),
  animTick:dt=>events.push(['piston',dt])
 };
 vm.createContext(ctx);
 vm.runInContext('let rsAcc=0;\n'+code,ctx);
 return {ctx,events,step:dt=>ctx.circuitTick(dt),acc:()=>vm.runInContext('rsAcc',ctx)};
}
const near=(v,w)=>assert.ok(Math.abs(v-w)<1e-12,v+' != '+w);

test('fluid update always precedes circuits, TNT and piston updates',()=>{
 const f=setup();f.step(.1);
 assert.deepEqual(f.events,[['fluid',.1],['rs'],['tnt',.1],['piston',.1]]);
 near(f.acc(),0);
});

test('short frames accumulate until a 0.1-second redstone tick is due',()=>{
 const f=setup();f.step(.04);f.step(.04);
 assert.equal(f.events.filter(x=>x[0]==='rs').length,0);
 near(f.acc(),.08);
 f.step(.02);
 assert.equal(f.events.filter(x=>x[0]==='rs').length,1);
 near(f.acc(),0);
 assert.deepEqual(f.events.slice(-4),[['fluid',.02],['rs'],['tnt',.02],['piston',.02]]);
});

test('long frame caps circuit processing to three updates and retains limited debt',()=>{
 const f=setup();f.step(.55);
 assert.equal(f.events.filter(x=>x[0]==='rs').length,3);
 near(f.acc(),.25);
 f.events.length=0;f.step(0);
 assert.equal(f.events.filter(x=>x[0]==='rs').length,2);
 near(f.acc(),.05);
});

test('large frame drops excessive accumulated debt instead of indefinitely catching up',()=>{
 const f=setup();f.step(.75);
 assert.equal(f.events.filter(x=>x[0]==='rs').length,3);
 near(f.acc(),0);
 f.events.length=0;f.step(0);
 assert.deepEqual(f.events,[['fluid',0],['tnt',0],['piston',0]]);
});
