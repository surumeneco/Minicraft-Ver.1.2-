import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source=readFileSync('src/js/10-resource-packs.js','utf8');
const start=source.indexOf('function tintCanvas('),end=source.indexOf('async function packFiles(',start);
assert.ok(start>=0&&end>start);
const code=source.slice(start,end);

function setup({badStorage=false}={}){
 const events=[],messages=[],stored=[];
 let number=0;
 const canvas=name=>{
  const c={name,width:0,height:0};
  const context={
   putImageData:(image,x,y)=>events.push(['imageData',name,x,y]),
   drawImage:(image,...args)=>events.push(['draw',name,image.name,...args]),
   clearRect:(...args)=>events.push(['clear',name,...args]),
   getImageData:()=>({data:new Uint8ClampedArray([255,128,64,255])}),
   imageSmoothingEnabled:true
  };
  c.getContext=()=>context;
  c.toDataURL=()=> 'data:'+name+':'+c.width+'x'+c.height;
  return c;
 };
 const ac=canvas('atlas');
 const resources={
  1:{name:'stone',width:16,height:16},
  2:{name:'glass',width:64,height:64},
  3:{name:'grass_block_side',width:20,height:32},
  4:{name:'grass_block_side_overlay',width:128,height:128}
 };
 const ctx={
  Uint8ClampedArray,Map,Blob,Math,JSON,
  N:4,CO:8,RW:8,FM:['stone','glass','grass_block_side#s','missing'],
  FILES:new Set(['stone','glass','grass_block_side','grass_block_side_overlay']),
  TINT:{g:[128,255,128]},
  document:{createElement:tag=>{assert.equal(tag,'canvas');return canvas('temporary'+(++number));}},
  createImageBitmap:async blob=>{
   const data=new Uint8Array(await blob.arrayBuffer());
   if(!resources[data[0]])throw new Error('not a decodable image');
   return resources[data[0]];
  },
  ac,im:{kind:'base'},PK:'pack',
  tex:{needsUpdate:false,dispose:()=>events.push(['dispose'])},
  atlasStyle:{textContent:''},
  localStorage:{setItem:(key,value)=>{if(badStorage)throw new Error('storage full');stored.push([key,JSON.parse(value)]);}},
  toast:msg=>messages.push(msg)
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const apply=(ids)=>ctx.applyPack(new Map(Object.entries(ids).map(([k,v])=>[k,new Uint8Array([v])])));
 return {ctx,events,messages,stored,apply};
}
test('atlas copies base and paints selected tiles in declared index order',async()=>{
 const f=setup();
 const n=await f.apply({stone:1,grass_block_side:3,glass:2,grass_block_side_overlay:4});
 assert.equal(n,3);
 assert.equal(f.ctx.ac.width,512);
 assert.equal(f.ctx.ac.height,512);
 const onAtlas=f.events.filter(e=>e[1]==='atlas');
 assert.deepEqual(onAtlas,[
  ['draw','atlas','temporary1',0,0,512,512],
  ['draw','atlas','temporary2',0,0],
  ['clear','atlas',64,0,64,64],
  ['draw','atlas','temporary2',64,0],
  ['draw','atlas','temporary2',128,0],
  ['draw','atlas','temporary2',128,0]
 ]);
 assert.deepEqual(f.stored,[['pack',{n:4,d:'data:atlas:512x512'}]]);
 assert.equal(f.ctx.tex.needsUpdate,true);
 assert.match(f.ctx.atlasStyle.textContent,/data:atlas:512x512/);
 assert.equal(f.events.filter(e=>e[0]==='dispose').length,1);
});
test('source dimensions are cropped square and grass overlay is tinted only on second pass',async()=>{
 const f=setup();
 await f.apply({stone:1,glass:2,grass_block_side:3,grass_block_side_overlay:4});
 const draws=f.events.filter(e=>e[0]==='draw'&&e[1]==='temporary2');
 assert.deepEqual(draws,[
  ['draw','temporary2','stone',0,0,16,16,0,0,64,64],
  ['draw','temporary2','glass',0,0,64,64,0,0,64,64],
  ['draw','temporary2','grass_block_side',0,0,20,20,0,0,64,64],
  ['draw','temporary2','grass_block_side_overlay',0,0,128,128,0,0,64,64]
 ]);
 assert.equal(f.events.filter(e=>e[0]==='imageData'&&e[1]==='temporary2').length,1);
});
test('missing or invalid image files do not alter current atlas or persist settings',async()=>{
 const f=setup();
 assert.equal(await f.apply({other:1,stone:99}),0);
 assert.equal(f.events.length,0);
 assert.equal(f.stored.length,0);
});
test('quota failure preserves visual update and reports existing fallback warning',async()=>{
 const f=setup({badStorage:true});
 assert.equal(await f.apply({stone:1}),1);
 assert.deepEqual(f.messages,['※容量の都合で、次回起動時は標準テクスチャに戻ります']);
 assert.equal(f.ctx.tex.needsUpdate,true);
});
