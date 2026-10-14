import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const player=readFileSync('src/js/04-0-player-ui.js','utf8');
const inv=readFileSync('src/js/09-inventory.js','utf8');
const restoreStart=player.indexOf('function restoreSurvivalState(');
const restoreEnd=player.indexOf('// Edit history',restoreStart);
const invStart=inv.indexOf("const invBody=document.getElementById('invBody')");
const invEnd=inv.indexOf('const INV_CATS=',invStart);
assert.ok(restoreStart>=0&&restoreEnd>restoreStart&&invStart>=0&&invEnd>invStart);

function fixture(snapshot, initialPending=null){
 const ctx={
  pendingCraftSlots:initialPending,document:{getElementById:id=>({id})},
  hunger:10,hungerTimer:0,hp:20,worldClock:0,TOTAL_CYCLE:1200
 };
 vm.createContext(ctx);
 vm.runInContext(player.slice(restoreStart,restoreEnd),ctx);
 ctx.restoreSurvivalState(snapshot);
 const pending=ctx.pendingCraftSlots;
 vm.runInContext(inv.slice(invStart,invEnd),ctx);
 return {ctx,pending,slots:()=>Array.from(vm.runInContext('craftSlots',ctx))};
}

test('saved four-slot selection hydrates after survival restore and retains ordering',()=>{
 const saved={craftSlots:[14,23,5,9]};
 const f=fixture(saved);
 assert.deepEqual(f.slots(),[14,23,5,9]);
 assert.deepEqual(Array.from(f.pending),[14,23,5,9]);
 assert.notStrictEqual(f.pending,saved.craftSlots);
});

test('invalid, nonpositive and noninteger slot values become null without reordering',()=>{
 const f=fixture({craftSlots:[7,-2,4.5,'8']});
 assert.deepEqual(f.slots(),[7,null,null,null]);
 assert.deepEqual(Array.from(f.pending),[7,-2,4.5,'8']);
});

test('missing and short arrays are padded; arrays longer than four are truncated',()=>{
 assert.deepEqual(fixture({}).slots(),[null,null,null,null]);
 assert.deepEqual(fixture({craftSlots:[3,4]}).slots(),[3,4,null,null]);
 assert.deepEqual(fixture({craftSlots:[1,2,3,4,5,6]}).slots(),[1,2,3,4]);
});

test('malformed craftSlots preserve the four-empty-slot default independently of previous pending state',()=>{
 for(const bad of [null,42,'1,2',{},false]){
  const f=fixture({craftSlots:bad},[55,56]);
  assert.deepEqual(f.slots(),[null,null,null,null]);
 }
});

test('restoring craft slots does not alter unrelated survival state coercion',()=>{
 const f=fixture({craftSlots:[7],hunger:15,hungerTimer:602,hp:-3,worldClock:-1});
 assert.deepEqual(f.slots(),[7,null,null,null]);
 assert.equal(f.ctx.hunger,10);assert.equal(f.ctx.hungerTimer,2);
 assert.equal(f.ctx.hp,0);assert.equal(f.ctx.worldClock,1199);
});
