import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const world=readFileSync('src/js/03-world.js','utf8');
const helperStart=world.indexOf('function meshVertexColor(');
const inlineStart=world.indexOf('const bl=blockLightAt(',world.indexOf('function mesh(c){'));
const inlineEnd=world.indexOf('S.c.push(k*shade,k*shade,k*shade);',inlineStart);
assert.ok(helperStart>=0 || (inlineStart>=0&&inlineEnd>inlineStart),'mesh vertex lighting exists');

function harness(occluded=()=>false,light=()=>0){
 const sampled=[],lookups=[];
 const ctx={
  Math, c:{cx:2,cz:-1},
  occl:value=>Boolean(value),
  g:(x,y,z)=>{lookups.push([x,y,z]);return occluded(x,y,z)?1:0;},
  blockLightAt:(x,y,z)=>{sampled.push([x,y,z]);return light(x,y,z);},
 };
 const source=helperStart>=0?
   world.slice(helperStart,world.indexOf('function mesh(c){',helperStart)) :
   'function meshVertexColor(c,g,x,y,z,q,d,k){'+
   'const vx=x+q[0],vy=y+q[1],vz=z+q[2];const S={c:[]};'+
   world.slice(inlineStart,inlineEnd+'S.c.push(k*shade,k*shade,k*shade);'.length)+
   'return S.c[0];}';
 vm.createContext(ctx);
 vm.runInContext(source,ctx);
 const color=(q=[0,0,0],d=[0,1,0],k=.8)=>ctx.meshVertexColor(ctx.c,ctx.g,4,5,6,q,d,k);
 return {color,sampled,lookups};
}
const approx=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,String(actual)+' != '+String(expected));

test('zero block light and clear corners leave the face base shade unchanged',()=>{
 const {color,sampled,lookups}=harness();
 approx(color(),.8);
 assert.deepEqual(sampled,[[36,5.01,-10]]);
 assert.deepEqual(lookups,[[3,5,6],[4,4,6],[4,5,5]]);
});

test('three neighboring occluders attenuate light, without changing sample ordering',()=>{
 const {color,lookups}=harness(()=>true,()=>0);
 approx(color([1,1,1],[1,0,0],.9),.9*(1-.24));
 assert.deepEqual(lookups,[[5,5,6],[4,6,6],[4,5,7]]);
});

test('block illumination boosts shading but remains capped at 1.8',()=>{
 const mid=harness(()=>false,()=>.5);
 approx(mid.color([0,1,0],[0,1,0],.8),1.2);
 const bright=harness(()=>false,()=>1);
 approx(bright.color([1,0,1],[0,0,-1],.8),1.44);
 const mixed=harness(()=>true,()=>1);
 approx(mixed.color([1,0,1],[0,0,-1],.8),1.8*.76*.8);
});

test('vertex light sampling uses exact chunk offsets and outward-facing epsilon',()=>{
 const {color,sampled}=harness(()=>false,()=>0);
 color([.5,.25,1],[0,0,-1],1);
 assert.deepEqual(sampled,[[36.5,5.25,-9.01]]);
});
