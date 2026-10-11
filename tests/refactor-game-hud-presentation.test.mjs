import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=readFileSync('src/js/08-game-loop.js','utf8');
const helper=source.indexOf('function formatHudText(');
const original=source.indexOf('if(++fr%15==0)hud.textContent=');
const suffix=source.indexOf(';\n ren.render(',original);
assert.ok(helper>=0||(original>=0&&suffix>original));
const legacyExpression=original>=0?
 source.slice(original+'if(++fr%15==0)hud.textContent='.length,suffix):'';

function display({flying=false,swimDash=false,crouching=false,shieldUp=false,dashing=false,hunger=10,keys={},x=-3,z=6}={}){
 const ctx={flying,swimDash,crouching,shieldUp,dashing,hunger,keys,ix:x,iz:z,P:{y:17.6},fps:59.9,
  C:new Map([[1,1],[2,2]]),equipped:{weapon:9},ITEMS:{9:{name:'弓'}},
  circuitOn:true,Math};
 vm.createContext(ctx);
 if(helper>=0){
  vm.runInContext(source.slice(helper,source.indexOf('function loop(now)',helper)),ctx);
  return ctx.formatHudText(crouching,swimDash,dashing,x,z);
 }
 return vm.runInContext('('+legacyExpression+')',Object.assign(ctx,{ix:x,iz:z}));
}

test('hud keeps coordinate, fps, chunk, equipment and circuit display',()=>{
 assert.equal(display(),'X:-3 Y:17 Z:6  FPS:59  チャンク:2  装備:弓  回路:ON');
});

test('flight, swimming, shielding and crouching retain their priority',()=>{
 assert.ok(display({flying:true,swimDash:true,crouching:true,shieldUp:true}).startsWith('✈飛行中  '));
 assert.ok(display({swimDash:true,crouching:true,shieldUp:true}).startsWith('泳ぎ中  '));
 assert.ok(display({crouching:true,shieldUp:true}).startsWith('盾を構え中  '));
 assert.ok(display({crouching:true}).startsWith('しゃがみ中  '));
 assert.ok(display({dashing:true}).startsWith('ダッシュ  '));
});

test('sprint denied by hunger is distinguished from ordinary walking',()=>{
 const keys={KeyW:1,KeyR:1};
 assert.ok(display({hunger:3,keys}).startsWith('空腹でダッシュ不可  '));
 assert.ok(display({hunger:4,keys}).startsWith('X:-3 '));
});
