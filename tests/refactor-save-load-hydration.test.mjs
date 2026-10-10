import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=readFileSync('src/js/04-0-player-ui.js','utf8');
const section=source.slice(source.indexOf('function save(man){'),source.indexOf('// ワールド読込は'));
assert.ok(section.startsWith('function save(man){'), 'save/load section exists');

function createSession(snapshot){
 const storage=new Map();
 if(snapshot!==undefined)storage.set('minicraft_v2',JSON.stringify(snapshot));
 const ctx={
  SK:'minicraft_v2',
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  edits:new Map(),P:{x:9,y:9,z:9,yaw:8,pitch:8},
  hot:[3,3,3,3,3,3,3,3,3],sel:8,invCount:{100:1},
  equipped:{helmet:null},chests:{old:[[1,1]]},
  hunger:4,hungerTimer:25,hp:3,worldClock:18,
  TOTAL_CYCLE:1200,pendingCraftSlots:'old',craftSlots:[null,null,null,null],
  noSave:false,refreshSaveInfo:()=>{},toast:()=>{},
  JSON,Math,Number,Map,Object
 };
 vm.createContext(ctx);
 vm.runInContext(section,ctx);
 return {ctx,storage};
}

const base={
 e:{'1030':[10,4,22,0]},
 p:[1,2,3,.2,-.3],
 hot:[24,25,3,4,5,6,7,8,9],sel:0,
 invCount:{100:5,101:1},equipped:{helmet:201},
 ch:{'1,2,3':[[100,4],null]},
 hunger:8,hungerTimer:37,hp:15,worldClock:360,
 craftSlots:[100,null,101,null,999]
};

test('loading preserves object references while restoring game state and legacy hotbar IDs',()=>{
 const {ctx}=createSession(base);
 const p=ctx.P, hot=ctx.hot, items=ctx.invCount, equipment=ctx.equipped, chests=ctx.chests, edits=ctx.edits;
 assert.equal(ctx.load(),true);
 assert.strictEqual(ctx.P,p);
 assert.strictEqual(ctx.hot,hot);
 assert.strictEqual(ctx.invCount,items);
 assert.strictEqual(ctx.equipped,equipment);
 assert.strictEqual(ctx.chests,chests);
 assert.strictEqual(ctx.edits,edits);
 assert.deepEqual([ctx.P.x,ctx.P.y,ctx.P.z,ctx.P.yaw,ctx.P.pitch],[1,2,3,.2,-.3]);
 assert.deepEqual(ctx.hot,[1,1,3,4,5,6,7,8,9]);
 assert.equal(ctx.sel,0);
 assert.equal(ctx.invCount[100],5);
 assert.equal(ctx.invCount[101],1);
 assert.equal(ctx.equipped.helmet,201);
 assert.deepEqual([...ctx.edits.get(1030)],[[10,4],[22,0]]);
 assert.deepEqual(Array.from(ctx.pendingCraftSlots),[100,null,101,null]);
 assert.equal(ctx.hunger,8);
 assert.equal(ctx.hungerTimer,37);
 assert.equal(ctx.hp,15);
 assert.equal(ctx.worldClock,360);
});

test('loading clamps numeric state and wraps negative time',()=>{
 const {ctx}=createSession({...base,hunger:-9,hungerTimer:671,hp:70,worldClock:-35});
 assert.equal(ctx.load(),true);
 assert.equal(ctx.hunger,0);
 assert.equal(ctx.hungerTimer,71);
 assert.equal(ctx.hp,20);
 assert.equal(ctx.worldClock,1165);
});

test('missing optional legacy fields retain fallback values and leave unrelated inventory in place',()=>{
 const legacy={e:{},p:[0,10,0,0,0],hot:[99,98],sel:null};
 const {ctx}=createSession(legacy);
 assert.equal(ctx.load(),true);
 assert.deepEqual(ctx.hot,[3,3,3,3,3,3,3,3,3]);
 assert.equal(ctx.invCount[100],1);
 assert.equal(ctx.sel,0);
 assert.equal(ctx.hunger,4);
 assert.equal(ctx.hungerTimer,25);
 assert.equal(ctx.hp,20);
 assert.equal(ctx.worldClock,0);
 assert.equal(ctx.pendingCraftSlots,null);
});

test('empty or corrupt snapshot still reports load failure',()=>{
 assert.equal(createSession().ctx.load(),false);
 const {ctx,storage}=createSession();
 storage.set('minicraft_v2','{invalid');
 assert.equal(ctx.load(),false);
});
