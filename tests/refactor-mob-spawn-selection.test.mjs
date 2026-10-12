import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/05-entities.js','utf8');
const start=src.indexOf('function selectMobSpawn(');
const spawn=src.indexOf('function spawnMob(');
const end=src.indexOf('let spT=',spawn);
assert.ok(spawn>=0&&end>spawn);
const code=src.slice(start>=0?start:spawn,end);
function make({random=[0,.1,.2,.75],worldClock=0,ground=1,blocked=false,mobs=[],x=0,z=0,surface=5}={}){
 const draws=[],created=[],lookups=[];
 let n=0;
 const r=()=>{const v=random[n%random.length];n++;draws.push(v);return v;};
 const ctx={Math:Object.assign(Object.create(Math),{random:r}),P:{x,z},mobs,worldClock,TOTAL_CYCLE:1200,
  NMS:{1:'石',2:'草ブロック',3:'雪ブロック'},
  surfY:()=>surface,getB:(xx,yy,zz)=>{lookups.push([xx,yy,zz]);return yy===surface-1?ground:(blocked&&yy===surface)?7:0;},
  addMob:(type,x,y,z)=>created.push([type,x,y,z])
 };
 vm.createContext(ctx);
 vm.runInContext(code,ctx);
 return {created,draws,lookups,run:()=>ctx.spawnMob()};
}
test('daytime hostile spawn is rejected after terrain queries, without a species draw',()=>{
 const f=make();f.run();
 assert.deepEqual(f.created,[]);
 assert.deepEqual(f.draws,[0,.1,.2]);
 assert.deepEqual(f.lookups,[[24,5,0],[24,6,0],[24,4,0]]);
});
test('hostile spawn chooses species only at night with suitable ground and below hostile cap',()=>{
 const f=make({worldClock:600});f.run();
 assert.deepEqual(f.created,[['skeleton',24.5,5,.5]]);
 assert.deepEqual(f.draws,[0,.1,.2,.75]);
 const tooMany=make({worldClock:600,mobs:[{T:{host:1}},{T:{host:1}},{T:{host:1}}]});
 tooMany.run();assert.deepEqual(tooMany.created,[]);
 const wrongGround=make({worldClock:600,ground:9});wrongGround.run();assert.deepEqual(wrongGround.created,[]);
});
test('passive mobs only spawn on block ID 1 and obey four-species draw',()=>{
 const f=make({random:[0,.1,.8,.5]});f.run();
 assert.deepEqual(f.created,[['sheep',24.5,5,.5]]);
 const bad=make({random:[0,.1,.8,.5],ground:2});bad.run();
 assert.deepEqual(bad.created,[]);
});
test('occupied spawn cells, hard coordinates and mob cap short-circuit before later random draws',()=>{
 const occupied=make({blocked:true});occupied.run();
 assert.deepEqual(occupied.created,[]);
 assert.deepEqual(occupied.draws,[0,.1]);
 const worldEdge=make({x:8000});worldEdge.run();
 assert.deepEqual(worldEdge.draws,[0,.1]);
 const full=make({mobs:Array.from({length:10},()=>({T:{host:0}}))});full.run();
 assert.deepEqual(full.draws,[]);
});
test('hostiles use snow and grass ground names but not when day; passive mobs reject those blocks',()=>{
 const snow=make({worldClock:600,ground:3});snow.run();
 assert.equal(snow.created[0][0],'skeleton');
 const grass=make({worldClock:600,ground:2});grass.run();
 assert.equal(grass.created[0][0],'skeleton');
 const passive=make({random:[0,.1,.8,.5],ground:3});passive.run();
 assert.deepEqual(passive.created,[]);
});
