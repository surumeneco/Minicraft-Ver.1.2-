import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/06-circuits.js','utf8');
const start=src.indexOf('function pushEnt(');
const end=src.indexOf('// ---- TNT ----',start);
assert.ok(start>=0&&end>start,'piston animation section exists');
const code=src.slice(start,end);
const normalize=value=>JSON.parse(JSON.stringify(value));

function setup({type='ext',sticky=false,s=0,line=[],P={x:100,y:5,z:100},mobs=[],blocks=[]}={}){
 const key=(x,y,z)=>x+','+y+','+z;
 const world=new Map(blocks.map(([x,y,z,v])=>[key(x,y,z),v]));
 const changes=[],removed=[],events=[];
 const c={x:1,y:5,z:2,s,bs:sticky?32:31,busy:true};
 const g={id:'animated'},pl={position:{z:0}},sh={position:{z:0},scale:{z:0}};
 const anim={c,type,D:[1,0,0],line,t:0,g,pl,sh};
 const anims=[anim];
 const ctx={anims,P,mobs,H:20,PISTON:31,STICKY_PISTON:32,PHEAD:80,
  Math,Map,rk:key,FL:new Uint8Array(256),IMM:v=>v===10,
  getB:(x,y,z)=>world.get(key(x,y,z))||0,
  applyChanges:ch=>{events.push(['apply',P.x]);changes.push(normalize(ch));},
  scene:{remove:obj=>{removed.push(obj);events.push(['remove',obj.id]);}}
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,c,anim,anims,changes,removed,events,run:dt=>ctx.animTick(dt)};
}

test('animation interpolates visual geometry without changing world before 0.1 seconds',()=>{
 const f=setup({line:[[2,5,2,3]]});
 f.run(.05);
 assert.equal(f.anim.pl.position.z,.875);
 assert.equal(f.anim.sh.position.z,.5);
 assert.equal(f.anim.sh.scale.z,.5);
 assert.equal(f.c.busy,true);
 assert.equal(f.anims.length,1);
 assert.deepEqual(f.changes,[]);
});

test('extension preserves overwrite order, piston state and entity push semantics',()=>{
 const player={x:2.5,y:5,z:2.5};
 const mob={x:2.5,y:5,z:2.5};
 const f=setup({line:[[2,5,2,3],[3,5,2,4]],P:player,mobs:[mob]});
 f.run(.1);
 assert.deepEqual(f.changes,[[
  [2,5,2,80],
  [3,5,2,3],
  [4,5,2,4],
  [1,5,2,31|(8<<8)]
 ]]);
 assert.equal(player.x,5.5);
 assert.equal(mob.x,5.5);
 assert.equal(f.c.busy,false);
 assert.equal(f.anims.length,0);
 assert.deepEqual(f.events,[['apply',5.5],['remove','animated']]);
});

test('normal retraction clears the head without moving adjacent world blocks',()=>{
 const f=setup({type:'ret',s:8});
 f.run(.1);
 assert.deepEqual(f.changes,[[[1,5,2,31],[2,5,2,0]]]);
 assert.equal(f.anim.pl.position.z,.375);
 assert.equal(f.anim.sh.scale.z,.001);
 assert.equal(f.c.busy,false);
});

test('sticky retraction moves a permitted block into head position after clearing both',()=>{
 const f=setup({type:'ret',sticky:true,s:8,blocks:[[3,5,2,7]]});
 f.run(.1);
 assert.deepEqual(f.changes,[[[1,5,2,32],[2,5,2,7],[3,5,2,0]]]);
});

test('sticky retraction does not pull fluid or immovable block',()=>{
 for(const id of [10,25]){
  const f=setup({type:'ret',sticky:true,s:8,blocks:[[3,5,2,id]]});
  f.ctx.FL[25]=1;
  f.run(.1);
  assert.deepEqual(f.changes,[[[1,5,2,32],[2,5,2,0]]]);
 }
});
