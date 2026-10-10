import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const world = readFileSync('src/js/03-world.js', 'utf8');
const circuits = readFileSync('src/js/06-circuits.js', 'utf8');

function harness() {
 const chunks=new Map(), edits=new Map(), meshCalls=[], calls=[];
 const chunk=(cx,cz,rendered=true)=>{
  const key=cx+','+cz;
  if(!chunks.has(key)) chunks.set(key,{cx,cz,top:2,v:rendered,d:new Uint16Array(16*16*20)});
  return chunks.get(key);
 };
 chunk(0,0);chunk(-1,0);chunk(1,0);chunk(0,-1);chunk(0,1);
 const context={
  H:20, C:chunks, edits, lightMeshDirty:new Set(), blockLightDirty:false,
  ck:(x,z)=>x+','+z, idx:(x,y,z)=>x+16*(z+16*y),
  getC:(x,z)=>Math.abs(x)<=1&&Math.abs(z)<=1?chunk(x,z):null,
  mesh:c=>meshCalls.push(c.cx+','+c.cz),
  isLightSource:b=>b===7||b===8,
  rsReg:(x,y,z,old,v)=>calls.push(['circuit',old,v,edits.get('0,0')?.get(x+16*(z+16*y))]),
  fluidDirty:(x,y,z,old,v)=>calls.push(['fluid',old,v,edits.get('0,0')?.get(x+16*(z+16*y))]),
  Math,Set,Map,Uint16Array
 };
 vm.createContext(context);
 vm.runInContext(world.slice(world.indexOf('function remeshNb('),world.indexOf('let queue=[])),context);
 vm.runInContext(circuits.slice(circuits.indexOf('function applyChanges('),circuits.indexOf('const contAt=')),context);
 return {context,chunk,edits,meshCalls,calls};
}

test('direct block writes keep mutation, hook order, edit history, and lighting invalidation',()=>{
 const h=harness(),ctx=h.context,c=h.chunk(0,0);
 ctx.setB(2,3,4,7);
 assert.equal(c.d[2+16*(4+16*3)],7);
 assert.equal(c.top,4);
 assert.equal(ctx.blockLightDirty,true);
 assert.equal(h.edits.get('0,0').get(2+16*(4+16*3)),7);
 assert.deepEqual(h.calls,[['circuit',0,7,undefined],['fluid',0,7,undefined]]);
 assert.equal(ctx.lightMeshDirty.size,9);
 assert.deepEqual(h.meshCalls,['0,0']);
 ctx.setB(2,3,4,7);
 assert.deepEqual(h.meshCalls,['0,0']);
 assert.equal(h.calls.length,2);
 ctx.setB(0,3,4,8);
 assert.deepEqual(h.meshCalls.slice(-2),['0,0','-1,0']);
 ctx.setB(2,-1,4,7);
 ctx.setB(2,20,4,7);
 assert.equal(h.calls.length,4);
});

test('batch writes deduplicate meshes while preserving hook order and boundary update',()=>{
 const h=harness(),ctx=h.context,c=h.chunk(0,0);
 ctx.applyChanges([[1,2,1,7],[1,2,1,7],[15,2,1,8],[0,-1,1,7],[0,20,1,7],[33,2,1,9]]);
 assert.equal(c.d[1+16*(1+16*2)],7);
 assert.equal(c.d[15+16*(1+16*2)],8);
 assert.equal(c.top,3);
 assert.equal(h.edits.get('0,0').size,2);
 assert.deepEqual(h.calls,[
  ['circuit',0,7,7],['fluid',0,7,7],
  ['circuit',0,8,8],['fluid',0,8,8]
 ]);
 assert.deepEqual(h.meshCalls.sort(),['0,0','1,0']);
 assert.equal(ctx.lightMeshDirty.size,12);
 ctx.applyChanges([[1,2,1,7]]);
 assert.equal(h.meshCalls.length,2);
 assert.equal(h.calls.length,4);
});

test('ordinary block changes keep lighting cache invalidation without light-specific dirty chunks',()=>{
 const h=harness(),ctx=h.context;
 ctx.setB(2,2,2,3);
 assert.equal(ctx.blockLightDirty,true);
 assert.equal(ctx.lightMeshDirty.size,0);
});
