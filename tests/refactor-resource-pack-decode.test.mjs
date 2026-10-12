import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source=readFileSync('src/js/10-resource-packs.js','utf8');
const helper=source.indexOf('async function decodePackImages(');
const apply=source.indexOf('async function applyPack(');
const old=source.indexOf('const bm={};for(const[k,v]of map)',apply);
const end=source.indexOf('const hits=collectPackHits(bm);',old);
assert.ok(apply>=0&&(helper>=0||(old>=0&&end>old)));
const body=helper>=0?source.slice(helper,apply):
 'async function decodePackImages(map){'+source.slice(old,end)+'return bm;}';

function setup({valid=[1,3],allowed=['stone','glass','oak']}={}){
 const events=[],validSet=new Set(valid);
 const ctx={Blob,Uint8Array,Map,FILES:new Set(allowed),
  createImageBitmap:async blob=>{
   assert.equal(blob.type,'image/png');
   const bytes=new Uint8Array(await blob.arrayBuffer()),id=bytes[0];
   events.push(['decode',id]);
   if(!validSet.has(id))throw new Error('invalid png');
   return {imageId:id,width:id*16,height:id*16};
  }
 };
 vm.createContext(ctx);vm.runInContext(body,ctx);
 return {events,decode:entries=>ctx.decodePackImages(new Map(entries.map(([name,id])=>[name,new Uint8Array([id])])))};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('only recognized filenames decode and successful bitmaps retain source map order',async()=>{
 const f=setup();
 const bm=await f.decode([['stone',1],['extra',2],['glass',3],['oak',1]]);
 assert.deepEqual(plain(bm),{
  stone:{imageId:1,width:16,height:16},
  glass:{imageId:3,width:48,height:48},
  oak:{imageId:1,width:16,height:16}
 });
 assert.deepEqual(f.events,[['decode',1],['decode',3],['decode',1]]);
});
test('invalid supported PNG is skipped and following images are still attempted',async()=>{
 const f=setup();
 const bm=await f.decode([['glass',2],['stone',1],['oak',3]]);
 assert.deepEqual(plain(bm),{
  stone:{imageId:1,width:16,height:16},
  oak:{imageId:3,width:48,height:48}
 });
 assert.deepEqual(f.events,[['decode',2],['decode',1],['decode',3]]);
});
test('unsupported-only and empty input both yield no decoded images',async()=>{
 const f=setup();
 assert.deepEqual(plain(await f.decode([['unknown',1]])),{});
 assert.deepEqual(plain(await f.decode([])),{});
 assert.deepEqual(f.events,[]);
});
