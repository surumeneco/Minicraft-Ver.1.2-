import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/06-circuits.js','utf8');
const helperAt=src.indexOf('function collectBlastBlockChanges(');
const blastAt=src.indexOf('function blast(');
const endAt=src.indexOf('function primedTick(',blastAt);
assert.ok(blastAt>=0&&endAt>blastAt,'blast implementation found');
const code=src.slice(helperAt>=0?helperAt:blastAt,endAt);

function fixture({blocks=[],existingPrimed=[],player={x:20,y:4,z:20},mobs=[],terrainNoise=()=>0}={}){
 const key=(x,y,z)=>x+','+y+','+z;
 const world=new Map(blocks.map(([x,y,z,v])=>[key(x,y,z),v]));
 const events=[],drops=[],hurtCalls=[],added=[],removed=[];
 const chests={'0,4,1':[[7,3],null,[8,1]]};
 const primed=existingPrimed.map(x=>({...x}));
 const ctx={
  H:18,Math:Object.assign(Object.create(Math),{random:()=>.5}),
  getB:(x,y,z)=>world.get(key(x,y,z))||0,
  hh:terrainNoise,TNTB:30,CONTB:new Map([[40,3]]),
  chests,rk:key,
  spawnDrop:(id,n,x,y,z)=>{drops.push([id,n,x,y,z]);events.push('drop');},
  applyChanges:changes=>events.push(['apply',JSON.parse(JSON.stringify(changes))]),
  spawnPrimed:(x,y,z,fuse)=>{events.push(['prime',x,y,z,fuse]);primed.push({x,y,z,t:fuse});},
  P:player,mobs,primed,
  hurt:n=>{hurtCalls.push(n);events.push(['hurt',n]);},
  rmMob:m=>{removed.push(m);events.push('kill');},
  THREE:{
   MeshBasicMaterial:class {constructor(options){this.options=options;}},
   Mesh:class {constructor(g,m){this.g=g;this.material=m;this.position={set:(...xyz)=>{this.xyz=xyz;}};}}
  },
  FXG:{},scene:{add:mesh=>{added.push(mesh);events.push('effect');}},fxs:[]
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,events,drops,hurtCalls,primed,chests,mobs,added,removed,run:()=>ctx.blast(0,4,0)};
}
const near=(v,w)=>assert.ok(Math.abs(v-w)<1e-12,v+' != '+w);

test('blast destroys eligible blocks, skips protected blocks and drops chest items before changes',()=>{
 const f=fixture({blocks:[
  [0,4,0,30],[0,4,1,40],[1,4,0,2],[2,4,0,10],[0,4,2,18],[5,4,0,2]
 ]});
 f.run();
 assert.deepEqual(f.drops,[[7,3,.5,4.5,1.5],[8,1,.5,4.5,1.5]]);
 assert.equal(f.chests['0,4,1'],undefined);
 const changes=f.events.find(e=>Array.isArray(e)&&e[0]==='apply')[1];
 assert.deepEqual(changes,[[0,4,0,0],[0,4,1,0],[1,4,0,0]]);
 assert.deepEqual(f.events.slice(0,3).map(e=>typeof e==='string'?e:e[0]),['drop','drop','apply']);
 assert.equal(f.added.length,1);
 assert.equal(f.ctx.fxs.length,1);
});

test('explosion chains nearby TNT and shortens existing fuse before damaging entities',()=>{
 const f=fixture({blocks:[[0,4,0,30]],existingPrimed:[{x:1,y:4,z:0,t:5}]});
 f.run();
 near(f.primed[0].t,.65);
 near(f.primed[1].t,.65);
 assert.deepEqual(f.events.filter(x=>Array.isArray(x)&&x[0]==='prime'),
  [['prime',.5,4,.5,.7]]);
 assert.deepEqual(f.events.filter(x=>typeof x==='string'),['effect']);
});

test('blast damage applies player hurt, mob knockback and death after block updates',()=>{
 const closeMob={x:1,y:3.1,z:0,hp:20,kx:0,kz:0,vy:0};
 const farMob={x:20,y:4,z:20,hp:10,kx:0,kz:0,vy:0};
 const f=fixture({blocks:[[0,4,0,2]],player:{x:0,y:3.1,z:0},mobs:[closeMob,farMob]});
 f.run();
 assert.deepEqual(f.hurtCalls,[21]);
 assert.equal(closeMob.hp,2);
 near(closeMob.kx,8/1.1);near(closeMob.kz,0);
 assert.equal(closeMob.vy,5);
 assert.equal(farMob.hp,10);
 assert.deepEqual(f.events.map(e=>typeof e==='string'?e:e[0]),['apply','hurt','effect']);
});

test('terrain resistance gate and world vertical limits retain their existing conditions',()=>{
 const f=fixture({blocks:[[0,0,0,2],[0,4,0,2],[3,4,0,2]],terrainNoise:()=>.9});
 f.run();
 const changes=f.events.find(e=>Array.isArray(e)&&e[0]==='apply')[1];
 assert.deepEqual(changes,[[0,4,0,0]]);
});
