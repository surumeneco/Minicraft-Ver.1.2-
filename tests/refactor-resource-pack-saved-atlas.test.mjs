import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source=readFileSync('src/js/10-resource-packs.js','utf8');
const oldAt=source.indexOf("try{const sp=JSON.parse(localStorage.getItem(PK)||'null')");
const helperAt=source.indexOf('function restoreSavedPackAtlas(');
const begin=helperAt>=0?helperAt:oldAt;
const end=source.indexOf("{const fi=Object.assign(document.createElement('input')",oldAt);
assert.ok(oldAt>=0&&end>begin,'saved atlas startup section');

function fixture(value,{storageThrows=false}={}){
 const calls=[],images=[];
 const ctx={
  N:9,PK:'minicraft_pack',ac:{
   width:0,height:0,
   getContext(type){
    calls.push(['getContext',type]);
    return {
     set imageSmoothingEnabled(v){calls.push(['imageSmoothingEnabled',v])},
     drawImage:(img,x,y)=>calls.push(['drawImage',img===images[0],x,y])
    };
   }
  },
  localStorage:{getItem:key=>{calls.push(['getItem',key]);if(storageThrows)throw Error('storage');return value}},
  Image:class {
   constructor(){this.width=64;this.height=32;images.push(this);calls.push(['newImage'])}
   set src(v){calls.push(['src',v]);this._src=v}
  },
  refreshAtlas:()=>calls.push(['refreshAtlas'])
 };
 vm.createContext(ctx);vm.runInContext(source.slice(begin,end),ctx);
 return {ctx,calls,images};
}

test('matching persisted atlas schedules image decoding and restores canvas on load, in order',()=>{
 const f=fixture(JSON.stringify({n:9,d:'data:image/png;base64,aGVsbG8='}));
 assert.deepEqual(f.calls,[['getItem','minicraft_pack'],['newImage'],['src','data:image/png;base64,aGVsbG8=']]);
 f.images[0].onload();
 assert.equal(f.ctx.ac.width,64);assert.equal(f.ctx.ac.height,32);
 assert.deepEqual(f.calls.slice(3),[
  ['getContext','2d'],['imageSmoothingEnabled',false],
  ['drawImage',true,0,0],['refreshAtlas']
 ]);
});

test('wrong texture registry count leaves the default atlas untouched',()=>{
 const f=fixture(JSON.stringify({n:8,d:'unused'}));
 assert.deepEqual(f.calls,[['getItem','minicraft_pack']]);
 assert.equal(f.images.length,0);
});

test('missing, invalid JSON or failed localStorage get is ignored',()=>{
 for(const [value,opts] of [[null,{}],['{bad',{}],[null,{storageThrows:true}]]){
  const f=fixture(value,opts);
  assert.deepEqual(f.calls,[['getItem','minicraft_pack']]);
  assert.equal(f.images.length,0);
 }
});

test('image load failure without onload leaves atlas unchanged',()=>{
 const f=fixture(JSON.stringify({n:9,d:'bad'}));
 assert.equal(typeof f.images[0].onload,'function');
 assert.equal(f.ctx.ac.width,0);assert.equal(f.ctx.ac.height,0);
 assert.deepEqual(f.calls,[['getItem','minicraft_pack'],['newImage'],['src','bad']]);
});
