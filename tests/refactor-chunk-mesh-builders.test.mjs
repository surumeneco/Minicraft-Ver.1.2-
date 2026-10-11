import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=readFileSync('src/js/03-world.js','utf8');
const builderStart=source.indexOf(' const mk=(S,mt)=>');
const builderEnd=source.indexOf(' drop(c);c.m=',builderStart);
assert.ok(builderStart>=0&&builderEnd>builderStart,'chunk mesh builders exist');

function harness(){
 const added=[],geometries=[];
 class Attribute {
  constructor(data,size){this.data=data;this.size=size;}
 }
 class Geometry {
  constructor(){this.attributes={};this.operations=[];geometries.push(this);}
  setAttribute(key,value){this.attributes[key]=value;this.operations.push(key);}
  setIndex(indices){this.index=indices;this.operations.push('index');}
 }
 class Mesh {
  constructor(geometry,material){
   this.geometry=geometry;this.material=material;
   this.position={set:(x,y,z)=>{this.location=[x,y,z];}};
  }
 }
 const ctx={
  c:{cx:-2,cz:3},THREE:{Float32BufferAttribute:Attribute,BufferGeometry:Geometry,Mesh},
  scene:{add:mesh=>added.push(mesh)},
  grassMat:{kind:'grass'},solidMat:{kind:'solid'},waterMat:{kind:'water'},
  surface:{n:4,p:[0,1,2,3,4,5],c:[.5,.5,.5],u:[0,1,1,0],i:[0,1,2]},
  grasses:{n:4,p:[2,3,4],c:[.1,.2,.3],i:[0,1,2]},
  empty:{n:0,p:[],c:[],u:[],i:[]}
 };
 const helperStart=source.indexOf('function createChunkSurfaceMesh(');
 const helperCode=helperStart>=0?
  source.slice(helperStart,source.indexOf('function mesh(c){',helperStart)):'';
 const code=helperCode+'\n'+source.slice(builderStart,builderEnd)+
  '\n({solid:mk(surface,solidMat),water:mk(surface,waterMat),grass:mkGrass(grasses),empty:mk(empty,solidMat),emptyGrass:mkGrass(empty)})';
 const result=vm.runInNewContext(code,ctx);
 return {ctx,added,geometries,result};
}

test('solid and transparent meshes keep attribute order, index and supplied materials',()=>{
 const {ctx,result}=harness();
 for(const m of [result.solid,result.water]){
  assert.deepEqual(m.geometry.operations,['position','color','uv','index']);
  assert.equal(m.geometry.attributes.position.size,3);
  assert.equal(m.geometry.attributes.color.size,3);
  assert.equal(m.geometry.attributes.uv.size,2);
  assert.strictEqual(m.geometry.attributes.position.data,ctx.surface.p);
  assert.strictEqual(m.geometry.attributes.uv.data,ctx.surface.u);
  assert.strictEqual(m.geometry.index,ctx.surface.i);
  assert.deepEqual(m.location,[-32,0,48]);
 }
 assert.strictEqual(result.solid.material,ctx.solidMat);
 assert.strictEqual(result.water.material,ctx.waterMat);
});

test('grass mesh retains no UV attribute, correct material and aligned coordinates',()=>{
 const {ctx,result}=harness();
 const m=result.grass;
 assert.deepEqual(m.geometry.operations,['position','color','index']);
 assert.equal(m.geometry.attributes.uv,undefined);
 assert.strictEqual(m.geometry.attributes.position.data,ctx.grasses.p);
 assert.strictEqual(m.geometry.index,ctx.grasses.i);
 assert.strictEqual(m.material,ctx.grassMat);
 assert.deepEqual(m.location,[-32,0,48]);
});

test('empty surfaces create no geometry or scene object; nonempty objects are registered in order',()=>{
 const {result,added,geometries}=harness();
 assert.strictEqual(result.empty,null);
 assert.strictEqual(result.emptyGrass,null);
 assert.equal(geometries.length,3);
 assert.deepEqual(added,[result.solid,result.water,result.grass]);
});
