import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const source=readFileSync('src/js/09-inventory.js','utf8');

const startToggle=source.indexOf('const _toggleInv=toggleInv;');
const endToggle=source.indexOf('// Eで開閉。',startToggle);
assert.ok(startToggle>=0&&endToggle>startToggle);

function inventoryFixture({inv=false,chestKey=null,pointerLocked=true,lockThrows=false}={}){
 const calls=[],queued=[];
 const ctx={
  inv,chestKey,invEl:{style:{display:inv?'flex':'none'}},
  toggleInv(){calls.push('oldToggle')},
  closeChest(){calls.push('closeChest');ctx.chestKey=null},
  document:{
   pointerLockElement:pointerLocked?{}:null,
   exitPointerLock(){calls.push('exitPointerLock')}
  },
  cv:{requestPointerLock(){calls.push('requestPointerLock');if(lockThrows)throw Error('lock')}},
  requestAnimationFrame:fn=>{queued.push(fn);calls.push('requestAnimationFrame')},
  renderInventory:()=>calls.push('renderInventory')
 };
 vm.createContext(ctx);vm.runInContext(source.slice(startToggle,endToggle),ctx);
 return {ctx,calls,queued};
}

test('opening inventory releases pointer lock before queuing deferred render',()=>{
 const f=inventoryFixture();f.ctx.toggleInv();
 assert.equal(f.ctx.inv,true);assert.equal(f.ctx.invEl.style.display,'flex');
 assert.deepEqual(f.calls,['exitPointerLock','requestAnimationFrame']);
 f.queued[0]();assert.deepEqual(f.calls,['exitPointerLock','requestAnimationFrame','renderInventory']);
});

test('chest close takes priority without toggling inventory or manipulating pointer lock',()=>{
 const f=inventoryFixture({chestKey:'10,20,30'});f.ctx.toggleInv();
 assert.equal(f.ctx.inv,false);
 assert.equal(f.ctx.invEl.style.display,'none');
 assert.deepEqual(f.calls,['closeChest']);assert.equal(f.queued.length,0);
});

test('closing inventory requests pointer lock; failures are swallowed as before',()=>{
 const f=inventoryFixture({inv:true,lockThrows:true});assert.doesNotThrow(()=>f.ctx.toggleInv());
 assert.equal(f.ctx.inv,false);assert.equal(f.ctx.invEl.style.display,'none');
 assert.deepEqual(f.calls,['requestPointerLock']);assert.equal(f.queued.length,0);
});

test('queued open render checks live inventory state and is cancelled by later close',()=>{
 const f=inventoryFixture({pointerLocked:false});
 f.ctx.toggleInv();f.ctx.toggleInv();f.queued[0]();
 assert.deepEqual(f.calls,['requestAnimationFrame','requestPointerLock']);
});

const craftStart=source.indexOf('function completeCraftingOutput(');
const craftEnd=source.indexOf('function renderPlayerInventory(',craftStart);
assert.ok(craftStart>=0&&craftEnd>craftStart);
function craftFixture(slots=[11,null,null,null]){
 const calls=[];
 const element=tag=>({tag,children:[],innerHTML:'',title:'',textContent:'',className:'',
  appendChild(child){this.children.push(child);return child}});
 const ctx={
  document:{createElement:element},invBody:element('root'),craftSlots:slots.slice(),
  invIcon:id=>'<'+id+'>',find2x2Recipe:()=>null,
  give:(id,n)=>calls.push(['give',id,n]),renderInventory:()=>calls.push(['render']),
  ITEMS:{},NM:{},toast:()=>{},consumeCraftSlots:()=>{}
 };
 vm.createContext(ctx);vm.runInContext(source.slice(craftStart,craftEnd),ctx);
 ctx.renderInventoryCrafting();
 return {ctx,calls,slots:ctx.invBody.children[1].children};
}
test('clicking a populated craft slot refunds one item, clears the slot, then renders',()=>{
 const f=craftFixture();f.slots[0].onclick();
 assert.deepEqual(f.calls,[['give',11,1],['render']]);
 assert.deepEqual(Array.from(f.ctx.craftSlots),[null,null,null,null]);
});
test('clicking an initially empty craft slot has no effects',()=>{
 const f=craftFixture();f.slots[1].onclick();
 assert.deepEqual(f.calls,[]);
 assert.deepEqual(Array.from(f.ctx.craftSlots),[11,null,null,null]);
});
