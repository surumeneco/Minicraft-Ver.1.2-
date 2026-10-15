import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

// Frozen independent pre-extraction reference: no runtime code is imported by it.
function originalColumn(d,lx,lz,X0,Z0,env){
 const {hAt,biomeAt,BI,BID,SL,WA,LA,ore,cave,hs}=env;
 const x=X0+lx,z=Z0+lz,h=hAt(x,z),sd=h<=SL+1,m=Math.max(h,SL),bio=biomeAt(x,z,h);
 for(let y=0;y<=m;y++){
  let surface=sd?6:1,fill=sd?16:2;
  if(!sd){
   if(bio===BI.COAST){surface=6;fill=16}
   else if(bio===BI.SNOW){surface=BID.snow;fill=2}
  }
  let b=y>h?WA:y==h?surface:y>h-4?fill:ore(x,y,z);
  if(y>4&&y<h&&cave(x,y,z))b=y<=11?LA:0;
  d[lx+16*(lz+16*y)]=b;
 }
 d[lx+16*lz]=10;
 for(let y=1;y<5;y++)if(hs(x*3.1+y,z*2.7+y*5)<.8-y*.2)d[lx+16*(lz+16*y)]=10;
 return m+1;
}

const src=readFileSync('src/js/03-world.js','utf8');
const start=src.indexOf('function fillTerrainColumn(');
const end=src.indexOf('function replayChunkEdits(',start);
assert.ok(start>=0&&end>start,'terrain column and attached dependencies');

function fixture(){
 const calls=[];
 const BI={PLAINS:0,FOREST:1,SAVANNA:2,COAST:3,SNOW:4};
 const env={
  BI,BID:{snow:55},SL:10,WA:24,LA:25,
  hAt:(x,z)=>{calls.push(['height',x,z]);return Math.abs(x*13+z*7)%19+3},
  biomeAt:(x,z,h)=>{calls.push(['biome',x,z,h]);return [BI.COAST,BI.SNOW,BI.PLAINS,BI.FOREST][Math.abs(x*3+z*5)%4]},
  ore:(x,y,z)=>{calls.push(['ore',x,y,z]);return [3,11,12,13,14][Math.abs(x+3*y+7*z)%5]},
  cave:(x,y,z)=>{calls.push(['cave',x,y,z]);return Math.abs(x*7+y*13+z*11)%17===0},
  hs:(a,b)=>{calls.push(['bedrock',a,b]);return Math.abs(Math.sin(a*.015+b*.13))}
 };
 const ctx={...env,Uint16Array,Math};
 vm.createContext(ctx);vm.runInContext(src.slice(start,end),ctx);
 return {env,ctx,calls};
}

test('full terrain voxel output equals frozen generator over origin, negative and distant chunks',()=>{
 for(const [x0,z0] of [[0,0],[-16,16],[48,-32]]){
  const old=fixture(),current=fixture();
  const a=new Uint16Array(36*256),b=new Uint16Array(36*256);
  const at=[],bt=[];
  for(let lz=0;lz<16;lz++)for(let lx=0;lx<16;lx++){
   at.push(originalColumn(a,lx,lz,x0,z0,old.env));
   bt.push(current.ctx.fillTerrainColumn(b,lx,lz,x0,z0));
  }
  assert.deepEqual(bt,at,'top elevations: '+x0+','+z0);
  assert.deepEqual(b,a,'all voxel values: '+x0+','+z0);
  assert.deepEqual(current.calls,old.calls,'noise query order: '+x0+','+z0);
 }
});

test('deep-water, snow, cave lava/air and bedrock guards preserve their exact voxel positions',()=>{
 const old=fixture(),current=fixture();
 for(const [x,z] of [[1,1],[3,9],[-4,0],[0,0]]){
  const a=new Uint16Array(36*256),b=new Uint16Array(36*256);
  assert.equal(originalColumn(a,0,0,x,z,old.env),current.ctx.fillTerrainColumn(b,0,0,x,z));
  assert.deepEqual(b,a);
 }
});

test('deep cave override preserves protected bedrock, lava threshold and above-surface water',()=>{
 const f=fixture(),plains=f.ctx.BI.PLAINS;
 f.ctx.cave=()=>true;f.ctx.ore=()=>14;
 assert.equal(f.ctx.terrainBlockValue(2,4,3,20,false,plains),14,
  'bedrock-adjacent ore at y=4 is not cave-replaced');
 assert.equal(f.ctx.terrainBlockValue(2,5,3,20,false,plains),25);
 assert.equal(f.ctx.terrainBlockValue(2,11,3,20,false,plains),25);
 assert.equal(f.ctx.terrainBlockValue(2,12,3,20,false,plains),0);
 assert.equal(f.ctx.terrainBlockValue(2,20,3,20,false,plains),1);
 assert.equal(f.ctx.terrainBlockValue(2,21,3,20,false,plains),24);
});
