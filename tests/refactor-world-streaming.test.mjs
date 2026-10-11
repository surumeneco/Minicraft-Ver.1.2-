import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const world=readFileSync('src/js/03-world.js','utf8');
const start=world.indexOf('let queue=[],lcx=');
assert.ok(start>=0, 'chunk streaming section exists');
const streaming=world.slice(start);

function setup({rd=2,slow=false}={}){
 const chunks=new Map(),generated=[],drawn=[],disposed=[];
 const key=(cx,cz)=>cx+','+cz;
 let tick=0;
 const ctx={
  RD:rd,P:{x:0,z:0},C:chunks,_ck:77,Math,
  ck:key,
  getC:(cx,cz)=>{
   const k=key(cx,cz);
   if(!chunks.has(k)){const c={cx,cz,v:false};chunks.set(k,c);generated.push(k);}
   return chunks.get(k);
  },
  mesh:c=>{drawn.push(key(c.cx,c.cz));c.v=true;},
  drop:c=>disposed.push(key(c.cx,c.cz)),
  performance:{now:()=>slow?(tick++)*5:0}
 };
 vm.createContext(ctx);
 vm.runInContext(streaming,ctx);
 return {ctx,chunks,generated,drawn,disposed,key};
}

test('forced streaming queues nearest chunks first and keeps the loaded set stable',()=>{
 const s=setup();
 s.ctx.stream(true);
 assert.deepEqual(s.drawn.slice(0,5),['0,0','0,-1','-1,0','1,0','0,1']);
 assert.equal(s.drawn.length,21);
 assert.equal(s.generated.length,21);
 s.ctx.stream(true);
 assert.equal(s.drawn.length,21);
 assert.equal(s.generated.length,21);
});

test('frame budget defers pending chunks without losing order; force drains the queue',()=>{
 const s=setup({slow:true});
 s.ctx.stream(false);
 assert.deepEqual(s.drawn,['0,0']);
 s.ctx.stream(false);
 assert.deepEqual(s.drawn,['0,0','0,-1']);
 s.ctx.stream(true);
 assert.equal(s.drawn.length,21);
 assert.deepEqual(s.drawn.slice(0,5),['0,0','0,-1','-1,0','1,0','0,1']);
});

test('distance-based cleanup disposes remote chunks and hides intermediate ones',()=>{
 const s=setup(),put=(x,z,v=true)=>s.chunks.set(s.key(x,z),{cx:x,cz:z,v});
 put(6,0);put(4,0);put(3,0);put(2,0);
 s.ctx.stream(true);
 assert.deepEqual(s.disposed,['6,0','4,0']);
 assert.equal(s.chunks.has('6,0'),false);
 assert.equal(s.chunks.get('4,0').v,false);
 assert.equal(s.chunks.get('3,0').v,true);
 assert.equal(s.chunks.get('2,0').v,true);
 assert.equal(vm.runInContext('_ck',s.ctx),-1);
});

test('render distance and player chunk changes rebuild the queue, not subchunk movement',()=>{
 const s=setup({rd:1});
 s.ctx.stream(true);
 const initial=s.drawn.length;
 s.ctx.P.x=15.9;s.ctx.P.z=15.9;s.ctx.stream(true);
 assert.equal(s.drawn.length,initial);
 s.ctx.P.x=16;s.ctx.stream(true);
 assert.ok(s.drawn.includes('1,0'));
 const afterMove=s.drawn.length;
 s.ctx.RD=3;s.ctx.stream(true);
 assert.ok(s.drawn.length>afterMove);
});
