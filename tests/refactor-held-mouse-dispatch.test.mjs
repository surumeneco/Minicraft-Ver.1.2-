import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source=readFileSync('src/js/04-1-input.js','utf8');
const begin=source.indexOf('// 左ボタン長押し中');
const end=source.indexOf('// ---- チェスト',begin);
assert.ok(begin>=0&&end>begin);
const section=source.slice(begin,end);

function fixture(){
 const handlers={},intervals=[],events=[],cleared=[];
 const ctx={
  addEventListener:(name,fn)=>(handlers[name]??=[]).push(fn),
  setInterval:(fn,delay)=>{intervals.push({fn,delay});return intervals.length},
  clearInterval:id=>cleared.push(id),
  dispatchEvent:ev=>events.push(ev),
  MouseEvent:class {constructor(type,options){this.type=type;Object.assign(this,options)}},
  pauseMenuOpen:false,msg:{style:{display:'none'}},inv:false,locked:true,fallback:false,
  target:{x:0,y:2,z:0,t:2},pickMob:()=>null,getB:()=>3,blockBaseId:v=>v&255,
  hot:[7],sel:0,isItem:()=>false,ITEMS:{},
  document:{getElementById:()=>({style:{display:'none'}})},
  CONTB:new Set([20]),LEVER:21,STONE_BUTTON:22,PRESSURE:23,RED_DUST:24,
  REPEATER:25,COMPARATOR:26,OBSERVER:27,DISPENSER:28,DROPPER:29
 };
 vm.createContext(ctx);vm.runInContext(section,ctx);
 const down=(button,target={closest:()=>false})=>{
  for(const fn of handlers.mousedown||[])fn({button,target});
 };
 return {ctx,intervals,events,cleared,down,
  tick:index=>intervals[index].fn(),
  read:name=>vm.runInContext(name,ctx)};
}

test('held left press dispatches a cancellable synthetic mousedown at 180ms',()=>{
 const f=fixture();f.down(0);
 assert.equal(f.intervals.length,1);assert.equal(f.intervals[0].delay,180);
 assert.equal(f.read('leftBreakHeld'),true);
 f.tick(0);assert.equal(f.events.length,1);
 assert.deepEqual([f.events[0].type,f.events[0].button,f.events[0].bubbles,f.events[0].cancelable],['mousedown',0,true,true]);
 assert.deepEqual(f.cleared,[0]);
});

test('held left press suppresses repeats when a mob is closer, target vanishes or hold ends',()=>{
 const f=fixture();f.down(0);
 f.ctx.pickMob=()=>({t:1,m:{id:1}});f.tick(0);assert.equal(f.events.length,0);
 f.ctx.pickMob=()=>null;f.ctx.target=null;f.tick(0);assert.equal(f.events.length,0);
 f.ctx.target={t:2};vm.runInContext('leftBreakHeld=false',f.ctx);f.tick(0);
 assert.equal(f.events.length,0);
});

test('held right press repeats ordinary placement while ignoring interactive target blocks',()=>{
 const f=fixture();f.down(2);assert.equal(f.intervals.length,1);
 assert.equal(f.intervals[0].delay,180);assert.equal(f.read('rightPlaceHeld'),true);
 f.tick(0);assert.equal(f.events.length,1);
 assert.deepEqual([f.events[0].type,f.events[0].button,f.events[0].bubbles,f.events[0].cancelable],['mousedown',2,true,true]);
 for(const block of [20,21,22,23,24,25,26,27,28,29]){
  f.ctx.getB=()=>block;f.tick(0);
 }
 assert.equal(f.events.length,1);
 f.ctx.getB=()=>3;f.ctx.inv=true;f.tick(0);assert.equal(f.events.length,1);
});

test('right hold ignores food and unready input conditions without scheduling an interval',()=>{
 const food=fixture();food.ctx.isItem=()=>true;food.ctx.ITEMS[7]={type:'food'};
 food.down(2);assert.equal(food.intervals.length,0);
 const closed=fixture();closed.ctx.pauseMenuOpen=true;closed.down(2);
 assert.equal(closed.intervals.length,0);
 const lost=fixture();lost.ctx.locked=false;lost.ctx.fallback=false;lost.down(0);
 assert.equal(lost.intervals.length,0);
});
