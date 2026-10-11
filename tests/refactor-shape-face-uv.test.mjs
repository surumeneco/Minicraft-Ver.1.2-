import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const world=readFileSync('src/js/03-world.js','utf8');
const uvStart=world.indexOf('function uvOf(');
const uvEnd=world.indexOf('// 丸太など',uvStart);
const faceStart=world.indexOf('function shapeFaceTouchesBoundary(')>=0
  ?world.indexOf('function shapeFaceTouchesBoundary(')
  :world.indexOf('function shapeFaces(');
const faceEnd=world.indexOf('function createChunkSurfaceMesh(',faceStart);
assert.ok(uvStart>=0&&uvEnd>uvStart&&faceStart>=0&&faceEnd>faceStart);
const code=world.slice(uvStart,uvEnd)+world.slice(faceStart,faceEnd);
const dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const quad=[[0,0,0],[1,0,0],[1,1,1],[0,1,1]];

function fixture({bounds=[0,0,0,1,1,1],faceDirections=dirs,neighbor=()=>0,state=3}={}){
 const requests=[];
 const ctx={
  F:faceDirections.map(d=>[d,quad,1]),
  CO:8,RW:8,THREE:{},AXB:new Uint8Array(256),
  REPEATER:30,COMPARATOR:31,RED_DUST:32,
  boxes:()=>[bounds],
  pickTile:()=>13,
  occl:id=>Boolean(id),
  g:(x,y,z)=>{requests.push([x,y,z]);return neighbor(x,y,z);},
  c:{cx:2,cz:-1},
  S:{p:[],c:[],u:[],i:[],n:0}
 };
 vm.createContext(ctx);
 vm.runInContext(code,ctx);
 const draw=(v=state)=>{
  ctx.S={p:[],c:[],u:[],i:[],n:0};
  ctx.shapeFaces(ctx.S,ctx.c,ctx.g,4,5,6,v,[10,11,12,13],.9);
  return ctx.S;
 };
 return {ctx,requests,draw};
}

test('base UV axes preserve all six face orientations',()=>{
 const {ctx}=fixture();
 const vals=dirs.map(d=>Array.from(ctx.uvOf(d,.25,.3,.75)));
 assert.deepEqual(vals,[
  [.25,.3],[.75,.3],[.25,.25],[.25,.75],[.25,.3],[.75,.3]
 ]);
});

test('full-cube faces skip occluded neighbors and preserve mesh index/attribute shape',()=>{
 const h=fixture({neighbor:(x,y,z)=>x===5&&y===5&&z===6?8:0});
 const S=h.draw();
 assert.equal(S.n,20);
 assert.equal(S.p.length,60);
 assert.equal(S.c.length,60);
 assert.equal(S.u.length,40);
 assert.deepEqual(Array.from(S.i.slice(0,6)),[0,1,2,0,2,3]);
 assert.deepEqual(Array.from(S.p.slice(0,3)),[4,5,6]);
 assert.ok(S.c.every(x=>Math.abs(x-.9)<1e-10));
 assert.deepEqual(h.requests,[[5,5,6],[3,5,6],[4,6,6],[4,4,6],[4,5,7],[4,5,5]]);
});

test('inset geometry does not cull a face just because its outside neighbor is solid',()=>{
 const h=fixture({bounds:[.25,0,0,.75,1,1],faceDirections:[[1,0,0]],neighbor:()=>8});
 const S=h.draw();
 assert.equal(S.n,4);
 assert.equal(h.requests.length,0);
 assert.deepEqual(S.p.slice(0,3),[4.25,5,6]);
 const expectedU=(13%8+.01+(1-0)*.98)/8;
 assert.ok(Math.abs(S.u[0]-expectedU)<1e-10);
});

test('repeater/comparator top-face rotation retains atlas padding and vertex order',()=>{
 const h=fixture({faceDirections:[[0,1,0]]});
 const S=h.draw(30|(2<<8));
 const localUV=[[1,0],[0,0],[0,1],[1,1]];
 for(let i=0;i<4;i++){
  assert.ok(Math.abs(S.u[i*2]-(5+.01+localUV[i][0]*.98)/8)<1e-10);
  assert.ok(Math.abs(S.u[i*2+1]-(8-1-Math.floor(13/8)+.01+localUV[i][1]*.98)/8)<1e-10);
 }
});

test('axis-aligned blocks retain specialized UV orientation on horizontal sides',()=>{
 const h=fixture({faceDirections:[[0,0,-1]]});
 h.ctx.AXB[55]=1;
 const S=h.draw(55|(1<<8));
 // On the north face, an axis-X log maps the vertical position to U and X to V.
 const expected=[[0,0],[0,1],[1,1],[1,0]];
 for(let i=0;i<4;i++){
  assert.ok(Math.abs(S.u[i*2]-(5+.01+expected[i][0]*.98)/8)<1e-10);
  assert.ok(Math.abs(S.u[i*2+1]-(6+.01+expected[i][1]*.98)/8)<1e-10);
 }
});
