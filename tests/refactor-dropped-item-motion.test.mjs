import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source = readFileSync('src/js/04-3-dropped-items.js', 'utf8');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} should equal ${expected}`);

function harness() {
  const added=[],removed=[],received=[],messages=[];
  class Group {
    constructor() {
      this.position={set:(x,y,z)=>{this.coordinates=[x,y,z];}};
      this.rotation={y:0};
      this.children=[];
    }
    add(child) {this.children.push(child);}
  }
  const math=Object.create(Math);math.random=()=>0;
  const ctx={
    THREE:{BoxGeometry:class {},MeshLambertMaterial:class {},Mesh:class {},Group},
    scene:{add:g=>added.push(g),remove:g=>removed.push(g)},
    ITEMS:{100:{type:'material',name:'Stone'},101:{type:'food',name:'Bread'}},
    P:{x:100,y:100,z:100}, Math:math,
    hot:[100],sel:0,invCount:{100:5},take:()=>true,
    toast:m=>messages.push(m),give:(id,n)=>received.push([id,n]),
    surfY:()=>0,updFlow:()=>{},getB:()=>0,solid:()=>false
  };
  vm.createContext(ctx);
  vm.runInContext(source,ctx);
  const drops=()=>vm.runInContext('droppedItems',ctx);
  return {ctx,drops,added,removed,received,messages};
}

test('drop physics keeps vertical acceleration, damping and visual transform', () => {
  const h=harness();
  h.ctx.spawnDrop(100,2,4,5,6,1,-1,2);
  assert.equal(h.added.length,1);
  h.ctx.dropTick(.25);
  const d=h.drops()[0];
  near(d.x,4.25);near(d.z,5.75);near(d.y,5.5);
  near(d.vx,.25);near(d.vz,-.25);near(d.vy,-1);
  near(d.gy,1.05);near(d.gt,.5);near(d.t,.4);
  near(d.g.coordinates[0],d.x);
  near(d.g.coordinates[1],d.y+.12*Math.sin(.8));
  near(d.g.rotation.y,.4);
  assert.equal(h.received.length,0);
});

test('flow movement obeys collision checks and stays below the pickup radius', () => {
  const h=harness();
  h.ctx.updFlow=d=>{d.fx=2;d.fz=-1;};
  h.ctx.getB=(x,_,z)=>x>0?1:0;
  h.ctx.solid=block=>block===1;
  h.ctx.spawnDrop(100,1,.9,1.05,0,0,0,0);
  h.ctx.dropTick(.1);
  const d=h.drops()[0];
  near(d.x,.9);near(d.z,-.1);near(d.y,1.05);
  assert.equal(h.received.length,0);
});

test('drops are picked up with their full stack and removed from the scene', () => {
  const h=harness();
  h.ctx.P={x:0,y:1.05,z:0};
  h.ctx.spawnDrop(100,4,0,1.05,0,0,0,0);
  h.ctx.dropTick(.05);
  assert.equal(h.drops().length,0);
  assert.equal(h.removed.length,1);
  assert.deepEqual(h.received,[[100,4]]);
  assert.deepEqual(h.messages,['Stoneを拾った']);
});

test('expired drops are removed without giving items', () => {
  const h=harness();
  h.ctx.P={x:0,y:1.05,z:0};
  h.ctx.spawnDrop(101,1,0,1.05,0,0,0,0);
  h.ctx.dropTick(241);
  assert.equal(h.drops().length,0);
  assert.equal(h.removed.length,1);
  assert.equal(h.received.length,0);
});

test('zero-count drops do not create geometry or scene entries', () => {
  const h=harness();
  h.ctx.spawnDrop(100,0,0,0,0);
  assert.equal(h.drops().length,0);
  assert.equal(h.added.length,0);
});
