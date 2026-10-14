import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source=readFileSync('src/js/04-1-input.js','utf8');
const listenerAt=source.indexOf("addEventListener('mouseup',");
const helperAt=source.indexOf('function releaseMouseInput(');
const start=helperAt>=0?helperAt:listenerAt;
const end=source.indexOf('// 左ボタン長押し中',listenerAt);
assert.ok(listenerAt>=0&&end>start,'mouseup release section');
const code=source.slice(start,end);

function fixture(overrides={}){
 const calls=[],listeners=new Map();
 const ctx={
  foodRightHeld:true,foodEatTimer:101,
  drag:true,rightPlaceHeld:true,rightPlaceTimer:202,
  leftBreakHeld:true,leftBreakTimer:303,
  pauseMenuOpen:true,inv:true,
  addEventListener:(name,handler)=>listeners.set(name,handler),
  clearTimeout:id=>calls.push(['clearTimeout',id]),
  clearInterval:id=>calls.push(['clearInterval',id]),
  ...overrides
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,calls,release:()=>listeners.get('mouseup')()};
}

test('mouseup unconditionally clears food, drag and both long-press operations in original order',()=>{
 const f=fixture();
 f.release();
 for(const name of ['foodRightHeld','drag','rightPlaceHeld','leftBreakHeld'])
  assert.equal(f.ctx[name],false,name);
 for(const name of ['foodEatTimer','rightPlaceTimer','leftBreakTimer'])
  assert.equal(f.ctx[name],0,name);
 assert.deepEqual(f.calls,[
  ['clearTimeout',101],['clearInterval',202],['clearInterval',303]
 ]);
});

test('mouseup resets timers even when no press was active, without checking pause or inventory state',()=>{
 const f=fixture({
  foodRightHeld:false,drag:false,rightPlaceHeld:false,leftBreakHeld:false,
  foodEatTimer:0,rightPlaceTimer:0,leftBreakTimer:0
 });
 f.release();f.release();
 assert.deepEqual(f.calls,[
  ['clearTimeout',0],['clearInterval',0],['clearInterval',0],
  ['clearTimeout',0],['clearInterval',0],['clearInterval',0]
 ]);
});
