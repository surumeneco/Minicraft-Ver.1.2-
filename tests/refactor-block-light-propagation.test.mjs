import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const src=readFileSync('src/js/05-entities.js','utf8');
const helper=src.indexOf('function collectBlockLightSources(');
const start=helper>=0?helper:src.indexOf('function rebuildBlockLight(');
const end=src.indexOf('function blockLightAt(',start);
assert.ok(start>=0&&end>start,'light propagation section exists');

function setup(){
 const chunks=new Map();
 const key=(cx,cz)=>cx+','+cz;
 const pos=(x,y,z)=>x+','+y+','+z;
 function chunk(cx=0,cz=0){
  const c={cx,cz,top:8,d:new Uint16Array(16*16*8)};
  chunks.set(key(cx,cz),c);
  return c;
 }
 const set=(c,x,y,z,value)=>{c.d[(x&15)+16*((z&15)+16*y)]=value;};
 const ctx={
  H:8,C:chunks,ck:key,idx:(x,y,z)=>x+16*(z+16*y),
  blockLightCache:new Map([['old',1]]),blockLightDirty:true,
  isLightSource:v=>v===9,
  occl:v=>v===2,
  lightKey:pos,Map,Math
 };
 vm.createContext(ctx);
 vm.runInContext(src.slice(start,end),ctx);
 return {ctx,chunk,set,pos};
}

test('light source spreads to six neighbors and decays one level per step',()=>{
 const h=setup(),c=h.chunk();
 h.set(c,2,4,2,9);
 h.ctx.rebuildBlockLight();
 const light=h.ctx.blockLightCache;
 assert.equal(light.has('old'),false);
 assert.equal(light.get(h.pos(2,4,2)),15);
 assert.equal(light.get(h.pos(3,4,2)),14);
 assert.equal(light.get(h.pos(2,5,2)),14);
 assert.equal(light.get(h.pos(4,4,2)),13);
 assert.equal(light.has(h.pos(2,8,2)),false);
 assert.equal(h.ctx.blockLightDirty,false);
});

test('opaque neighboring cells block direct propagation',()=>{
 const h=setup(),c=h.chunk();
 h.set(c,2,4,2,9);h.set(c,3,4,2,2);
 h.ctx.rebuildBlockLight();
 assert.equal(h.ctx.blockLightCache.has(h.pos(3,4,2)),false);
 assert.equal(h.ctx.blockLightCache.get(h.pos(3,5,2)),13);
});

test('multiple light sources keep maximum brightness at overlaps',()=>{
 const h=setup(),c=h.chunk();
 h.set(c,2,3,2,9);h.set(c,4,3,2,9);
 h.ctx.rebuildBlockLight();
 const m=h.ctx.blockLightCache;
 assert.equal(m.get(h.pos(2,3,2)),15);
 assert.equal(m.get(h.pos(4,3,2)),15);
 assert.equal(m.get(h.pos(3,3,2)),14);
 assert.equal(m.get(h.pos(3,3,3)),13);
});

test('light propagates across adjacent loaded chunk boundaries',()=>{
 const h=setup(),left=h.chunk(0,0),right=h.chunk(1,0);
 h.set(left,15,4,2,9);
 h.set(right,0,4,2,2);
 h.ctx.rebuildBlockLight();
 assert.equal(h.ctx.blockLightCache.get(h.pos(15,4,2)),15);
 assert.equal(h.ctx.blockLightCache.has(h.pos(16,4,2)),false);
 assert.equal(h.ctx.blockLightCache.get(h.pos(16,5,2)),13);
});

test('no sources clears cache, and changes to a light source are reflected on rebuild',()=>{
 const h=setup(),c=h.chunk();
 h.ctx.rebuildBlockLight();
 assert.equal(h.ctx.blockLightCache.size,0);
 h.set(c,1,2,1,9);h.ctx.rebuildBlockLight();
 assert.equal(h.ctx.blockLightCache.get(h.pos(1,2,1)),15);
 h.set(c,1,2,1,0);h.ctx.rebuildBlockLight();
 assert.equal(h.ctx.blockLightCache.size,0);
});
