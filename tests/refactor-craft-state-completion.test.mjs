import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source=readFileSync('src/js/09-inventory.js','utf8');
const start=source.indexOf('function renderInventoryEquipmentPanel(');
const end=source.indexOf('// インベントリのアイテムクリック',start);
assert.ok(start>=0&&end>start,'inventory crafting and state section');
const code=source.slice(start,end);

function fixture({slots=[null,null,null,null],counts={11:2,12:1}}={}){
 const calls=[];
 const element=tag=>({
  tag,children:[],className:'',title:'',innerHTML:'',textContent:'',
  appendChild(child){this.children.push(child);return child}
 });
 const ctx={
  document:{createElement:element},invBody:element('root'),
  ITEMS:{11:{name:'A',type:'material'},12:{name:'B',type:'material'},99:{name:'完成品',type:'material'}},
  NM:{11:'A',12:'B',99:'完成品'},
  invCount:{...counts},craftSlots:[...slots],
  recipes:[[99,'完成品',[11,1,12,1]]],
  equipped:{weapon:null,shield:null,helmet:null,chest:null,legs:null,boots:null},
  hot:[11,12,null,null,null,null,null,null,null],sel:0,
  isItem:id=>id===11||id===12||id===99,
  invIcon:id=>'<'+id+'>',itemIcon:id=>'<'+id+'>',icon:id=>'<'+id+'>',
  selectInvItem:id=>calls.push(['select',id]),
  setSel:i=>calls.push(['selectHot',i]),
  give:(id,n)=>{calls.push(['give',id,n]);ctx.invCount[id]=(ctx.invCount[id]||0)+(n??1)},
  take:(id,n)=>{calls.push(['take',id,n]);ctx.invCount[id]-=n;return true},
  renderInventory:()=>calls.push(['render']),
  toast:msg=>calls.push(['toast',msg])
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,calls,read:expr=>vm.runInContext(expr,ctx)};
}

test('crafting output consumes the two source slots, grants one result and notifies in original order',()=>{
 const f=fixture({slots:[11,12,null,null],counts:{11:0,12:0}});
 f.ctx.renderPlayerInventory();
 const result=f.ctx.invBody.children[7].children[0];
 assert.equal(result.innerHTML,'<99>');
 result.onclick();
 assert.deepEqual(Array.from(f.read('craftSlots')),[null,null,null,null]);
 assert.equal(f.ctx.invCount[99],1);
 assert.deepEqual(f.calls,[['give',99,undefined],['toast','完成品'],['render']]);
});

test('putInCraft debits inventory on insertion; output completion does not debit it a second time',()=>{
 const f=fixture({counts:{11:1,12:1}});
 f.ctx.putInCraft(12);
 f.ctx.putInCraft(11);
 assert.deepEqual(Array.from(f.read('craftSlots')),[12,11,null,null]);
 assert.equal(f.ctx.invCount[11],0);assert.equal(f.ctx.invCount[12],0);
 const recipe=f.ctx.find2x2Recipe();
 assert.equal(recipe[0],99);
 assert.deepEqual(Array.from(recipe[1],pair=>Array.from(pair)),[[11,1],[12,1]]);
 f.ctx.renderPlayerInventory();
 f.ctx.invBody.children[7].children[0].onclick();
 assert.deepEqual(f.calls,[
  ['take',12,1],['render'],['take',11,1],['render'],
  ['give',99,undefined],['toast','完成品'],['render']
 ]);
 assert.equal(f.ctx.invCount[99],1);
});

test('unmatched ingredients do not produce a recipe or mutate inventory',()=>{
 const f=fixture({slots:[11,11,null,null]});
 assert.equal(f.ctx.find2x2Recipe(),null);
 f.ctx.renderPlayerInventory();
 assert.equal(f.ctx.invBody.children[7].children[0].innerHTML,'');
 f.ctx.invBody.children[7].children[0].onclick();
 assert.deepEqual(f.calls,[]);
});

test('no owned item and full craft slots keep their existing refusal paths',()=>{
 const f=fixture({slots:[11,12,11,12],counts:{11:1,12:0}});
 f.ctx.putInCraft(12);
 assert.deepEqual(f.calls,[]);
 f.ctx.putInCraft(11);
 assert.deepEqual(f.calls,[['toast','クラフト欄がいっぱいです']]);
 assert.deepEqual(Array.from(f.read('craftSlots')),[11,12,11,12]);
 assert.equal(f.ctx.invCount[11],1);
});
