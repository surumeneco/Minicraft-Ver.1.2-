import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=readFileSync('src/js/05-entities.js','utf8');
const helper=source.indexOf('function advanceMobPhysics(');
const step=source.indexOf('function stepMob(');
const begin=source.indexOf('const r=T.w/2,h=T.h,iw=',step);
const end=source.indexOf('if(m.y<1)',begin);
assert.ok(step>=0&&(helper>=0||(begin>=0&&end>begin)),'mob motion implementation present');
const code=helper>=0?
 source.slice(helper,step):
 'function advanceMobPhysics(m,dt,mv){const T=m.T;'+source.slice(begin,end)+'}';

function fixture({x=0,y=10,z=0,yaw=Math.PI/2,vy=0,kx=0,kz=0,
 water=false,collide=()=>false,slime=false,flow=null,ground=true}={}){
 const requests=[],sampled=[];
 const m={T:{w:.6,h:1.8},x,y,z,yaw,vy,kx,kz,fx:0,fz:0,ground};
 const ctx={
  Math,
  getB:(px,py,pz)=>{sampled.push([px,py,pz]);return water?24:0;},
  isW:v=>v===24,
  updFlow:(obj,bx,levels,bz,dt)=>{requests.push(['flow',bx,[...levels],bz,dt]);if(flow){obj.fx=flow[0];obj.fz=flow[1];}},
  hit:(px,py,pz,r,h)=>{requests.push(['hit',px,py,pz,r,h]);return collide(px,py,pz,r,h);},
  slimeUnder:()=>slime
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,m,requests,sampled,run:(dt=.1,mv=2)=>ctx.advanceMobPhysics(m,dt,mv)};
}

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,String(a)+' differs from '+String(b));

test('groundless motion applies gravity before position, and damps knockback after movement',()=>{
 const f=fixture({kx:1,kz:2});f.run();
 close(f.m.x,.3);close(f.m.z,.2);close(f.m.y,9.74);
 close(f.m.vy,-2.6);close(f.m.kx,.5);close(f.m.kz,1);
 assert.equal(f.m.ground,false);
 assert.equal(f.requests.filter(x=>x[0]==='hit').length,3);
});

test('water buoyancy and fluid drift contribute to velocity in original order',()=>{
 const f=fixture({water:true,flow:[.5,-.5],vy:0,yaw:0});f.run(.1,2);
 close(f.m.x,.05);close(f.m.z,.15);
 close(f.m.vy,2.5);close(f.m.y,10.25);
});

test('horizontal obstacle triggers autojump only for grounded forward motion',()=>{
 const f=fixture({collide:(x)=>x>.05});f.run(.1,2);
 close(f.m.x,0);close(f.m.vy,8.5);
 close(f.m.y,10.85);
 assert.equal(f.m.ground,false);
});

test('vertical collision sets ground and rebounds on slime while retaining position',()=>{
 const f=fixture({vy:-4,collide:(x,y)=>y<10,slime:true});f.run(.1,0);
 close(f.m.y,10);close(f.m.vy,6.6*Math.SQRT1_2);
 assert.equal(f.m.ground,true);
 const noSlime=fixture({vy:-4,collide:(x,y)=>y<10});noSlime.run(.1,0);
 close(noSlime.m.vy,0);
 assert.equal(noSlime.m.ground,true);
});
