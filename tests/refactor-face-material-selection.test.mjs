import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const world=readFileSync('src/js/03-world.js','utf8');
const begin=world.indexOf('const di=d=>');
const end=world.indexOf('function shapeFaceTouchesBoundary(',begin);
assert.ok(begin>=0&&end>begin,'face-material selection section exists');
const source=world.slice(begin,end);
const N=[0,0,-1],E=[1,0,0],S=[0,0,1],W=[-1,0,0],U=[0,1,0],D=[0,-1,0],BT=[100,101,102,103];

function setup(){
 const ctx={
  blockBaseId:value=>value&255,blockState:value=>value>>8,
  FL:new Uint8Array(256),TR:new Set(),THIN:new Uint8Array(256),RSF:new Uint8Array(256),FULLO:new Set(),AXB:new Uint8Array(256),
  CHEST:10,OBSERVER:11,DISPENSER:12,DROPPER:13,PISTON:14,STICKY_PISTON:15,
  PHEAD:16,RED_LAMP:17,REPEATER:18,COMPARATOR:19
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 const face=(id,d,alt=false)=>ctx.pickTile(id,d,BT,alt);
 return {ctx,face};
}

test('occlusion excludes liquids, transparent and thin blocks, honoring full-shape state bits',()=>{
 const {ctx}=setup();
 ctx.FL[4]=1;ctx.TR.add(5);ctx.THIN[6]=1;ctx.RSF[7]=1;ctx.RSF[8]=1;
 ctx.FULLO.add(8);ctx.FULLO.add(9);
 assert.equal(ctx.occl(0),0);
 assert.equal(Boolean(ctx.occl(3)),true);
 for(const id of [4,5,6,7,3|256])assert.equal(Boolean(ctx.occl(id)),false);
 for(const id of [8,9|256])assert.equal(Boolean(ctx.occl(id)),true);
 assert.equal(Boolean(ctx.occl(4|256)),false);
});

test('ordinary block faces and explicit alternate face preserve atlas selection',()=>{
 const {face}=setup();
 assert.deepEqual([N,E,S,W,U,D].map(d=>face(3,d)),[101,101,101,101,100,102]);
 assert.equal(face(3,N,true),103);
});

test('axis block orientation and chest front face preserve state and direction',()=>{
 const {ctx,face}=setup();ctx.AXB[20]=1;
 assert.equal(face(20|(1<<8),E),100);
 assert.equal(face(20|(1<<8),N),101);
 assert.equal(face(20|(2<<8),N),100);
 assert.equal(face(20|(2<<8),E),101);
 assert.equal(face(ctx.CHEST|(29<<8),N),103);
 assert.equal(face(ctx.CHEST|(29<<8),E),101);
 assert.equal(face(ctx.CHEST|(30<<8),E),103);
});

test('observer, dispenser and dropper distinguish front, back, top and side',()=>{
 const {ctx,face}=setup();
 const obs=ctx.OBSERVER|(1<<8);
 assert.deepEqual([E,W,U,N,D].map(d=>face(obs,d)),[101,103,100,102,100]);
 assert.equal(face(ctx.DISPENSER,N),101);
 assert.equal(face(ctx.DISPENSER,E),100);
 assert.equal(face(ctx.DROPPER|(2<<8),S),101);
 assert.equal(face(ctx.DROPPER|(2<<8),W),100);
});

test('piston and piston head select extended tips and opposite textures',()=>{
 const {ctx,face}=setup();
 const piston=ctx.PISTON|(1<<8);
 assert.equal(face(piston,E),100);
 assert.equal(face(piston,W),102);
 assert.equal(face(ctx.PISTON|((1|8)<<8),E),102);
 assert.equal(face(ctx.STICKY_PISTON|(4<<8),N),101);
 assert.equal(face(ctx.PHEAD|(1<<8),E),100);
 assert.equal(face(ctx.PHEAD|((1|8)<<8),E),103);
 assert.equal(face(ctx.PHEAD|(1<<8),W),101);
});

test('emissive lamp, powered repeater and comparator keep state-specific texture',()=>{
 const {ctx,face}=setup();
 assert.equal(face(ctx.RED_LAMP|(1<<8),N),103);
 assert.equal(face(ctx.RED_LAMP,U),100);
 assert.equal(face(ctx.REPEATER|(16<<8),U),103);
 assert.equal(face(ctx.REPEATER|(16<<8),N),101);
 assert.equal(face(ctx.COMPARATOR|(4<<8),U),103);
 assert.equal(face(ctx.COMPARATOR,N),101);
});
