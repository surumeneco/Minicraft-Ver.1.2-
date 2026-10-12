import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source=readFileSync('src/js/08-game-loop.js','utf8');
const loop=source.indexOf('function loop(now){');
const oldClock=source.indexOf('const dt=Math.min(',loop),clockEnd=source.indexOf('const f=inv?',oldClock);
const oldHunger=source.indexOf("if(gameStarted&&!pauseMenuOpen",loop),hungerEnd=source.indexOf('const inWater=',oldHunger);
const clockHelper=source.indexOf('function advanceFrameClock('),hungerHelper=source.indexOf('function advanceHungerClock(');
assert.ok(loop>=0&&((clockHelper>=0)||(oldClock>=0&&clockEnd>oldClock)));
assert.ok((hungerHelper>=0)||(oldHunger>=0&&hungerEnd>oldHunger));
const clockCode=clockHelper>=0?source.slice(clockHelper,source.indexOf('function loop(now){',clockHelper)):
 'function advanceFrameClock(now){'+source.slice(oldClock,clockEnd).replace('const dt=', 'const dt=')+'return dt;}';
const hungerCode=hungerHelper>=0?source.slice(hungerHelper,source.indexOf('function loop(now){',hungerHelper)):
 'function advanceHungerClock(dt){'+source.slice(oldHunger,hungerEnd)+'}';

function clock({last=1000,fps=60}={}){
 const ctx={Math};vm.createContext(ctx);
 vm.runInContext('let last='+last+',fps='+fps+';\n'+clockCode,ctx);
 return {run:now=>ctx.advanceFrameClock(now),fps:()=>vm.runInContext('fps',ctx),last:()=>vm.runInContext('last',ctx)};
}
function hunger({value=10,timer=0,gameStarted=true,pauseMenuOpen=false,display='none'}={}){
 const calls=[],ctx={gameStarted,pauseMenuOpen,msg:{style:{display}},Math,
  updateHp:()=>calls.push('updateHp'),save:flag=>calls.push(['save',flag])};
 vm.createContext(ctx);
 vm.runInContext('let hunger='+value+',hungerTimer='+timer+';\n'+hungerCode,ctx);
 return {ctx,calls,run:dt=>ctx.advanceHungerClock(dt),hunger:()=>vm.runInContext('hunger',ctx),timer:()=>vm.runInContext('hungerTimer',ctx)};
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+' != '+b);

test('frame clock caps elapsed dt at 50 ms and smooths FPS',()=>{
 const f=clock();
 close(f.run(1100),.05);close(f.fps(),58);
 assert.equal(f.last(),1100);
 close(f.run(1120),.02);close(f.fps(),57.6);
 assert.equal(f.last(),1120);
});
test('submillisecond elapsed time uses a 1ms floor only for FPS estimation',()=>{
 const f=clock();
 close(f.run(1000),0);
 close(f.fps(),107);
 close(f.run(999.5),-.0005);
 close(f.fps(),151.65);
});
test('hunger count stays unchanged below 300 seconds, then updates and saves',()=>{
 const f=hunger({timer:299.9});
 f.run(.05);close(f.timer(),299.95);assert.equal(f.hunger(),10);assert.deepEqual(f.calls,[]);
 f.run(.05);assert.equal(f.hunger(),9);close(f.timer(),0);
 assert.deepEqual(f.calls,['updateHp',['save',false]]);
});
test('elapsed hunger debt removes multiple points and retains fractional remainder',()=>{
 const f=hunger({value:5,timer:10});
 f.run(650);assert.equal(f.hunger(),3);close(f.timer(),60);
 assert.deepEqual(f.calls,['updateHp',['save',false]]);
 f.run(10000);assert.equal(f.hunger(),0);close(f.timer(),160);
 assert.equal(f.calls.length,4);
});
test('zero hunger, paused game, and visible message block accumulation',()=>{
 for(const cfg of [{value:0},{pauseMenuOpen:true},{gameStarted:false},{display:'flex'}]){
  const f=hunger(cfg);f.run(500);
  assert.equal(f.hunger(),cfg.value??10);
  close(f.timer(),0);assert.deepEqual(f.calls,[]);
 }
});
