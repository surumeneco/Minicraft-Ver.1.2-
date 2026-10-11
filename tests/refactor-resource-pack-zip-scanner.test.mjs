import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const file=readFileSync('src/js/10-resource-packs.js','utf8');
const begin=file.indexOf('function scanZipBlockEntries(');
const start=begin>=0?begin:file.indexOf('async function readZip(');
const end=file.indexOf('function tintCanvas(',start);
assert.ok(start>=0&&end>start);
const source=file.slice(start,end);

function encodeZip(entries){
 const enc=new TextEncoder(),locals=[],centrals=[];
 let offset=0;
 for(const {name,method=0,bytes=[]} of entries){
  const filename=enc.encode(name),payload=new Uint8Array(bytes);
  const local=new Uint8Array(30+filename.length+payload.length),lv=new DataView(local.buffer);
  lv.setUint32(0,0x04034b50,true);
  lv.setUint16(8,method,true);
  lv.setUint32(18,payload.length,true);
  lv.setUint32(22,payload.length,true);
  lv.setUint16(26,filename.length,true);
  local.set(filename,30);local.set(payload,30+filename.length);
  const central=new Uint8Array(46+filename.length),cv=new DataView(central.buffer);
  cv.setUint32(0,0x02014b50,true);
  cv.setUint16(10,method,true);
  cv.setUint32(20,payload.length,true);
  cv.setUint32(24,payload.length,true);
  cv.setUint16(28,filename.length,true);
  cv.setUint32(42,offset,true);
  central.set(filename,46);
  locals.push(local);centrals.push(central);offset+=local.length;
 }
 const centralLength=centrals.reduce((n,c)=>n+c.length,0);
 const eocd=new Uint8Array(22),dv=new DataView(eocd.buffer);
 dv.setUint32(0,0x06054b50,true);
 dv.setUint16(8,entries.length,true);
 dv.setUint16(10,entries.length,true);
 dv.setUint32(12,centralLength,true);
 dv.setUint32(16,offset,true);
 const all=[...locals,...centrals,eocd],size=all.reduce((n,a)=>n+a.length,0);
 const bytes=new Uint8Array(size);let at=0;
 for(const a of all){bytes.set(a,at);at+=a.length;}
 return bytes.buffer;
}

async function parse(entries){
 const ctx={Uint8Array,DataView,Map,TextDecoder,Blob,Response,DecompressionStream,Error};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 const result=await ctx.readZip(encodeZip(entries));
 return [...result.entries()].map(([k,v])=>[k,Array.from(v)]);
}

test('ZIP reader preserves texture-block path filtering, case folding and local file bytes',async()=>{
 const got=await parse([
  {name:'assets/minecraft/textures/block/Stone.PNG',bytes:[1,2,3]},
  {name:'assets/minecraft/textures/item/stone.png',bytes:[9]},
  {name:'textures/block/oak_log.png',bytes:[4,5]},
  {name:'assets/minecraft/textures/block/subfolder/other.png',bytes:[7]}
 ]);
 assert.deepEqual(got,[['stone',[1,2,3]],['oak_log',[4,5]]]);
});

test('unsupported compression is skipped, and last duplicate filename wins',async()=>{
 const got=await parse([
  {name:'textures/block/wool.png',bytes:[1]},
  {name:'textures/block/not-supported.png',method:99,bytes:[5]},
  {name:'textures/block/WOOL.png',bytes:[9,10]}
 ]);
 assert.deepEqual(got,[['wool',[9,10]]]);
});

test('ZIP reader rejects buffers without an end-of-central-directory record',async()=>{
 const ctx={Uint8Array,DataView,Map,TextDecoder,Blob,Response,DecompressionStream,Error};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 await assert.rejects(ctx.readZip(new Uint8Array(32).buffer),/zip/);
});
