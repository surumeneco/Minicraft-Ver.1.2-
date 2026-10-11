import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source=readFileSync('src/js/09-inventory.js','utf8');
const extracted=source.indexOf('function renderInventoryEquipmentPanel(');
const start=extracted>=0?extracted:source.indexOf('function renderPlayerInventory(');
const end=source.indexOf('function consumeCraftSlots(',start);
assert.ok(start>=0&&end>start,'inventory panel section');
const code=source.slice(start,end);

function fixture({owned={11:2,12:1},recipe=[99,[[11,1]]]}={}){
 const actions=[];
 const element=tag=>({
  tag,children:[],className:'',title:'',innerHTML:'',textContent:'',
  appendChild(child){this.children.push(child);return child;}
 });
 const invBody=element('root'),craftSlots=[11,null,null,null],hot=[11,12,null,null,null,null,null,null,null];
 const ctx={
  document:{createElement:element},invBody,
  equipped:{weapon:11,shield:null,helmet:null,chest:null,legs:null,boots:null},
  ITEMS:{11:{name:'鉄'},12:{name:'木'},99:{name:'完成品'}},
  NM:{11:'鉄',12:'木'},invCount:owned,hot,sel:0,craftSlots,
  invIcon:id=>'<inv:'+id+'>',
  isItem:id=>id===11,itemIcon:id=>'<item:'+id+'>',icon:id=>'<block:'+id+'>',
  selectInvItem:id=>actions.push(['select',id]),
  setSel:i=>actions.push(['hot',i]),renderInventory:()=>actions.push(['render']),
  find2x2Recipe:()=>recipe,
  give:(id,n)=>actions.push(['give',id,n]),
  consumeCraftSlots:need=>actions.push(['consume',JSON.parse(JSON.stringify(need))]),
  toast:message=>actions.push(['toast',message])
 };
 vm.createContext(ctx);
 vm.runInContext(code,ctx);
 ctx.renderPlayerInventory();
 return {ctx,actions,invBody,hot,craftSlots};
}
const classes=el=>el.children.map(e=>e.className||e.textContent||e.innerHTML);

test('inventory renders four section groups in original order with fixed slot counts',()=>{
 const f=fixture(),nodes=f.invBody.children;
 assert.equal(nodes.length,8);
 assert.equal(nodes[0].className,'equipPanel');
 assert.equal(nodes[1].textContent,'インベントリ（3×9・27スロット）');
 assert.equal(nodes[2].className,'playerInvGrid');
 assert.equal(nodes[2].children.length,27);
 assert.equal(nodes[3].textContent,'ホットバー（プレイ中も使用）');
 assert.equal(nodes[4].className,'inventoryHotbar');
 assert.equal(nodes[4].children.length,9);
 assert.equal(nodes[5].textContent,'2×2 クラフト');
 assert.equal(nodes[6].className,'craft2');
 assert.equal(nodes[6].children.length,4);
 assert.equal(nodes[7].className,'craftOut');
 assert.equal(nodes[7].children.length,2);
 assert.equal(nodes[0].children[0].textContent,'武器：鉄');
 assert.equal(nodes[0].children[1].textContent,'盾（Shiftで構える）：なし');
});

test('inventory slots retain names, HTML and selection click wiring',()=>{
 const f=fixture(),grid=f.invBody.children[2];
 assert.equal(grid.children[0].title,'鉄');
 assert.equal(grid.children[0].innerHTML,'<inv:11>');
 assert.equal(grid.children[1].title,'木');
 assert.equal(grid.children[2].title,'空きスロット');
 grid.children[0].onclick();grid.children[2].onclick();
 assert.deepEqual(f.actions,[['select',11]]);
});

test('hotbar cells retain numbering, selected class and click actions',()=>{
 const f=fixture(),bar=f.invBody.children[4];
 assert.equal(bar.children[0].className,'slot hotSlot selected');
 assert.equal(bar.children[0].innerHTML,'<b>1</b><item:11>');
 assert.equal(bar.children[1].innerHTML,'<b>2</b><block:12>');
 bar.children[1].onclick();
 assert.deepEqual(f.actions,[['hot',1],['render']]);
});

test('craft ingredient click refunds item and clears only the chosen slot',()=>{
 const f=fixture(),slots=f.invBody.children[6].children;
 assert.equal(slots[0].innerHTML,'<inv:11>');
 assert.equal(slots[1].title,'空き');
 slots[0].onclick();slots[1].onclick();
 assert.equal(f.ctx.craftSlots[0],null);
 assert.deepEqual(f.actions,[['give',11,1],['render']]);
});

test('craft output click consumes ingredients, grants result, clears slots and reports success',()=>{
 const f=fixture(),output=f.invBody.children[7];
 assert.equal(output.children[0].innerHTML,'<inv:99>');
 assert.equal(output.children[1].textContent,'→ 完成品');
 output.children[0].onclick();
 assert.deepEqual(f.actions,[
  ['consume',[[11,1]]],['give',99,undefined],['toast','完成品'],['render']
 ]);
 assert.deepEqual(Array.from(f.ctx.craftSlots),[null,null,null,null]);
});

test('missing recipe does not create an output item or respond to output clicks',()=>{
 const f=fixture({recipe:null}),output=f.invBody.children[7];
 assert.equal(output.children[0].innerHTML,'');
 assert.equal(output.children[1].textContent,'→ レシピなし');
 output.children[0].onclick();
 assert.deepEqual(f.actions,[]);
});
