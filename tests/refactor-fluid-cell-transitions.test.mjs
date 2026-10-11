import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=readFileSync('src/js/07-fluids.js','utf8');
const begin=source.indexOf('function fblocked(');
const end=source.indexOf('function fluidStepDue(',begin);
assert.ok(begin>=0&&end>begin,'fluid state transition functions are present');
const transitions=source.slice(begin,end);

function world(){
 const WA=24,LA=25,WF=26,LF=27,SPG=28,WSPG=29;
 const FL=new Uint8Array(256);
 FL[WA]=FL[WF]=1;
 FL[LA]=FL[LF]=2;
 const blocks=new Map(),applied=[];
 const rk=(x,y,z)=>[x,y,z].join(',');
 const ctx={
  WA,LA,WF,LF,SPG,WSPG,FL,
  SPW:k=>k===0?WA:LA,FLW:k=>k===0?WF:LF,
  D4:[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0]],
  D6:[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0],[0,1,0],[0,-1,0]],
  getB:(x,y,z)=>blocks.get(rk(x,y,z))??0,
  solid:value=>Boolean(value)&&!FL[value&255],
  applyChanges:changes=>applied.push(JSON.parse(JSON.stringify(changes))),
  Math
 };
 vm.createContext(ctx);
 vm.runInContext(transitions,ctx);
 const put=(x,y,z,id)=>blocks.set(rk(x,y,z),id);
 const step=(k,x=0,y=0,z=0)=>{const changes=[];ctx.fluidCell(k,x,y,z,changes);return JSON.parse(JSON.stringify(changes));};
 return {ctx,put,step,applied,WA,LA,WF,LF,SPG,WSPG};
}

test('sources do not disappear when feeding the empty cell beneath them',()=>{
 for(const k of [0,1]){
  const w=world(),source=k===0?w.WA:w.LA,flow=k===0?w.WF:w.LF;
  w.put(0,0,0,source);
  assert.deepEqual(w.step(k),[[0,-1,0,flow|(8<<8)]]);
  w.put(0,-1,0,3);
  assert.deepEqual(w.step(k),[]);
 }
});

test('flowing fluid falls before spreading, preserving the falling-flow state',()=>{
 const w=world();
 w.put(0,0,0,w.WF|(3<<8));
 assert.deepEqual(w.step(0),[[0,0,0,w.WF|(8<<8)],[0,-1,0,w.WF|(8<<8)]]);
 w.put(0,0,0,w.WF|(8<<8));
 assert.deepEqual(w.step(0),[[0,-1,0,w.WF|(8<<8)]]);
});

test('air cells prioritize fluid directly above over sideways sources',()=>{
 const w=world();
 w.put(0,1,0,w.WA);
 w.put(1,0,0,w.WA);
 w.put(1,-1,0,3);
 assert.deepEqual(w.step(0),[[0,0,0,w.WF|(8<<8)]]);
 w.put(0,1,0,0);
 assert.deepEqual(w.step(0),[[0,0,0,w.WF|(1<<8)]]);
});

test('grounded horizontal flow decays or disappears with the surrounding sources',()=>{
 const w=world();
 w.put(0,0,0,w.WF|(5<<8));
 w.put(0,-1,0,3);
 w.put(1,0,0,w.WA);
 w.put(1,-1,0,3);
 assert.deepEqual(w.step(0),[[0,0,0,w.WF|(1<<8)]]);
 w.put(0,0,0,w.WF|(1<<8));
 assert.deepEqual(w.step(0),[]);
 w.put(1,0,0,0);
 assert.deepEqual(w.step(0),[[0,0,0,0]]);
});

test('lava-water reaction respects lower-water priority and source versus flow material',()=>{
 const w=world();
 w.put(0,0,0,w.LA);w.put(0,-1,0,w.WA);w.put(1,0,0,w.WA);
 assert.deepEqual(w.step(1),[[0,-1,0,3]]);
 w.put(0,-1,0,3);
 assert.deepEqual(w.step(1),[[0,0,0,18]]);
 w.put(0,0,0,w.LF|(2<<8));
 assert.deepEqual(w.step(1),[[0,0,0,8]]);
});

test('sponge activation applies nearby water changes separately from the current fluid batch',()=>{
 const w=world();
 w.put(0,0,0,w.WA);
 w.put(1,0,0,w.SPG);
 w.put(2,0,0,w.WF|(2<<8));
 assert.deepEqual(w.step(0),[]);
 assert.equal(w.applied.length,1);
 assert.deepEqual(w.applied[0],[[0,0,0,0],[2,0,0,0],[1,0,0,w.WSPG]]);
});

test('a cell containing the opposite fluid remains unchanged',()=>{
 const w=world();
 w.put(0,0,0,w.LA);
 assert.deepEqual(w.step(0),[]);
 w.put(0,0,0,w.WA);
 assert.deepEqual(w.step(1),[]);
});
