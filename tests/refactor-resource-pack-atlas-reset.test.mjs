import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source=readFileSync('src/js/10-resource-packs.js','utf8');
const resetAt=source.indexOf('function resetPack(){');
const extractedAt=source.indexOf('function restoreDefaultPackAtlas(');
const begin=extractedAt>=0?extractedAt:resetAt;
const savedRestore=source.indexOf('function restoreSavedPackAtlas(',resetAt);
const end=savedRestore>=0?savedRestore:source.indexOf('try{const sp=JSON.parse(',resetAt);
assert.ok(resetAt>=0&&end>begin,'reset pack section');
const code=source.slice(begin,end);

function fixture({removeThrows=false,paintThrows=false}={}){
 const calls=[],im={pixels:'original'};
 let width=1,height=1;
 const ac={
  set width(value){width=value;calls.push(['width',value])},
  get width(){return width},
  set height(value){height=value;calls.push(['height',value])},
  get height(){return height},
  getContext(type){
   calls.push(['getContext',type]);
   return {putImageData:(data,x,y)=>{
    calls.push(['putImageData',data===im,x,y]);
    if(paintThrows)throw Error('canvas');
   }};
  }
 };
 const ctx={
  PK:'minicraft_pack',CO:5,RW:3,im,ac,
  localStorage:{removeItem:key=>{calls.push(['remove',key]);if(removeThrows)throw Error('quota')}},
  refreshAtlas:()=>calls.push(['refreshAtlas']),
  toast:msg=>calls.push(['toast',msg])
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,calls,ac};
}

test('reset removes saved pack, resizes to native tile dimensions and repaints before notifying',()=>{
 const f=fixture();f.ctx.resetPack();
 assert.equal(f.ac.width,80);assert.equal(f.ac.height,48);
 assert.deepEqual(f.calls,[
  ['remove','minicraft_pack'],['width',80],['height',48],
  ['getContext','2d'],['putImageData',true,0,0],
  ['refreshAtlas'],['toast','標準テクスチャに戻しました']
 ]);
});

test('failure to remove saved pack does not prevent original atlas restoration and notification',()=>{
 const f=fixture({removeThrows:true});f.ctx.resetPack();
 assert.deepEqual(f.calls,[
  ['remove','minicraft_pack'],['width',80],['height',48],
  ['getContext','2d'],['putImageData',true,0,0],
  ['refreshAtlas'],['toast','標準テクスチャに戻しました']
 ]);
});

test('canvas paint failure is not silently suppressed or reported as a successful reset',()=>{
 const f=fixture({paintThrows:true});
 assert.throws(()=>f.ctx.resetPack(),/canvas/);
 assert.deepEqual(f.calls,[
  ['remove','minicraft_pack'],['width',80],['height',48],
  ['getContext','2d'],['putImageData',true,0,0]
 ]);
});
