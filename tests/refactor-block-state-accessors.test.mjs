import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function registry(){
 const source=readFileSync('src/js/01-block-registry.js','utf8');
 const ctx={
  THREE:{},innerWidth:1024,Math,
  document:{createElement:()=>({
   getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(1024)})})
  })}
 };
 vm.createContext(ctx);
 vm.runInContext(source,ctx);
 return ctx;
}
const evaluate=(ctx,source)=>vm.runInContext(source,ctx);

test('block state encoding retains 8-bit ID and high-byte state contract',()=>{
 const ctx=registry();
 const cases=[[0,0,0],[24,0,24],[255,13,255|(13<<8)],[7,11,7|(11<<8)],[253,29,253|(29<<8)]];
 for(const [id,state,encoded] of cases){
  assert.equal(encoded&255,id);
  assert.equal(encoded>>8,state);
 }
 assert.equal(evaluate(ctx,'BT.length-1'),255);
 assert.equal(evaluate(ctx,'PL.every(v=>BT[v&255]!=null)'),true);
 assert.equal(evaluate(ctx,'PL.some(v=>(v&255)===255&&(v>>8)===13)'),true);
});

test('liquid classification uses base ID irrespective of encoded block state',()=>{
 const ctx=registry();
 for(const state of [0,1,8,13,29]){
  assert.equal(evaluate(ctx,'isW('+(24|(state<<8))+')'),true);
  assert.equal(evaluate(ctx,'isL('+(25|(state<<8))+')'),true);
  assert.equal(evaluate(ctx,'isW('+(25|(state<<8))+')'),false);
  assert.equal(evaluate(ctx,'isL('+(24|(state<<8))+')'),false);
 }
 assert.equal(evaluate(ctx,'isW(0)'),false);
 assert.equal(evaluate(ctx,'isL(0)'),false);
});
