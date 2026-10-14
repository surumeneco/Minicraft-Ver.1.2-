import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

// Exercise the original event wiring, so these assertions work both before
// and after the pause transition is extracted into its own function.
const source=readFileSync('src/js/04-1-input.js','utf8');
const boundary=source.indexOf('function hit(');
assert.ok(boundary>0,'input listener prefix');

function fixture(){
 const events=new Map(),calls=[];
 const listen=(type,fn)=>events.set(type,[...(events.get(type)||[]),fn]);
 const element=(id)=>({
  style:{display:id==='msg'?'none':''},textContent:'',
  addEventListener:listen,
  setAttribute:(name,value)=>calls.push(['attribute',name,value]),
  requestPointerLock:()=>calls.push(['requestPointerLock'])
 });
 const nodes=Object.fromEntries(
  ['msg','startBtn','pauseMenu','resumeBtn','resetWorldBtn','startGuide'].map(id=>[id,element(id)])
 );
 const document={
  pointerLockElement:{},
  getElementById:id=>nodes[id]||null,
  addEventListener:listen,
  exitPointerLock(){calls.push(['exitPointerLock']);this.pointerLockElement=null}
 };
 const ctx={
  document,addEventListener:listen,
  inv:true, invEl:{style:{display:'flex'}},chestKey:'1,2,3',chestUI:{style:{display:'flex'}},
  foodRightHeld:true,foodEatTimer:17,leftBreakHeld:true,leftBreakTimer:23,
  rightPlaceHeld:true,rightPlaceTimer:29,drag:true,
  lastSp:0,flying:false,P:{vy:3},
  hot:[11,12],sel:0,
  save:manual=>calls.push(['save',manual,vm.runInContext('pauseMenuOpen',ctx)]),
  clearTimeout:id=>calls.push(['clearTimeout',id]),
  clearInterval:id=>calls.push(['clearInterval',id]),
  setSel:sel=>calls.push(['setSel',sel]),
  toggleInv:()=>{ctx.inv=!ctx.inv;calls.push(['toggleInv'])},
  dropSelected:()=>calls.push(['dropSelected']),
  toast:msg=>calls.push(['toast',msg]),
  performance:{now:()=>ctx.now||1000},
  cv:{requestPointerLock:()=>calls.push(['cvPointerLock'])},
  ren:{render:()=>{}},scene:{},cam:{},resize:()=>{},
  console
 };
 vm.createContext(ctx);
 vm.runInContext(source.slice(0,boundary),ctx);
 const state=(expr)=>vm.runInContext(expr,ctx);
 const key=(code,repeat=false)=>{
  const e={code,repeat,preventDefault:()=>calls.push(['preventDefault'])};
  for(const fn of events.get('keydown')||[])fn(e);
  return e;
 };
 return {ctx,calls,nodes,document,state,key,events};
}

test('Escape closes inventory and chest, saves before pausing, releases held inputs and pointer lock',()=>{
 const f=fixture();
 f.state('gameStarted=true;keys.KeyW=1;drag=true;');
 f.key('Escape');
 assert.equal(f.ctx.inv,false);
 assert.equal(f.ctx.invEl.style.display,'none');
 assert.equal(f.ctx.chestKey,null);
 assert.equal(f.ctx.chestUI.style.display,'none');
 assert.equal(f.state('pauseMenuOpen'),true);
 assert.equal(f.nodes.pauseMenu.style.display,'flex');
 assert.equal(f.state('keys.Escape'),0);
 assert.equal(f.state('keys.KeyW'),0);
 assert.equal(f.ctx.foodRightHeld,false);
 assert.equal(f.ctx.leftBreakHeld,false);
 assert.equal(f.ctx.rightPlaceHeld,false);
 assert.equal(f.state('drag'),false);
 assert.deepEqual(f.calls,[
  ['preventDefault'],['save',false,false],
  ['clearTimeout',17],['clearInterval',23],['clearInterval',29],
  ['attribute','aria-hidden','false'],['exitPointerLock']
 ]);
});

test('paused keys are ignored; Escape alone prevents the browser default',()=>{
 const f=fixture();
 f.state('gameStarted=true;pauseMenuOpen=true;keys.KeyW=1;');
 f.key('KeyE');f.key('Escape');
 assert.equal(f.ctx.inv,true);
 assert.equal(f.state('keys.KeyE'),undefined);
 assert.equal(f.state('keys.KeyW'),1);
 assert.deepEqual(f.calls,[['preventDefault']]);
});

test('Escape before game start or auto-repeated Escape retains the pressed key without pausing',()=>{
 const f=fixture();
 f.key('Escape');
 assert.equal(f.state('pauseMenuOpen'),false);
 assert.equal(f.state('keys.Escape'),1);
 f.state('gameStarted=true;keys.Escape=0;');
 f.key('Escape',true);
 assert.equal(f.state('pauseMenuOpen'),false);
 assert.equal(f.state('keys.Escape'),1);
 assert.deepEqual(f.calls,[]);
});

test('hotbar, inventory, save and drop shortcuts keep their original event routing',()=>{
 const f=fixture();
 f.ctx.inv=false;
 f.key('Digit2');
 f.key('KeyE');
 f.key('KeyC');
 f.key('KeyP');
 f.ctx.inv=false;
 f.key('KeyQ');
 assert.deepEqual(f.calls,[
  ['setSel',1],['toggleInv'],['save',true,false],['dropSelected']
 ]);
 assert.equal(f.state('invPage'),'inventory');
});
