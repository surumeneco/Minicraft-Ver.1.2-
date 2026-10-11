import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source=readFileSync('src/js/10-resource-packs.js','utf8');
const begin=source.indexOf('function collectPackHits(');
const old=source.indexOf('const hits=[];for(let t=0;t<N;t++)');
const end=source.indexOf('if(!hits.length)return 0;',old);
assert.ok(begin>=0||(old>=0&&end>old),'pack-hit selection exists');

function match(bitmapNames){
 const bm=Object.fromEntries(bitmapNames.map(name=>[name,{width:16,height:16,name}]));
 const ctx={FM:{
  0:'stone|smooth_stone',
  1:'grass_block_top#g|grass_top#g',
  2:'oak_log_top|oak_log',
  3:'glass',
  4:'grass_block_side#s',
  5:'missing|absent'
 },N:6,bm};
 vm.createContext(ctx);
 if(begin>=0){
  const code=source.slice(begin,source.indexOf('async function applyPack(',begin));
  vm.runInContext(code,ctx);
  return JSON.parse(JSON.stringify(ctx.collectPackHits(bm).map(([id,b,flag,name])=>[id,b.name,flag,name])));
 }
 vm.runInContext('function collectPackHits(bm){'+source.slice(old,end)+'return hits;}',ctx);
 return JSON.parse(JSON.stringify(ctx.collectPackHits(bm).map(([id,b,flag,name])=>[id,b.name,flag,name])));
}

test('texture hit resolution respects alternate-name priority and atlas tile order',()=>{
 assert.deepEqual(match(['smooth_stone','stone','grass_top','oak_log','oak_log_top','grass_block_side','glass']),[
  [0,'stone','','stone'],
  [1,'grass_top','g','grass_top'],
  [2,'oak_log_top','','oak_log_top'],
  [3,'glass','','glass'],
  [4,'grass_block_side','s','grass_block_side']
 ]);
});

test('missing matches are skipped without affecting later tile indices',()=>{
 assert.deepEqual(match(['grass_block_side']),[[4,'grass_block_side','s','grass_block_side']]);
 assert.deepEqual(match([]),[]);
});

test('a fallback name is used when a preferred atlas alias is unavailable',()=>{
 assert.deepEqual(match(['smooth_stone','grass_top','oak_log']),[
  [0,'smooth_stone','','smooth_stone'],
  [1,'grass_top','g','grass_top'],
  [2,'oak_log','','oak_log']
 ]);
});
