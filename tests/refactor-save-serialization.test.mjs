import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=readFileSync('src/js/04-0-player-ui.js','utf8');
const code=source.slice(source.indexOf('function save(man){'),source.indexOf('// ワールド読込は'));
assert.ok(code.startsWith('function save(man){'), 'save/load slice must be present');

function harness(){
 const store=new Map(),messages=[],ctx={
  SK:'minicraft_v2',noSave:false,edits:new Map([[1030,new Map([[0,7],[22,0]])],[2047,new Map([[17,8]])]]),
  localStorage:{
   setItem:(key,value)=>store.set(key,value),
   getItem:key=>store.get(key)||null
  },
  P:{x:3,y:20,z:-5,yaw:.25,pitch:-.2},hot:[24,2,3,4,5,6,7,8,9],sel:2,
  invCount:{100:3},equipped:{weapon:101},chests:{'1,2,3':[[100,4],null]},
  hunger:8,hungerTimer:37,hp:15,worldClock:360,TOTAL_CYCLE:1200,
  craftSlots:[100,null,100,null],pendingCraftSlots:null,
  refreshSaveInfo:()=>{},toast:m=>messages.push(m),Math,JSON,Map,Object,Number
 };
 vm.createContext(ctx);
 vm.runInContext(code,ctx);
 return {ctx,store,messages};
}

test('save keeps the edit-pair format and all current game-state fields',()=>{
 const {ctx,store,messages}=harness();
 ctx.save(true);
 const data=JSON.parse(store.get('minicraft_v2'));
 assert.deepEqual(data.e,{'1030':[0,7,22,0],'2047':[17,8]});
 assert.deepEqual(data.p,[3,20,-5,.25,-.2]);
 assert.deepEqual(data.hot,[24,2,3,4,5,6,7,8,9]);
 assert.equal(data.sel,2);
 assert.deepEqual(data.invCount,{100:3});
 assert.deepEqual(data.equipped,{weapon:101});
 assert.deepEqual(data.ch,{'1,2,3':[[100,4],null]});
 assert.deepEqual(data.craftSlots,[100,null,100,null]);
 assert.equal(data.hp,15);
 assert.equal(data.worldClock,360);
 assert.deepEqual(messages,['セーブしました']);
});

test('load restores edits, inventory and player without replacing existing references',()=>{
 const {ctx}=harness();
 ctx.save(false);
 const edits=ctx.edits,hot=ctx.hot,player=ctx.P,inventory=ctx.invCount;
 edits.clear();ctx.P.x=0;ctx.hot[0]=99;ctx.sel=0;ctx.invCount[100]=0;
 ctx.hp=1;ctx.worldClock=0;
 assert.equal(ctx.load(),true);
 assert.equal(ctx.edits,edits);
 assert.equal(ctx.hot,hot);
 assert.equal(ctx.P,player);
 assert.equal(ctx.invCount,inventory);
 assert.deepEqual([...ctx.edits.get(1030)],[ [0,7],[22,0] ]);
 assert.equal(ctx.P.x,3);
 assert.equal(ctx.hot[0],1, 'old unsupported IDs retain original remapping');
 assert.equal(ctx.invCount[100],3);
 assert.equal(ctx.sel,2);
 assert.equal(ctx.hp,15);assert.equal(ctx.worldClock,360);
 assert.deepEqual(Array.from(ctx.pendingCraftSlots),[100,null,100,null]);
});

test('saving disabled and malformed snapshots retain the original failure behavior',()=>{
 const {ctx,store,messages}=harness();
 ctx.noSave=true;
 ctx.save(true);
 assert.equal(store.size,0);
 ctx.noSave=false;
 store.set(ctx.SK,'not json');
 assert.equal(ctx.load(),false);
 assert.deepEqual(messages,[]);
 ctx.localStorage.setItem=()=>{throw new Error('full');};
 ctx.save(false);
 assert.deepEqual(messages,[]);
 ctx.save(true);
 assert.deepEqual(messages,['セーブに失敗しました']);
});
