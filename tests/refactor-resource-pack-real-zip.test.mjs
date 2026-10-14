import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import vm from 'node:vm';
import {test} from 'node:test';

const source=readFileSync('src/js/10-resource-packs.js','utf8');
const start=source.indexOf('function scanZipBlockEntries(');
const end=source.indexOf('function tintCanvas(',start);
assert.ok(start>=0&&end>start,'ZIP scanning and extraction section');

function fixture(){
 const ctx={TextDecoder,DataView,Uint8Array,Response,Blob,DecompressionStream,Map,Error};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 return ctx;
}

// Byte-level ZIP local-file headers + central directory + end record.
// The PNG payload is a real 1x1 PNG, not a fabricated byte-array mock.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Z5sAAAAASUVORK5CYII=','base64');
function makeZip(entries){
 const locals=[],directory=[];let offset=0;
 for(const {path,data,method=8,packedOverride} of entries){
  const name=Buffer.from(path,'utf8'),raw=Buffer.from(data);
  const packed=packedOverride?Buffer.from(packedOverride):(method===8?deflateRawSync(raw):raw);
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
  local.writeUInt16LE(method,8);local.writeUInt32LE(packed.length,18);
  local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);
  locals.push(local,name,packed);
  const central=Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);
  central.writeUInt16LE(20,6);central.writeUInt16LE(method,10);
  central.writeUInt32LE(packed.length,20);central.writeUInt32LE(raw.length,24);
  central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
  directory.push(central,name);
  offset+=local.length+name.length+packed.length;
 }
 const directoryBytes=Buffer.concat(directory),eocd=Buffer.alloc(22);
 eocd.writeUInt32LE(0x06054b50,0);
 eocd.writeUInt16LE(entries.length,8);eocd.writeUInt16LE(entries.length,10);
 eocd.writeUInt32LE(directoryBytes.length,12);eocd.writeUInt32LE(offset,16);
 return Uint8Array.from(Buffer.concat([...locals,directoryBytes,eocd])).buffer;
}

test('real ZIP DEFLATE and stored PNG payloads survive extraction byte-for-byte',async()=>{
 const ctx=fixture();
 const zip=makeZip([
  {path:'assets/minecraft/textures/block/grass_block_top.png',data:png,method:8},
  {path:'assets/minecraft/textures/block/dirt.png',data:png,method:0},
  {path:'assets/minecraft/textures/item/apple.png',data:png,method:8}
 ]);
 const result=await ctx.readZip(zip);
 assert.deepEqual([...result.keys()],['grass_block_top','dirt']);
 assert.deepEqual(Buffer.from(result.get('grass_block_top')),png);
 assert.deepEqual(Buffer.from(result.get('dirt')),png);
 assert.equal(Buffer.from(result.get('grass_block_top')).subarray(1,4).toString(),'PNG');
});

test('case-folded duplicate block names replace earlier payloads in central-directory order',async()=>{
 const ctx=fixture();
 const zip=makeZip([
  {path:'assets/minecraft/textures/block/STONE.png',data:Buffer.from([1]),method:0},
  {path:'textures/block/stone.png',data:Buffer.from([2,3]),method:8},
  {path:'textures/block/ignored.png',data:Buffer.from([4]),method:99}
 ]);
 const entries=ctx.scanZipBlockEntries(zip);
 assert.equal(entries.length,3);
 const result=await ctx.readZip(zip);
 assert.deepEqual([...result.keys()],['stone']);
 assert.deepEqual([...result.get('stone')],[2,3]);
});

test('malformed real DEFLATE stream and missing end record preserve failure behavior',async()=>{
 const ctx=fixture();
 const broken=makeZip([{path:'textures/block/dirt.png',data:png,method:8,packedOverride:Buffer.from([0xff])}]);
 await assert.rejects(ctx.readZip(broken));
 await assert.rejects(ctx.readZip(new ArrayBuffer(30)),/zip/);
});
