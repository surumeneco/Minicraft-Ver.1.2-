import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source=readFileSync('src/js/04-1-input.js','utf8');
const collisionStart=source.indexOf('function hit(');
const collisionEnd=source.indexOf('const hl=',collisionStart);
const holdStart=source.indexOf('// 左ボタン長押し中');
const holdEnd=source.indexOf('// ---- チェスト',holdStart);
assert.ok(collisionStart>=0&&collisionEnd>collisionStart,'collision section');
assert.ok(holdStart>=0&&holdEnd>holdStart,'held input section');
const collisionCode=source.slice(collisionStart,collisionEnd);
const holdCode=source.slice(holdStart,holdEnd);

function collisionFixture(block,shape=[0,0,0,1,1,1]){
 const calls=[];
 const NC=new Uint8Array(256),THIN=new Uint8Array(256);
 NC[42]=1;THIN[7]=1;
 const ctx={
  Math,R:.2,HT:1.8,NC,THIN,blockBaseId:v=>v&255,
  getB:(x,y,z)=>(x===0&&y===2&&z===0?block:0),
  solid:v=>v!==0,
  boxes:(...args)=>{calls.push(args);return [shape]}
 };
 vm.createContext(ctx);vm.runInContext(collisionCode,ctx);
 return {
  calls,
  normal:()=>vm.runInContext('hit(.5,2,.5,.2,1.8)',ctx),
  swimming:()=>vm.runInContext('hitSwim(.5,1.82,.5)',ctx)
 };
}

test('walk and swim collision exclude noncollidable base IDs even with encoded state',()=>{
 for(const value of [42,42|(1<<8),42|(29<<8)]){
  const f=collisionFixture(value);
  assert.equal(f.normal(),false);assert.equal(f.swimming(),false);
  assert.equal(f.calls.length,0,'pass-through blocks never consult boxes');
 }
});

test('walk and swim collision use actual shape for thin encoded blocks',()=>{
 for(const value of [7,7|(13<<8),7|(29<<8)]){
  const occupied=collisionFixture(value);
  assert.equal(occupied.normal(),true);assert.equal(occupied.swimming(),true);
  assert.ok(occupied.calls.length>0);
  const missed=collisionFixture(value,[0,0,0,.1,.1,.1]);
  assert.equal(missed.normal(),false);assert.equal(missed.swimming(),false);
 }
});

test('collision preserves the existing full-block shortcut only for unencoded values',()=>{
 const basic=collisionFixture(6,[0,0,0,.1,.1,.1]);
 assert.equal(basic.normal(),true);assert.equal(basic.swimming(),true);
 assert.equal(basic.calls.length,0);
 const encoded=collisionFixture(6|(13<<8),[0,0,0,.1,.1,.1]);
 assert.equal(encoded.normal(),false);assert.equal(encoded.swimming(),false);
 assert.ok(encoded.calls.length>0);
});

function heldPlacementFixture(){
 const events=[];
 const ctx={
  Math,pauseMenuOpen:false,msg:{style:{display:'none'}},inv:false,
  locked:true,fallback:false,target:{x:1,y:2,z:3},value:0,
  getB:()=>ctx.value,blockBaseId:v=>v&255,
  CONTB:new Set([12]),LEVER:21,STONE_BUTTON:22,PRESSURE:23,
  RED_DUST:24,REPEATER:25,COMPARATOR:26,OBSERVER:27,DISPENSER:28,DROPPER:29,
  dispatchEvent:event=>events.push(event),
  MouseEvent:class {constructor(type,options){this.type=type;Object.assign(this,options)}},
  addEventListener:()=>{},setInterval:()=>0,clearInterval:()=>{},
  document:{getElementById:()=>({style:{display:'none'}})},
  hot:[3],sel:0,isItem:()=>false,ITEMS:{},pickMob:()=>null
 };
 vm.createContext(ctx);vm.runInContext(holdCode,ctx);
 vm.runInContext('rightPlaceHeld=true',ctx);
 return {ctx,events,repeat:()=>vm.runInContext('repeatHeldBlockPlacement()',ctx)};
}

test('right-hold target classification ignores state for every interactive block',()=>{
 const f=heldPlacementFixture();
 for(const id of [12,21,22,23,24,25,26,27,28,29])
  for(const state of [0,1,13,29]){
   f.ctx.value=id|(state<<8);
   f.repeat();
   assert.equal(f.events.length,0,'interactive block '+id+' state '+state);
  }
 f.ctx.value=3|(29<<8);f.repeat();
 assert.equal(f.events.length,1,'noninteractive encoded block still repeats');
 assert.deepEqual([f.events[0].type,f.events[0].button,f.events[0].cancelable],['mousedown',2,true]);
});
