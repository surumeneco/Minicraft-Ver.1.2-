import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source=readFileSync('src/js/05-entities.js','utf8');
const start=source.indexOf('function advanceArrowMotion(');
const end=source.indexOf('// ---- 雲',start);
assert.ok(start>=0&&end>start,'real projectile update section must exist');
const code=source.slice(start,end);

function fixture(){
 const operations=[],arrows=[],removed=[];
 const player={x:100,y:5,z:100};
 const ctx={arrows,P:player,mobs:[],Math,shieldUp:false,TARGET:27,shieldFlash:0,
  getB:()=>0,solid:()=>false,scene:{remove:g=>removed.push(g)},
  targetHit:()=>{throw Error('unexpected target hit')},
  hurt:()=>{throw Error('unexpected player hit')},
  rmMob:()=>{throw Error('unexpected mob removal')}
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 function add(id,{x=0,y=5,z=0,vx=2,vy=3,vz=1,life=2}={}){
  const g={position:{set:(...coords)=>operations.push([id,'set',...coords])},
   lookAt:(...coords)=>operations.push([id,'aim',...coords])};
  const a={g,x,y,z,vx,vy,vz,life,own:false};arrows.push(a);return a;
 }
 return {add,ctx,arrows,operations,removed,run:dt=>ctx.arrowTick(dt)};
}

test('two live arrows update presentation in reverse insertion order after physics',()=>{
 const f=fixture();
 const first=f.add('first',{x:1,y:5,z:3,vx:2,vy:0,vz:1});
 const second=f.add('second',{x:10,y:9,z:6,vx:1,vy:2,vz:-2});
 f.run(.1);
 assert.deepEqual(f.operations,[
  ['second','set',10.1,9.1,5.8],
  ['second','aim',11.1,10.1,3.8],
  ['first','set',1.2,4.9,3.1],
  ['first','aim',3.2,3.9000000000000004,4.1]
 ]);
 assert.equal(f.removed.length,0);
 assert.equal(f.arrows.length,2);
 assert.equal(first.life,1.9);assert.equal(second.life,1.9);
});

test('expired projectile is removed before its graphics transform is updated',()=>{
 const f=fixture(),expired=f.add('expired',{life:.05});
 f.run(.1);
 assert.equal(f.arrows.length,0);
 assert.deepEqual(f.removed,[expired.g]);
 assert.deepEqual(f.operations,[]);
});

test('surviving projectile pose follows updated velocity rather than stale data',()=>{
 const f=fixture();
 const a=f.add('one',{vx:0,vy:0,vz:0});
 f.run(.1);
 assert.deepEqual(f.operations,[
  ['one','set',0,4.9,0],
  ['one','aim',0,3.9000000000000004,0]
 ]);
 assert.equal(a.vy,-1);
});
