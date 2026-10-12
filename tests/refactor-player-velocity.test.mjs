import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/08-game-loop.js','utf8');
const loop=src.indexOf('function loop(now){');
const moveHelper=src.indexOf('function playerMoveSpeed(');
const velHelper=src.indexOf('function advancePlayerVelocity(');
const speedStart=src.indexOf('sp=flying?12:',loop);
const speedEnd=src.indexOf(';\n const bodyHit=',speedStart);
const velocityStart=src.indexOf('if(swimDash){const cp=Math.cos(P.pitch)',loop);
const velocityEnd=src.indexOf('advancePlayerCollision(',velocityStart);
assert.ok(loop>=0&&(moveHelper>=0||(speedStart>=0&&speedEnd>speedStart)));
assert.ok(velHelper>=0||(velocityStart>=0&&velocityEnd>velocityStart));
const legacySpeed=moveHelper<0?
 'function playerMoveSpeed(flying,dashing,crouching,iw,onHoney){return '+src.slice(speedStart+3,speedEnd)+';}':'';
const legacyVelocity=velHelper<0?
 'function advancePlayerVelocity(dt,f,s,sp,iw,swimDash,sn,cs){'+src.slice(velocityStart,velocityEnd)+'}':'';
const source=(moveHelper>=0?src.slice(moveHelper,loop):legacySpeed+'\n'+legacyVelocity);
function create({flying=false,inv=false,keys={},P={},flow=[0,0],under=0}={}){
 const calls=[];
 const ctx={flying,inv,keys,HONEY:49,Math,
  P:{x:2,y:10,z:3,yaw:0,pitch:0,ground:false,fx:0,fz:0,vx:0,vy:0,vz:0,...P},
  updFlow:(p,x,levels,z,dt)=>{calls.push(['flow',x,[...levels],z,dt]);p.fx=flow[0];p.fz=flow[1];},
  getB:(x,y,z)=>{calls.push(['under',x,y,z]);return under}
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,calls,speed:(fl,d,c,w,h)=>ctx.playerMoveSpeed(fl,d,c,w,h),
  velocity:(dt,f,s,sp,iw,swimDash,sn=0,cs=1)=>ctx.advancePlayerVelocity(dt,f,s,sp,iw,swimDash,sn,cs)};
}
const near=(v,e)=>assert.ok(Math.abs(v-e)<1e-11,String(v)+' != '+String(e));

test('speed calculation retains flying, sprint, crouch, water, honey priorities',()=>{
 const f=create();
 near(f.speed(false,false,false,false,false),4.5);
 near(f.speed(true,true,true,true,true),12);
 near(f.speed(false,true,false,true,true),9*.55*.4);
 near(f.speed(false,true,false,false,true),9*.4);
 near(f.speed(false,false,true,true,false),2.2*.55);
});

test('horizontal movement combines facing vector and fluid flow after velocity assignment',()=>{
 const f=create({flow:[.6,-.4]});
 f.velocity(.1,1,1,4.5,false,false,0,1);
 near(f.ctx.P.vx,5.1);near(f.ctx.P.vz,-4.9);
 near(f.ctx.P.vy,-2.6);
 assert.deepEqual(f.calls,[['flow',2,[10.4,10.05,11],3,.1]]);
});

test('swimming sprint uses yaw/pitch trajectory and bypasses flow and gravity',()=>{
 const f=create({P:{yaw:Math.PI/2,pitch:Math.PI/6,vy:-12}});
 f.velocity(.1,1,0,9*.55,true,true,1,0);
 near(f.ctx.P.vx,-9*Math.cos(Math.PI/6));
 near(f.ctx.P.vy,-4.5);
 near(f.ctx.P.vz,0);
 assert.deepEqual(f.calls,[]);
});

test('flight resets drift, applies vertical key input and respects velocity floor',()=>{
 const f=create({flying:true,keys:{Space:true},P:{fx:2,fz:3,vy:-90}});
 f.velocity(.1,0,1,12,false,false,0,1);
 near(f.ctx.P.vx,12);near(f.ctx.P.vz,0);near(f.ctx.P.vy,9);
 near(f.ctx.P.fx,0);near(f.ctx.P.fz,0);
 assert.deepEqual(f.calls,[]);
});

test('jump uses honey-specific impulse; water buoyancy retains its cap',()=>{
 const honey=create({keys:{Space:true},P:{ground:true,vy:-1},under:49});
 honey.velocity(.1,0,0,4.5,false,false);
 near(honey.ctx.P.vy,Math.sqrt(2*26*.3));
 const normal=create({keys:{Space:true},P:{ground:true,vy:0}});
 normal.velocity(.1,0,0,4.5,false,false);
 near(normal.ctx.P.vy,8.5);
 const swim=create({keys:{Space:true},P:{vy:3.4}});
 swim.velocity(.1,0,0,2.475,true,false);
 near(swim.ctx.P.vy,3.5);
});

test('fall speed remains clamped to -40 and keyless water attenuates it',()=>{
 const f=create({P:{vy:-100}});
 f.velocity(.1,0,0,4.5,false,false);
 near(f.ctx.P.vy,-40);
 const w=create({P:{vy:-10}});
 w.velocity(.1,0,0,2.475,true,false);
 near(w.ctx.P.vy,(-10-.9)*.75);
});
