import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=readFileSync('src/js/07-fluids.js','utf8');
const helpers=source.indexOf('function fluidStepDue(');
const start=helpers>=0?helpers:source.indexOf('function fluidTick(dt){');
const end=source.indexOf('// ---- バケツ ----',start);
assert.ok(start>=0&&end>start, 'fluid tick scheduler exists');
const scheduler=source.slice(start,end);

function setup(onCell){
 const called=[],applied=[];
 const FQ=[new Map(),new Map()],FAC=[0,0],FIV=[.25,.5];
 const ctx={
  FQ,FAC,FIV,Map,
  rk:(x,y,z)=>x+','+y+','+z,
  fluidCell:(k,x,y,z,changes)=>{
   called.push([k,x,y,z]);
   if(onCell)onCell(k,x,y,z,changes,FQ);
   else changes.push([x,y,z,k]);
  },
  applyChanges:changes=>applied.push([...changes])
 };
 vm.createContext(ctx);
 vm.runInContext(scheduler,ctx);
 const add=(k,x,y=0,z=0)=>FQ[k].set(ctx.rk(x,y,z),[x,y,z]);
 return {ctx,FQ,FAC,called,applied,add};
}

test('water and lava keep independent tick intervals and batch notifications',()=>{
 const s=setup();
 s.add(0,10);s.add(1,20);
 s.ctx.fluidTick(.24);
 assert.deepEqual(s.called,[]);
 s.ctx.fluidTick(.01);
 assert.deepEqual(s.called,[[0,10,0,0]]);
 assert.deepEqual(s.applied,[[[10,0,0,0]]]);
 s.ctx.fluidTick(.25);
 assert.deepEqual(s.called,[[0,10,0,0],[1,20,0,0]]);
 assert.deepEqual(s.applied.at(-1),[[20,0,0,1]]);
 assert.ok(Math.abs(s.FAC[0])<1e-10);
 assert.ok(Math.abs(s.FAC[1])<1e-10);
});

test('a fluid tick processes at most 1800 cells and queues the remainder in order',()=>{
 const s=setup();
 for(let x=0;x<1802;x++)s.add(0,x);
 s.ctx.fluidTick(.25);
 assert.equal(s.called.length,1800);
 assert.deepEqual(s.called[0],[0,0,0,0]);
 assert.deepEqual(s.called.at(-1),[0,1799,0,0]);
 assert.deepEqual([...s.FQ[0].keys()],['1800,0,0','1801,0,0']);
 assert.equal(s.applied.length,1);
 assert.equal(s.applied[0].length,1800);
 s.ctx.fluidTick(.25);
 assert.equal(s.called.length,1802);
 assert.equal(s.FQ[0].size,0);
 assert.equal(s.applied[1].length,2);
});

test('large delta runs each fluid only once and clamps accumulated time',()=>{
 const s=setup();
 s.add(0,1);s.add(1,2);
 s.ctx.fluidTick(2);
 assert.deepEqual(s.called,[[0,1,0,0],[1,2,0,0]]);
 assert.deepEqual(s.FAC,[0,0]);
 const t=setup();
 t.ctx.fluidTick(.6);
 assert.ok(Math.abs(t.FAC[0])<1e-10);
 assert.ok(Math.abs(t.FAC[1]-.1)<1e-10);
});

test('new cells scheduled during processing survive; no updates are applied when none are produced',()=>{
 const s=setup((k,x,y,z,changes,FQ)=>{
  if(k===0&&x===1)FQ[0].set('2,0,0',[2,0,0]);
 });
 s.add(0,1);
 s.ctx.fluidTick(.25);
 assert.deepEqual(s.called,[[0,1,0,0]]);
 assert.deepEqual([...s.FQ[0].values()],[[2,0,0]]);
 assert.equal(s.applied.length,0);
 s.ctx.fluidTick(.25);
 assert.deepEqual(s.called,[[0,1,0,0],[0,2,0,0]]);
});
