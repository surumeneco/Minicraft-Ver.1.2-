import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/08-game-loop.js','utf8');
const helper=src.indexOf('function advancePlayerCollision(');
const a=src.indexOf('const gnd=P.ground;',src.indexOf('function loop(now)'));
const b=src.indexOf('cam.position.set(',a);
assert.ok(helper>=0||(a>=0&&b>a),'player collision block');
const code=helper>=0
 ?src.slice(helper,src.indexOf('function loop(now)',helper))
 :'function advancePlayerCollision(dt,bodyHit,crouching,iw,swimDash,f,s){'+src.slice(a,b)+'}';

function fixture({ground=true,flying=false,collide=()=>false,support=()=>true,slime=false,
 vx=2,vy=-3,vz=1,water=false,swimming=false,forward=1}={}){
 const calls=[],toasts=[];
 const P={x:0,y:10,z:0,vx,vy,vz,ground};
 const ctx={
  P,flying,R:.35,Math,
  crouchHasSupport:(...p)=>{calls.push(['support',...p]);return support(...p)},
  slimeUnder:(...p)=>{calls.push(['slime',...p]);return slime},
  hit:(...p)=>{calls.push(['probe',...p]);return false},
  toast:message=>toasts.push(message)
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const run=(dt=.1,crouching=false)=>ctx.advancePlayerCollision(dt,(...p)=>{calls.push(['collide',...p]);return collide(...p)},crouching,water,swimming,forward,0);
 return {P,ctx,calls,toasts,run};
}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,String(actual)+' != '+String(expected));

test('unobstructed movement changes all three coordinates and unsets grounded state',()=>{
 const f=fixture();f.run();
 close(f.P.x,.2);close(f.P.y,9.7);close(f.P.z,.1);
 assert.equal(f.P.ground,false);
 assert.equal(f.calls.filter(x=>x[0]==='collide').length,3);
});

test('crouching prevents walking over unsupported edges without stepping up',()=>{
 const f=fixture({support:()=>false});f.run(.1,true);
 close(f.P.x,0);close(f.P.z,0);close(f.P.y,9.7);
 assert.equal(f.P.ground,false);
 assert.equal(f.calls.filter(x=>x[0]==='support').length,2);
});

test('an obstacle can trigger step-up when currently grounded and not crouching',()=>{
 const f=fixture({vy:0,collide:(x,y)=>x>.1&&y<10.5});f.run();
 close(f.P.x,.2);close(f.P.z,.1);close(f.P.y,10.6);
 assert.equal(f.P.ground,false);
});

test('water collision raises the player when swimming against an obstacle',()=>{
 const f=fixture({ground:false,vy:-2,water:true,collide:(x,y)=>x>.1&&y<10.5});f.run();
 close(f.P.x,0);close(f.P.vy,7);close(f.P.y,10.7);
 assert.equal(f.P.ground,false);
});

test('slime bounce and ordinary ground collision preserve their distinct landing speeds',()=>{
 const bounce=fixture({vy:-5,slime:true,collide:(x,y)=>y<10});bounce.run();
 close(bounce.P.y,10);close(bounce.P.vy,5*Math.SQRT1_2);
 assert.equal(bounce.P.ground,true);
 const normal=fixture({vy:-5,collide:(x,y)=>y<10});normal.run();
 close(normal.P.vy,0);assert.equal(normal.P.ground,true);
});

test('colliding vertically while flying disables flight with an unchanged notification',()=>{
 const f=fixture({flying:true,vy:-5,collide:(x,y)=>y<10});f.run();
 close(f.P.vy,0);assert.equal(f.ctx.flying,false);
 assert.deepEqual(f.toasts,['飛行モード OFF']);
});
