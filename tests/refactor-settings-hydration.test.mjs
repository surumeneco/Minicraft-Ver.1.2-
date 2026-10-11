import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=readFileSync('src/js/11-settings.js','utf8');
const begin=source.indexOf('const FOV_DEF=');
const end=source.indexOf('function applyCfg()',begin);
assert.ok(begin>=0&&end>begin);
const init=source.slice(begin,end);

function load(value){
 const text=typeof value==='string'?value:JSON.stringify(value);
 const ctx={RD_BASE:3,localStorage:{getItem:()=>text},Math,Number,JSON};
 vm.createContext(ctx);
 vm.runInContext(init,ctx);
 return JSON.parse(JSON.stringify(vm.runInContext('cfg',ctx)));
}
const defaults={fov:75,sens:100,bright:100,sprintFov:true,drawDist:3};

test('missing or malformed settings retain defaults',()=>{
 assert.deepEqual(load(null),defaults);
 assert.deepEqual(load('{invalid'),defaults);
});

test('settings keep their current clamping and boolean semantics',()=>{
 assert.deepEqual(load({fov:200,sens:0,bright:170,sprintFov:false,drawDist:999}),
  {fov:125,sens:100,bright:150,sprintFov:false,drawDist:8});
 assert.deepEqual(load({fov:1,sens:40,bright:20,sprintFov:0,drawDist:-2}),
  {fov:25,sens:50,bright:50,sprintFov:true,drawDist:1});
});

test('numeric parsing and null values preserve prior coercion rules',()=>{
 assert.deepEqual(load({fov:'no',sens:null,bright:null,drawDist:null}),
  {fov:75,sens:100,bright:100,sprintFov:true,drawDist:1});
 assert.deepEqual(load({fov:'90',sens:'120',bright:'75',sprintFov:false,drawDist:'5'}),
  {fov:90,sens:120,bright:75,sprintFov:false,drawDist:5});
});
