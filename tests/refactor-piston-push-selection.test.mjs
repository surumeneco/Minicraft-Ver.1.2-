import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=readFileSync('src/js/06-circuits.js','utf8');
const helper=source.indexOf('function collectPistonPushLine(');
const piston=source.indexOf('function pistonTick(');
const end=source.indexOf('function startAnim(',piston);
assert.ok(piston>=0&&end>piston);
const code=source.slice(helper>=0?helper:piston,end);

function fixture({state=0,blocks=[],busy=false,y=8,H=24,immutable=99}={}){
 const pos=(x,y,z)=>x+','+y+','+z;
 const placed=new Map(blocks.map(([x,y,z,b])=>[pos(x,y,z),b]));
 const calls=[];
 const ctx={
  D4:[[0,0,1],[1,0,0],[0,0,-1],[-1,0,0]],
  D6:[[0,0,1],[1,0,0],[0,0,-1],[-1,0,0],[0,1,0],[0,-1,0]],
  H,FL:new Uint8Array(256),IMM:v=>v===immutable,
  getB:(x,y,z)=>placed.get(pos(x,y,z))||0,
  startAnim:(c,type,D,line)=>calls.push({type,D:[...D],line:line?.map(x=>[...x])??null}),
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const c={x:2,y,z:2,s:state,busy};
 return {ctx,c,calls,placed,run:(want)=>ctx.pistonTick(c,want)};
}

test('piston scans a chain from near to far and retains block positions',()=>{
 const f=fixture({blocks:[[2,8,3,10],[2,8,4,11],[2,8,5,12]]});
 f.run(true);
 assert.deepEqual(f.calls,[{type:'ext',D:[0,0,1],line:[[2,8,3,10],[2,8,4,11],[2,8,5,12]]}]);
});

test('piston accepts a maximum of 12 movable blocks and rejects 13',()=>{
 const b=n=>Array.from({length:n},(_,i)=>[2,8,3+i,10]);
 const twelve=fixture({blocks:b(12)});twelve.run(true);
 assert.equal(twelve.calls.length,1);
 assert.equal(twelve.calls[0].line.length,12);
 const thirteen=fixture({blocks:b(13)});thirteen.run(true);
 assert.equal(thirteen.calls.length,0);
});

test('immovable objects and world height limits abort extension',()=>{
 const fixed=fixture({blocks:[[2,8,3,99]]});fixed.run(true);
 assert.equal(fixed.calls.length,0);
 const atLimit=fixture({state:4,y:22,H:24});atLimit.run(true);
 assert.equal(atLimit.calls.length,0);
 const floor=fixture({state:5,y:1,blocks:[[2,0,2,10]]});floor.run(true);
 assert.equal(floor.calls.length,0);
});

test('fluids terminate the push scan and may be replaced by the piston head',()=>{
 const f=fixture({blocks:[[2,8,3,10],[2,8,4,25],[2,8,5,11]]});
 f.ctx.FL[25]=1;f.run(true);
 assert.deepEqual(f.calls[0].line,[[2,8,3,10]]);
});

test('retraction bypasses chain search; busy pistons do not animate',()=>{
 const ret=fixture({state:8});ret.run(false);
 assert.deepEqual(ret.calls,[{type:'ret',D:[0,0,1],line:null}]);
 const busy=fixture({busy:true});busy.run(true);
 assert.equal(busy.calls.length,0);
});
