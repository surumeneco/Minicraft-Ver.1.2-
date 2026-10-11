import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const src=readFileSync('src/js/03-world.js','utf8');
const helperStart=src.indexOf('function fillTerrainColumn(');
const start=helperStart>=0?helperStart:src.indexOf('function genChunk(');
const end=src.indexOf('function getC(',start);
assert.ok(start>=0&&end>start,'chunk generation section exists');
const section=src.slice(start,end);

function make({height=7,biome='PLAINS',tree=null,edits=null,noise=()=>1,caves=()=>false}={}){
 const BI={COAST:0,SAVANNA:1,SNOW:2,FOREST:3,PLAINS:4};
 const ctx={
  Uint16Array,Math,Map,H:20,SL:5,WA:24,LA:25,BI,
  BID:{snow:55},
  hAt:()=>height,biomeAt:()=>BI[biome],
  biomeTree:(x,z)=>x===0&&z===0?tree:null,
  hs:noise,cave:caves,ore:()=>3,
  edits:edits||new Map(),
  ck:(x,z)=>x+','+z,
  idx:(x,y,z)=>x+16*(z+16*y)
 };
 vm.createContext(ctx);
 vm.runInContext(section,ctx);
 return {ctx,chunk:()=>ctx.genChunk(0,0),idx:ctx.idx};
}

test('terrain layers, bedrock and top height remain unchanged',()=>{
 const {chunk,idx}=make(),c=chunk();
 assert.equal(c.top,8);
 assert.equal(c.d[idx(0,0,0)],10);
 assert.equal(c.d[idx(0,2,0)],3);
 assert.equal(c.d[idx(0,4,0)],2);
 assert.equal(c.d[idx(0,6,0)],2);
 assert.equal(c.d[idx(0,7,0)],1);
 assert.equal(c.d[idx(0,8,0)],0);
 assert.equal(c.d[idx(15,7,15)],1);
 assert.equal(c.v,false);
 assert.equal(c.cx,0);assert.equal(c.cz,0);
});

test('coastal water fill and snow biome use their original layer selection',()=>{
 const a=make({height:3,biome:'COAST'}),c=a.chunk();
 assert.equal(c.top,6);
 assert.equal(c.d[a.idx(0,1,0)],16);
 assert.equal(c.d[a.idx(0,3,0)],6);
 assert.equal(c.d[a.idx(0,4,0)],24);
 assert.equal(c.d[a.idx(0,5,0)],24);
 const b=make({height:8,biome:'SNOW'}),snow=b.chunk();
 assert.equal(snow.d[b.idx(0,8,0)],55);
 assert.equal(snow.d[b.idx(0,7,0)],2);
});

test('caves are evaluated before bedrock floor substitutions',()=>{
 const a=make({height:10,noise:()=>0,caves:()=>true}),c=a.chunk();
 assert.equal(c.d[a.idx(0,0,0)],10);
 assert.equal(c.d[a.idx(0,1,0)],10);
 assert.equal(c.d[a.idx(0,5,0)],25);
 assert.equal(c.d[a.idx(0,9,0)],25);
 assert.equal(c.d[a.idx(0,10,0)],1);
});

test('tree decoration is added after terrain and does not overwrite an existing trunk with soft leaves',()=>{
 const a=make({height:9,tree:['oak',4,5]}),c=a.chunk();
 assert.equal(c.d[a.idx(0,11,0)],4);
 assert.equal(c.d[a.idx(1,11,0)],5);
 assert.equal(c.d[a.idx(0,14,0)],5);
 assert.equal(c.top,15);
});

test('saved block edits overwrite generated terrain and raise top only when needed',()=>{
 const edits=new Map([['0,0',new Map([[0,8],[16*(16*7),0],[16*(16*12),9]])]]);
 const a=make({edits}),c=a.chunk();
 assert.equal(c.d[0],8);
 assert.equal(c.d[a.idx(0,7,0)],0);
 assert.equal(c.d[a.idx(0,12,0)],9);
 assert.equal(c.top,13);
 const second=a.chunk();
 assert.deepEqual(Array.from(c.d),Array.from(second.d));
});

test('tree decoration preserves spruce/acacia height and species-specific crowns',()=>{
 const spruce=make({height:9,tree:['spruce',70,71]}),a=spruce.chunk();
 assert.equal(a.d[spruce.idx(0,15,0)],70);
 assert.equal(a.d[spruce.idx(0,16,0)],71);
 assert.equal(a.top,17);
 const acacia=make({height:9,tree:['acacia',72,73]}),b=acacia.chunk();
 assert.equal(b.d[acacia.idx(0,14,0)],73); // Acacia foliage may replace trunk voxels.
 assert.equal(b.d[acacia.idx(0,15,0)],73);
 assert.equal(b.top,16);
});
