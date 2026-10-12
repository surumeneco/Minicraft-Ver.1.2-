import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/05-entities.js','utf8');
const begin=src.indexOf('function calculateArmoredDamage(');
const hurt=src.indexOf('function hurt(');
const end=src.indexOf('function explode(',hurt);
assert.ok(hurt>=0&&end>hurt);
const source=src.slice(begin>=0?begin:hurt,end);
function setup({hp=20,equipped={},armor={},mobs=[]}={}){
 const events=[],living=[...mobs];
 const ctx={
  equipped:{helmet:null,chest:null,legs:null,boots:null,...equipped},
  ITEMS:Object.fromEntries(Object.entries(armor).map(([id,damage])=>[id,{damage}])),
  mobs:living,Math,
  toast:msg=>events.push(['toast',msg]),
  respawn:()=>events.push(['respawn']),
  rmMob:m=>{events.push(['remove',m.id]);living.splice(living.indexOf(m),1)},
  updateHp:()=>events.push(['update'])
 };
 vm.createContext(ctx);
 vm.runInContext('let hp='+hp+';\n'+source,ctx);
 const run=(damage)=>{ctx.hurt(damage);return vm.runInContext('hp',ctx)};
 return {ctx,events,run,living};
}
test('damage without armor is rounded to a minimum of one',()=>{
 const f=setup();
 assert.equal(f.run(.1),19);
 assert.equal(f.run(2.49),17);
 assert.deepEqual(f.events,[['update'],['update']]);
});
test('armor damage mitigation sums four equipment pieces and clamps at 70 percent',()=>{
 const f=setup({equipped:{helmet:1,chest:2,legs:3,boots:4},armor:{1:5,2:10,3:7,4:6}});
 assert.equal(f.run(10),17);
 const capped=setup({equipped:{helmet:1,chest:2},armor:{1:35,2:35}});
 assert.equal(capped.run(10),17);
 const minimum=setup({equipped:{helmet:1},armor:{1:40}});
 assert.equal(minimum.run(1),19);
});
test('fatal player damage triggers toast, respawn, hostile mob removals, then UI refresh',()=>{
 const mobs=[{id:'pig',T:{host:0}},{id:'zombie',T:{host:1}},{id:'cow',T:{host:0}},{id:'skeleton',T:{host:1}}];
 const f=setup({hp:3,mobs});
 assert.equal(f.run(5),-2);
 assert.deepEqual(f.events,[
  ['toast','やられた！ リスポーンします'],
  ['respawn'],['remove','zombie'],['remove','skeleton'],['update']
 ]);
 assert.deepEqual(f.living.map(m=>m.id),['pig','cow']);
});
test('surviving hit updates HP without respawn or mob removal',()=>{
 const f=setup({hp:10,mobs:[{id:'zombie',T:{host:1}}]});
 assert.equal(f.run(9),1);
 assert.deepEqual(f.events,[['update']]);
 assert.equal(f.living.length,1);
});
