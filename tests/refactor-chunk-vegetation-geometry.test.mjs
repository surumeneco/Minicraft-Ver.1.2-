import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/03-world.js','utf8');
const start=src.indexOf(' const addGrass=(x,y,z,seed)=>');
const end=src.indexOf('\n for(let y=0;y<c.top;',start);
assert.ok(start>=0&&end>start,'per-chunk grass builder exists');
const call=src.slice(start,end);
const helperStart=src.indexOf('function appendChunkGrassGeometry(');
const helper=helperStart>=0?
 src.slice(helperStart,src.indexOf('function mesh(c){',helperStart)):'';

function sample(roll,{base=.25}={}){
 const GS={p:[],c:[],i:[],n:0},c={cx:-2,cz:3},calls=[];
 const ctx={GS,c,Math,hh:(x,z,seed)=>{
  calls.push([x,z,seed]);
  if(seed===101&&x===-31&&z===50)return base;
  if(seed===172&&x===60&&z===13)return roll;
  return .4;
 }};
 vm.createContext(ctx);
 vm.runInContext(helper+'\n'+call+'\naddGrass(1,12,2,101);',ctx);
 return {GS,calls};
}

test('vegetation culling checks world-coordinate hash first and leaves no geometry',()=>{
 const {GS,calls}=sample(.2,{base:.6});
 assert.deepEqual(GS,{p:[],c:[],i:[],n:0});
 assert.deepEqual(calls,[[-31,50,101]]);
});

test('grass stem and leaf quads preserve winding, vertex colors and index counts',()=>{
 const {GS,calls}=sample(.3);
 assert.equal(GS.n,16,'two blades with two faces each');
 assert.equal(GS.p.length,48);
 assert.equal(GS.c.length,48);
 assert.equal(GS.i.length,24);
 assert.deepEqual(GS.i.slice(0,6),[0,1,2,0,2,3]);
 assert.deepEqual(calls.slice(0,2),[[-31,50,101],[60,13,172]]);
 assert.ok(GS.p.every(Number.isFinite));
});

test('flower and rosebush cases retain original distinct quad and color shapes',()=>{
 for(const [roll,faces] of [[.02,5],[.07,5],[.12,5],[.15,12]]){
  const {GS}=sample(roll);
  assert.equal(GS.n,faces*4,'roll '+roll);
  assert.equal(GS.p.length,faces*12);
  assert.equal(GS.c.length,faces*12);
  assert.equal(GS.i.length,faces*6);
  assert.ok(GS.c.every(Number.isFinite));
 }
});
