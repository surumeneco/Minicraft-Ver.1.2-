import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/04-1-input.js','utf8');
const first=src.indexOf("addEventListener('mousedown',e=>{");
const last=src.indexOf('function releaseMouseInput(',first);
assert.ok(first>=0&&last>first,'primary mouse handler section');
const handler=src.slice(first,last);

function fixture(value,selected=3){
 const writes=[],events=[],listeners={},gives=[],toasts=[];
 const math=Object.create(Math);math.random=()=>1;
 const ctx={
  Math:math,drag:false,pauseMenuOpen:false,msg:{style:{display:'none'}},inv:false,locked:true,fallback:false,
  document:{getElementById:()=>({style:{display:'none'}})},
  addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn)},
  target:{x:1,y:2,z:3,prev:[2,2,3],hy:.25},keys:{},
  getB:()=>ctx.value,value,setB:(...args)=>writes.push(args),
  blockBaseId:v=>v&255,blockState:v=>v>>8,
  hot:[selected],sel:0,isItem:()=>false,ITEMS:{},
  I:{bucket:100,waterBucket:101,lavaBucket:102,redstone:24,iron:12,diamond:14,apple:1000,
     rail:104,poweredRail:105,detectorRail:106,activatorRail:107},
  CONTB:new Set([30,70]),CHEST:30,
  LEVER:21,STONE_BUTTON:22,PRESSURE:23,RED_DUST:24,
  AXB:Object.assign(new Uint8Array(256),{5:1}),RSB:new Set([24]),
  openChest:(...args)=>events.push(['openChest',...args]),
  rsUse:(...args)=>{events.push(['rsUse',...args]);return ctx.rsUsed},
  rsUsed:false,breakRS:(...args)=>events.push(['breakRS',...args]),
  toast:msg=>toasts.push(msg),give:(...args)=>gives.push(args),
  pickMob:()=>null,attack:()=>{},invCount:{},
  take:()=>false,rsPlace:()=>99,solid:()=>false,
  NC:new Uint8Array(256),H:80,P:{x:100,y:100,z:100,yaw:0},R:.35,HT:1.8,
  SPG:150,spongeAbsorb:()=>{},
  RAIL:106,POWERED_RAIL:107,DETECTOR_RAIL:108,ACTIVATOR_RAIL:109
 };
 vm.createContext(ctx);vm.runInContext(handler,ctx);
 const mouse=button=>listeners.mousedown[0]({button,target:{closest:()=>false},preventDefault:()=>{}});
 return {ctx,writes,events,gives,toasts,mouse};
}

test('encoded containers open while plain chest defers to the old redstone-use route',()=>{
 const encoded=fixture(30|(29<<8));encoded.mouse(2);
 assert.equal(encoded.events[0][0],'openChest');
 assert.equal(encoded.writes.length,0);
 const plain=fixture(30);plain.ctx.rsUsed=true;plain.mouse(2);
 assert.deepEqual(plain.events.map(e=>e[0]),['rsUse']);
 assert.equal(plain.writes.length,0);
 const other=fixture(70);other.mouse(2);
 assert.equal(other.events[0][0],'openChest');
});

test('lever toggle continues using encoded state, without changing its base ID',()=>{
 const off=fixture(21|(1<<8));off.mouse(2);
 assert.deepEqual(off.writes,[[1,2,3,21]]);
 assert.deepEqual(off.toasts,['レバー OFF']);
 const on=fixture(21);on.mouse(2);
 assert.deepEqual(on.writes,[[1,2,3,21|256]]);
 assert.deepEqual(on.toasts,['レバー ON']);
});

test('old 13-through-28 state rotation keeps XOR-four orientation transformation',()=>{
 for(const state of [13,17,24,28]){
  const f=fixture(56|(state<<8));f.mouse(2);
  assert.deepEqual(f.writes,[[1,2,3,56|((13+((state-13)^4))<<8)]]);
 }
});

test('breaking encoded axes drops the base item and encoded circuits keep their original value',()=>{
 const axis=fixture(5|(2<<8));axis.mouse(0);
 assert.deepEqual(axis.writes,[[1,2,3,0]]);
 assert.deepEqual(axis.gives,[[5,1]]);
 assert.equal(axis.events.filter(e=>e[0]==='breakRS').length,0);
 const circuit=fixture(24|(13<<8));circuit.mouse(0);
 assert.deepEqual(circuit.writes,[[1,2,3,0]]);
 assert.deepEqual(circuit.events.filter(e=>e[0]==='breakRS'),[['breakRS',1,2,3,24|(13<<8)]]);
 assert.equal(circuit.gives.length,0);
});

test('normal and encoded selected block IDs preserve placed state and coordinates',()=>{
 const chest=fixture(3,30);chest.mouse(2);
 assert.deepEqual(chest.writes,[[2,2,3,30|(31<<8)]]);
 const stateful=fixture(3,5|(13<<8));stateful.mouse(2);
 assert.deepEqual(stateful.writes,[[2,2,3,5|(13<<8)]]);
});
