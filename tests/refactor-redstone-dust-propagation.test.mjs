import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=readFileSync('src/js/06-circuits.js','utf8');
const helperIndex=source.indexOf('function spreadDustLevels(');
const originalStart=source.indexOf('for(let it=0;it<16;it++)');
const originalEnd=source.indexOf('DL=nd;const ch=[];',originalStart);
assert.ok(helperIndex>=0||(originalStart>=0&&originalEnd>originalStart));

function spread(points,seeds){
 const key=(x,y,z)=>x+','+y+','+z,nd=new Map(),dust=[];
 for(const x of points){nd.set(key(x,1,0),seeds[x]||0);dust.push({x,y:1,z:0});}
 const ctx={nd,dust,rk:key,D4:[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]],Map};
 vm.createContext(ctx);
 if(helperIndex>=0){
  const code=source.slice(helperIndex,source.indexOf('function rsTick(',helperIndex));
  vm.runInContext(code,ctx);
  ctx.spreadDustLevels(dust,nd);
 }else{
  const code=source.slice(originalStart,originalEnd);
  vm.runInContext(code,ctx);
 }
 return Object.fromEntries(nd);
}

test('dust power decays by one cell in connected horizontal wires',()=>{
 const result=spread([0,1,2,3,4],{0:15});
 assert.deepEqual(result,{'0,1,0':15,'1,1,0':14,'2,1,0':13,'3,1,0':12,'4,1,0':11});
});

test('signal gaps are not bridged and weaker sources do not reduce stronger levels',()=>{
 const result=spread([0,1,4,5],{0:10,5:15});
 assert.deepEqual(result,{'0,1,0':10,'1,1,0':9,'4,1,0':14,'5,1,0':15});
});

test('propagation is capped at 16 passes and stops at zero',()=>{
 const result=spread(Array.from({length:20},(_,i)=>i),{0:15});
 assert.equal(result['0,1,0'],15);
 assert.equal(result['14,1,0'],1);
 assert.equal(result['15,1,0'],0);
 assert.equal(result['19,1,0'],0);
});
