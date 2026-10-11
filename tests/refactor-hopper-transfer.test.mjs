import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/06-circuits.js','utf8');
const head=src.indexOf('function hopperDirection(');
const a=head>=0?head:src.indexOf('function hopperStep(');
const b=src.indexOf('// ---- ピストン ----',a);
assert.ok(a>=0&&b>a,'hopper implementation boundaries');

function create({output=[],above=null,drops=[],state=0,container=true}={}){
 const pos=(x,y,z)=>x+','+y+','+z;
 const arr=[[11,2],null], containers=new Map();
 if(container)containers.set(pos(0,5,0),arr);
 if(output!==null)containers.set(pos(0,4,0),output);
 if(above!==null)containers.set(pos(0,6,0),above);
 const droppedItems=drops.map(d=>({...d,g:{id:d.id}})),removed=[];
 const ctx={
  D4:[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0]],
  D6:[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0],[0,1,0],[0,-1,0]],
  droppedItems,
  scene:{remove:g=>removed.push(g)},
  contAt:(x,y,z)=>containers.get(pos(x,y,z))||null,
  contInsert:(slots,id,n)=>{
   let left=n;
   for(const sl of slots)if(sl&&sl[0]===id&&sl[1]<64&&left){const take=Math.min(64-sl[1],left);sl[1]+=take;left-=take;}
   for(let i=0;i<slots.length&&left;i++)if(!slots[i]){const take=Math.min(64,left);slots[i]=[id,take];left-=take;}
   return left===0;
  },Math
 };
 vm.createContext(ctx);vm.runInContext(src.slice(a,b),ctx);
 const run=()=>ctx.hopperStep({x:0,y:5,z:0,s:state});
 return {ctx,arr,output,above,containers,droppedItems,removed,run};
}
const flat=value=>JSON.parse(JSON.stringify(value));

test('hopper transfers outward before taking one item from the upper container',()=>{
 const out=[null,null],up=[[12,2]];
 const f=create({output:out,above:up});f.run();
 assert.deepEqual(flat(out),[[11,1],null]);
 assert.deepEqual(flat(f.arr),[[11,1],[12,1]]);
 assert.deepEqual(flat(up),[[12,1]]);
});

test('empty source and unavailable output do not prevent intake from above',()=>{
 const up=[[12,1]];
 const f=create({output:null,above:up});f.arr[0]=null;f.run();
 assert.deepEqual(flat(f.arr),[[12,1],null]);
 assert.deepEqual(flat(up),[null]);
});

test('when no upper container exists, nearby dropped items are scanned in reverse order',()=>{
 const out=[];
 const f=create({output:out,drops:[
  {id:13,n:1,x:.5,y:6,z:.5},
  {id:14,n:2,x:.5,y:6,z:.5}
 ]});f.run();
 assert.deepEqual(flat(f.arr),[[11,1],[14,1]]);
 assert.equal(f.droppedItems[1].n,1);
 assert.equal(f.droppedItems.length,2);
 assert.equal(f.removed.length,0);
 f.run();
 assert.equal(f.droppedItems.length,1);
 assert.equal(f.removed.length,1);
});

test('an existing empty upper container blocks dropped-item collection',()=>{
 const f=create({above:[],drops:[{id:15,n:1,x:.5,y:6,z:.5}]});
 f.run();
 assert.deepEqual(flat(f.arr),[[11,1],null]);
 assert.equal(f.droppedItems.length,1);
});

test('missing hopper inventory aborts all transfers',()=>{
 const out=[null],up=[[12,1]];
 const f=create({container:false,output:out,above:up});f.run();
 assert.deepEqual(flat(out),[null]);
 assert.deepEqual(flat(up),[[12,1]]);
});

test('hopper facing east sends item to the east container, not downward',()=>{
 const f=create({state:2,output:null});
 const east=[null];f.containers.set('1,5,0',east);
 f.run();
 assert.deepEqual(flat(east),[[11,1]]);
 assert.deepEqual(flat(f.arr),[[11,1],null]);
});
