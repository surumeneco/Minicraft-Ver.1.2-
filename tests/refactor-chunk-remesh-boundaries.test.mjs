import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const world=readFileSync('src/js/03-world.js','utf8');
const circuits=readFileSync('src/js/06-circuits.js','utf8');
const worldSection=world.slice(world.indexOf('function remeshNb('),world.indexOf('let queue=[]'));
const batchSection=circuits.slice(circuits.indexOf('function applyChanges('),circuits.indexOf('const contAt='));
assert.ok(worldSection.startsWith('function remeshNb('));
assert.ok(batchSection.startsWith('function applyChanges('));

function setup(){
 const chunks=new Map(),meshed=[],loaded=[],hooks=[];
 const key=(cx,cz)=>cx+','+cz;
 const put=(cx,cz,v=true)=>{
  const c={cx,cz,v,top:2,d:new Uint16Array(16*16*10)};
  chunks.set(key(cx,cz),c);
  return c;
 };
 const center=put(0,0);
 put(-1,0);put(0,-1);put(1,0);put(0,1);
 const ctx={
  H:10,C:chunks,edits:new Map(),blockLightDirty:false,lightMeshDirty:new Set(),
  ck:key,idx:(x,y,z)=>x+16*(z+16*y),Math,Set,Map,
  getC:(cx,cz)=>{loaded.push(key(cx,cz));return chunks.get(key(cx,cz))||put(cx,cz,false);},
  mesh:c=>meshed.push(key(c.cx,c.cz)),
  rsReg:()=>hooks.push('rs'),fluidDirty:()=>hooks.push('fluid')
 };
 vm.createContext(ctx);
 vm.runInContext(worldSection,ctx);
 vm.runInContext(batchSection,ctx);
 return {ctx,center,chunks,meshed,loaded,hooks};
}

test('single writes redraw existing visible edge neighbors in axis order without loading missing ones',()=>{
 const h=setup();
 h.ctx.setB(0,2,0,3);
 assert.deepEqual(h.meshed,['0,0','-1,0','0,-1']);
 assert.deepEqual(h.loaded,['0,0']);
 h.meshed.length=0;h.loaded.length=0;
 h.ctx.setB(15,2,15,4);
 assert.deepEqual(h.meshed,['0,0','1,0','0,1']);
 assert.deepEqual(h.loaded,['0,0']);
 h.meshed.length=0;
 h.ctx.setB(15,2,15,4);
 assert.deepEqual(h.meshed,[]);
});

test('single writes do not redraw nonvisible neighbors, but redraw the center even if it is not visible',()=>{
 const h=setup();
 h.center.v=false;
 h.chunks.get('-1,0').v=false;
 h.ctx.setB(0,2,0,3);
 assert.deepEqual(h.meshed,['0,0','0,-1']);
});

test('batch writes load boundary neighbors and redraw each visible chunk only once',()=>{
 const h=setup();
 h.chunks.get('1,0').v=false;
 h.ctx.applyChanges([[0,2,0,3],[15,2,15,4],[15,2,15,4]]);
 assert.deepEqual(h.loaded,[
  '0,0','-1,0','0,-1',
  '0,0','1,0','0,1','0,0'
 ]);
 assert.deepEqual(h.meshed,['0,0','-1,0','0,-1','0,1']);
 assert.deepEqual(h.hooks,['rs','fluid','rs','fluid']);
});
