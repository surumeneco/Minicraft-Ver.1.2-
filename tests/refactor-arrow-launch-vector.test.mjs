import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/05-entities.js','utf8');
const shoot=src.indexOf('function shoot('),end=src.indexOf('// Integrate projectile position',shoot);
const helper=src.indexOf('function calculateArrowVelocity(');
assert.ok(shoot>=0&&end>shoot);
const code=src.slice(helper>=0?helper:shoot,end);

function setup({random=[.25,.5,.75],player={x:10,y:6,z:3},mob={x:1,y:2,z:3}}={}){
 const events=[],arrows=[];let draws=0;
 class Mesh{constructor(g,m){events.push('mesh');this.g=g;this.m=m}}
 const ctx={P:player,AG:{},AM:{},arrows,THREE:{Mesh},
   scene:{add:g=>events.push('add')},
   Math:Object.assign(Object.create(Math),{random:()=>{events.push('random');return random[draws++%random.length]}})
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,arrows,events,draws:()=>draws,shoot:()=>ctx.shoot(mob)};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,a+' != '+b);

test('projectile geometry is added before three trajectory random draws',()=>{
 const f=setup();f.shoot();
 assert.deepEqual(f.events,['mesh','add','random','random','random']);
 assert.equal(f.draws(),3);
 assert.equal(f.arrows.length,1);
});
test('shoot uses player position, mob muzzle height, 18-unit flight scaling and 5t vertical arc',()=>{
 const f=setup();f.shoot();
 const a=f.arrows[0],t=Math.hypot(9,3.7)/18;
 assert.deepEqual({x:a.x,y:a.y,z:a.z,life:a.life},{x:1,y:3.5,z:3,life:6});
 near(a.vx,9/t-.3);near(a.vy,3.7/t+5*t);near(a.vz,.3);
 assert.ok(a.g instanceof f.ctx.THREE.Mesh);
});
test('all three random draws are retained even when direction has zero component',()=>{
 const f=setup({random:[0,1,.5],player:{x:1,y:2.3,z:13}});
 f.shoot();const a=f.arrows[0];
 near(a.vx,-.6);near(a.vy,.6+5*(10/18));near(a.vz,18);
 assert.equal(f.draws(),3);
});
