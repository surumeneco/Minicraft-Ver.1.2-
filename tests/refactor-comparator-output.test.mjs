import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/06-circuits.js','utf8');
const tick=src.indexOf('function rsTick(');
const begin=src.indexOf('case COMPARATOR:{const f=s&3,',tick);
const end=src.indexOf('case OBSERVER:{',begin);
assert.ok(tick>=0&&(helper>=0||(begin>=0&&end>begin)));
const helper=src.indexOf('function calculateComparatorOutput(');
const code=helper>=0
  ? src.slice(helper,tick)+'\nfunction output(c,x,y,z,s){return calculateComparatorOutput(c,x,y,z,s)}'
  : 'function output(c,x,y,z,s){switch(c.bs){'+src.slice(begin,end)+'}return c.out}';

function calculate({front=0,mode=0,back=8,sideA=3,sideB=1,container=true}={}){
 const calls=[];
 const D4=[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0]];
 const ctx={
  COMPARATOR:48,D4,
  contLevel:(x,y,z)=>{calls.push(['container',x,y,z]);return container?back:-1},
  outAt:(x,y,z,tx,tz)=>{calls.push(['back',x,y,z,tx,tz]);return back},
  sideLvl:(x,y,z,tx,tz)=>{calls.push(['side',x,y,z,tx,tz]);return calls.filter(c=>c[0]==='side').length===1?sideA:sideB},
  Math
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const c={bs:48,out:99};
 const result=ctx.output(c,4,5,6,front|(mode?4:0));
 return {value:result,calls};
}
test('comparison mode outputs back only when side strength does not exceed it',()=>{
 assert.equal(calculate({back:8,sideA:3,sideB:1}).value,8);
 assert.equal(calculate({back:8,sideA:8,sideB:2}).value,8);
 assert.equal(calculate({back:8,sideA:9,sideB:2}).value,0);
});
test('subtraction mode reduces rear power by the maximum side power with floor zero',()=>{
 assert.equal(calculate({mode:1,back:10,sideA:3,sideB:7}).value,3);
 assert.equal(calculate({mode:1,back:4,sideA:8,sideB:1}).value,0);
});
test('rear input falls back to connected circuit when no inventory is present',()=>{
 const r=calculate({front:1,back:15,sideA:3,sideB:1,container:false});
 assert.equal(r.value,15);
 assert.deepEqual(r.calls,[
  ['container',3,5,6],
  ['back',3,5,6,4,6],
  ['side',4,5,7,4,6],
  ['side',4,5,5,4,6]
 ]);
});
test('valid container power takes precedence over an external rear signal',()=>{
 const r=calculate({container:true,back:6,sideA:0,sideB:0});
 assert.equal(r.value,6);
 assert.equal(r.calls.some(c=>c[0]==='back'),false);
});
