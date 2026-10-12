import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/05-entities.js','utf8');
const attack=src.indexOf('function attack('),spawn=src.indexOf('function selectMobSpawn(',attack);
const helper=src.indexOf('function applyMeleeHit(');
assert.ok(attack>=0&&spawn>attack);
const code=src.slice(helper>=0?helper:attack,spawn);
function setup({weapon=null,weaponDamage=8,dur=3,yaw=Math.PI/2,host=true,hp=20,
 drops=[[101,2,.5],[102,1,1]],random=[.6,.1]}={}){
 const events=[],T={host,drops},m={hp,T,x:4,y:3,z:6,yaw:0,kx:0,kz:0,vy:0,fleeT:0};
 let at=0;
 const ctx={P:{yaw},equipped:{weapon},
  ITEMS:{9:{damage:weaponDamage,dur}},Math:Object.assign(Object.create(Math),{random:()=>random[at++%random.length]}),
  rmMob:mob=>events.push(['remove',mob===m]),
  spawnDrop:(...args)=>events.push(['drop',...args])
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,m,events,attack:()=>ctx.attack(m),drawCount:()=>at};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,a+' != '+b);

test('unarmed attack retains five damage and lower knockback velocity',()=>{
 const f=setup({host:true});
 f.attack();
 assert.equal(f.m.hp,15);
 near(f.m.kx,-7);near(f.m.kz,0);
 assert.equal(f.m.vy,5);
 assert.deepEqual(f.events,[]);
 assert.equal(f.drawCount(),0);
});
test('equipped weapon attacks for configured damage and decrements positive durability only',()=>{
 const f=setup({weapon:9,weaponDamage:9,dur:2});
 f.attack();
 assert.equal(f.m.hp,11);
 near(f.m.kx,-9);near(f.m.kz,0);
 assert.equal(f.ctx.ITEMS[9].dur,1);
 const spent=setup({weapon:9,weaponDamage:8,dur:0});
 spent.attack();assert.equal(spent.ctx.ITEMS[9].dur,0);
});
test('a passive mob flees immediately even when lethal',()=>{
 const f=setup({host:false,hp:1,yaw:0,drops:[]});
 f.attack();
 assert.equal(f.m.fleeT,3);near(f.m.yaw,Math.PI);
 assert.deepEqual(f.events,[['remove',true]]);
});
test('lethal attack removes mob before rolling item drops, preserving probabilities and order',()=>{
 const f=setup({weapon:9,hp:6,drops:[[101,2,.5],[102,1,1],[103,1,0]],random:[.6,.1,.9]});
 f.attack();
 assert.equal(f.m.hp,-2);
 assert.deepEqual(f.events,[['remove',true],['drop',102,1,4,3.8,6]]);
 assert.equal(f.drawCount(),3);
});
test('all guaranteed drops spawn in sequence at mob center height plus 0.8',()=>{
 const f=setup({hp:1,drops:[[103,3,1],[104,0,1]],random:[.9,.9]});
 f.attack();
 assert.deepEqual(f.events,[['remove',true],['drop',103,3,4,3.8,6],['drop',104,1,4,3.8,6]]);
});
test('nonlethal hit causes no death drops or random calls',()=>{
 const f=setup({hp:6});f.attack();
 assert.equal(f.m.hp,1);assert.deepEqual(f.events,[]);assert.equal(f.drawCount(),0);
});
