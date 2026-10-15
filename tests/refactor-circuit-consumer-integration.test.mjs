import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/06-circuits.js','utf8');
const powerStart=src.indexOf('function outAt('),powerEnd=src.indexOf('function targetHit(',powerStart);
const tickStart=src.indexOf('function spreadDustLevels('),tickEnd=src.indexOf('function advanceCircuitClock(',tickStart);
assert.ok(powerStart>=0&&powerEnd>powerStart&&tickStart>=0&&tickEnd>tickStart);
const code=src.slice(powerStart,powerEnd)+'\n'+src.slice(tickStart,tickEnd);
const ids={
 RED_DUST:10,RED_LAMP:11,RBLK:12,RED_TORCH:13,LEVER:14,
 STONE_BUTTON:15,PRESSURE:16,TARGET:17,OBSERVER:18,
 REPEATER:19,COMPARATOR:20,PISTON:21,STICKY_PISTON:22,
 DISPENSER:23,DROPPER:24,HOPPER:25,TNTB:26
};
function harness(){
 const blocks=new Map(),registry=new Map(),events=[];
 const rk=(x,y,z)=>x+','+y+','+z;
 const getB=(x,y,z)=>blocks.get(rk(x,y,z))||0;
 const ctx={...ids,Map,Math,rk,
  D4:[[0,0,1],[1,0,0],[0,0,-1],[-1,0,0]],
  D6:[[0,0,1],[1,0,0],[0,0,-1],[-1,0,0],[0,1,0],[0,-1,0]],
  RSB:new Set(Object.values(ids)),RS:registry,P:{x:0,y:100,z:0},mobs:[],
  chests:{},CONTB:new Map(),getB,
  EM:new Map(),DL:new Map(),circuitOn:false,
  applyChanges:ch=>{events.push(['apply',JSON.parse(JSON.stringify(ch))]);for(const[x,y,z,v]of ch)blocks.set(rk(x,y,z),v)},
  ignite:(x,y,z,fuse)=>{events.push(['ignite',x,y,z,fuse]);blocks.set(rk(x,y,z),0)},
  pistonTick:(c,p)=>events.push(['piston',c.x,p]),
  fireCont:c=>events.push(['fire',c.x]),
  hopperStep:c=>events.push(['hopper',c.x])
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const put=(bs,x,y,z,s=0)=>{
  blocks.set(rk(x,y,z),bs|(s<<8));
  const c={x,y,z};registry.set(rk(x,y,z),c);return c;
 };
 const state=(x,y,z)=>getB(x,y,z)>>8;
 const level=(x,y,z)=>ctx.DL.get(rk(x,y,z))||0;
 return {ctx,put,blocks,events,rk,state,level,run:()=>ctx.rsTick()};
}

test('live power block drives adjacent dust, propagates signal, lights lamp and shuts off on removal',()=>{
 const f=harness();
 f.put(ids.RBLK,0,10,0);f.put(ids.RED_DUST,1,10,0);
 f.put(ids.RED_DUST,2,10,0);f.put(ids.RED_LAMP,3,10,0);
 f.run();
 assert.equal(f.level(1,10,0),15);
 assert.equal(f.level(2,10,0),14);
 assert.equal(f.state(1,10,0),15);
 assert.equal(f.state(2,10,0),14);
 assert.equal(f.state(3,10,0),1);
 assert.deepEqual(f.events[0],['apply',[[1,10,0,10|(15<<8)],[2,10,0,10|(14<<8)],[3,10,0,11|256]]]);
 f.blocks.set(f.rk(0,10,0),0);
 f.run();
 assert.equal(f.level(1,10,0),0);assert.equal(f.level(2,10,0),0);
 assert.equal(f.state(3,10,0),0);
 assert.equal(f.ctx.RS.has(f.rk(0,10,0)),false);
});

test('repeater delays new power then emits toward downstream dust and lamp, not backward',()=>{
 const f=harness();
 f.put(ids.RBLK,0,10,0);
 const rep=f.put(ids.REPEATER,1,10,0,1); // face east
 f.put(ids.RED_DUST,2,10,0);
 f.put(ids.RED_LAMP,3,10,0);
 f.run();assert.equal(rep.pv,true);assert.equal(rep.on,false);assert.equal(f.state(3,10,0),0);
 f.run();assert.equal(rep.on,true);assert.equal(f.state(1,10,0),17);
 assert.equal(f.state(3,10,0),0);
 f.run();assert.equal(f.level(2,10,0),15);assert.equal(f.state(3,10,0),1);
 f.blocks.set(f.rk(0,10,0),0);
 f.run();assert.equal(rep.on,true);
 f.run();assert.equal(rep.on,false);
 f.run();assert.equal(f.state(3,10,0),0);
});

test('TNT receives source power and ignites only once after its block is removed',()=>{
 const f=harness();
 f.put(ids.RBLK,0,10,0);
 f.put(ids.TNTB,1,10,0);
 f.run();
 assert.deepEqual(f.events.filter(e=>e[0]==='ignite'),[['ignite',1,10,0,4]]);
 f.run();
 assert.equal(f.events.filter(e=>e[0]==='ignite').length,1);
 assert.equal(f.ctx.RS.has(f.rk(1,10,0)),false);
});

test('powered dispenser triggers on rising edge, not every tick, then re-arms after power loss',()=>{
 const f=harness();
 f.put(ids.RBLK,0,10,0);
 const c=f.put(ids.DISPENSER,1,10,0);
 f.run();f.run();
 assert.deepEqual(f.events.filter(e=>e[0]==='fire'),[['fire',1]]);
 assert.equal(c.pw,true);
 f.blocks.set(f.rk(0,10,0),0);f.run();assert.equal(c.pw,false);
 f.put(ids.RBLK,0,10,0);f.run();
 assert.deepEqual(f.events.filter(e=>e[0]==='fire'),[['fire',1],['fire',1]]);
});
