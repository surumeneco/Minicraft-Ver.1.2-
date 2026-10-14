import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/06-circuits.js','utf8');
const rsAt=src.indexOf('function rsTick(){');
const helperAt=src.indexOf('function collectCircuitSignalSources(');
const start=helperAt>=0?helperAt:rsAt;
const end=src.indexOf('// Bound the number of redstone updates',rsAt);
assert.ok(rsAt>=0&&end>start);
const code=src.slice(start,end);

const ids={
 RBLK:1,RED_TORCH:2,LEVER:3,STONE_BUTTON:4,PRESSURE:5,TARGET:6,
 OBSERVER:7,REPEATER:8,COMPARATOR:9,RED_DUST:10,RED_LAMP:11,
 TNTB:12,PISTON:13,STICKY_PISTON:14,DISPENSER:15,DROPPER:16,HOPPER:17
};
function fixture(){
 const blocks=new Map(),RS=new Map(),calls=[];
 const rk=(x,y,z)=>x+','+y+','+z;
 const ctx={
  ...ids,RS,RSB:new Set(Object.values(ids)),P:{x:0,z:0},rk,
  getB:(x,y,z)=>blocks.get(rk(x,y,z))||0,
  D6:[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],
  D4:[[0,0,1],[1,0,0],[0,0,-1],[-1,0,0]],
  EM:new Map(),DL:new Map(),Map,Math,
  standing:()=>true,spreadDustLevels:()=>{},cpow:()=>0,
  calculateComparatorOutput:()=>2,
  updateRepeaterState:()=>{},updateObserverState:()=>{},
  applyChanges:ch=>calls.push(['apply',ch.length]),
  ignite:()=>{},pistonTick:()=>{},fireCont:()=>{},hopperStep:()=>{}
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const register=(type,x,y,z,{state=0,tm=0,pulse=0,out=0}={})=>{
  const c={x,y,z,tm,pulse,out},key=rk(x,y,z);blocks.set(key,type|(state<<8));RS.set(key,c);return c;
 };
 return {ctx,RS,blocks,register,rk,calls,run:()=>ctx.rsTick(),power:(x,y,z)=>ctx.EM.get(rk(x,y,z))||0};
}

test('constant power and powered levers emit six-sided signals with fixed strength',()=>{
 const f=fixture();
 f.register(ids.RBLK,0,10,0);
 f.register(ids.RED_TORCH,4,10,0);
 f.register(ids.LEVER,8,10,0);
 f.register(ids.LEVER,12,10,0,{state:1});
 f.run();
 for(const [dx,dy,dz] of f.ctx.D6){
  assert.equal(f.power(dx,10+dy,dz),15);
  assert.equal(f.power(4+dx,10+dy,dz),15);
  assert.equal(f.power(12+dx,10+dy,dz),15);
 }
 assert.equal(f.power(9,10,0),0);
 assert.equal(f.ctx.circuitOn,true);
});

test('observer, repeater and comparator emit on their facing sides using prior output',()=>{
 const f=fixture();
 const observer=f.register(ids.OBSERVER,0,12,0,{state:0,pulse:2});
 f.register(ids.REPEATER,5,12,0,{state:16});
 const comparator=f.register(ids.COMPARATOR,10,12,0,{state:0,out:7});
 f.run();
 assert.equal(f.power(0,12,-1),15);
 assert.equal(f.power(5,12,1),15);
 assert.equal(f.power(10,12,1),7);
 assert.equal(observer.pulse,1);
 assert.equal(comparator.out,2);
});

test('timers decrement before output; active pressure plate computes standing state',()=>{
 const f=fixture();
 const button=f.register(ids.STONE_BUTTON,0,10,0,{tm:2});
 const buttonExpiring=f.register(ids.STONE_BUTTON,4,10,0,{tm:1});
 const target=f.register(ids.TARGET,8,10,0,{tm:2});
 target.lvl=9;
 const pressure=f.register(ids.PRESSURE,12,10,0);
 const observer=f.register(ids.OBSERVER,16,10,0,{pulse:1});
 f.run();
 assert.equal(button.tm,1);assert.equal(buttonExpiring.tm,0);
 assert.equal(target.tm,1);assert.equal(observer.pulse,0);
 assert.equal(pressure.on,true);
 assert.equal(f.power(1,10,0),15);
 assert.equal(f.power(5,10,0),0);
 assert.equal(f.power(9,10,0),9);
 assert.equal(f.power(13,10,0),15);
 assert.equal(f.power(16,10,-1),0);
});

test('invalid registered blocks are removed but distant registrations stay untouched',()=>{
 const f=fixture();
 f.register(ids.RBLK,0,10,0);
 const dead=f.register(ids.RBLK,3,10,0);
 f.blocks.delete(f.rk(3,10,0));
 const distant=f.register(ids.RBLK,90,10,0);
 f.run();
 assert.equal(f.RS.has(f.rk(3,10,0)),false);
 assert.equal(f.RS.get(f.rk(90,10,0)),distant);
 assert.equal(f.power(91,10,0),0);
 assert.equal(f.power(1,10,0),15);
 assert.equal(dead.v,undefined);
});
