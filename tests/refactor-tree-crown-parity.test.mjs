import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

// Frozen pre-extraction reference for tree crowns and edge clipping.
function legacyDecoration(d,top,X0,Z0,{biomeTree,hAt,biomeAt,BI,SL,H,hs,idx}){
 const set=(x,y,z,b,soft)=>{const lx=x-X0,lz=z-Z0;if(lx<0||lz<0||lx>15||lz>15)return;const i=idx(lx,y,lz);if(soft&&d[i])return;d[i]=b;if(y+1>top)top=y+1};
 for(let tz=Z0-1;tz<Z0+17;tz++)for(let tx=X0-1;tx<X0+17;tx++){
  const tr=biomeTree(tx,tz);if(!tr)continue;
  const h=hAt(tx,tz),bio=biomeAt(tx,tz);if(h<=SL+2||h>H-10)continue;
  if(bio===BI.COAST||h<=SL+3)continue;
  const kind=tr[0],log=tr[1],leaf=tr[2];
  const tall=kind==='spruce'?6:kind==='acacia'?5:4;
  for(let y=1;y<=tall;y++)set(tx,h+y,tz,log);
  if(kind==='acacia'){
   for(let dy=3;dy<=6;dy++){
    const rad=dy===3?1:dy===4?3:dy===5?3:2;
    for(let dx=-rad;dx<=rad;dx++)for(let dz=-rad;dz<=rad;dz++){
     const edge=Math.abs(dx)+Math.abs(dz);
     const wobble=hs((tx+dx)*5.7+dy*11,(tz+dz)*4.3-dy*7);
     const limit=dy===6?3:dy===5?4:dy===4?4:2;
     if(edge<=limit && wobble>.08)set(tx+dx,h+dy,tz+dz,leaf,false);
    }
   }
  }else if(kind==='spruce'){
   for(let dy=2;dy<=tall+1;dy++){const rad=Math.max(0,Math.min(2,Math.floor((tall+1-dy)/2)+1));for(let dx=-rad;dx<=rad;dx++)for(let dz=-rad;dz<=rad;dz++)if(Math.abs(dx)+Math.abs(dz)<=rad+1)set(tx+dx,h+dy,tz+dz,leaf,true)}
  }else if(kind==='jungle'){
   for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=4;dy<=7;dy++)if(Math.abs(dx)+Math.abs(dz)+(dy-4)*.45<4.2)set(tx+dx,h+dy,tz+dz,leaf,true);
  }else{
   for(let dy=tall-2;dy<=tall+1;dy++){
    const rad=dy===tall+1?1:dy===tall?2:2;
    for(let dx=-rad;dx<=rad;dx++)for(let dz=-rad;dz<=rad;dz++){
     const edge=Math.abs(dx)+Math.abs(dz);
     const wobble=hs((tx+dx)*4.1+dy*7,(tz+dz)*3.7-dy*5);
     if(edge<=rad+(wobble>.72?1:0) && !(Math.abs(dx)===rad&&Math.abs(dz)===rad&&wobble<.55))set(tx+dx,h+dy,tz+dz,leaf,true);
    }
   }
  }}
 return top;
}
const src=readFileSync('src/js/03-world.js','utf8');
const start=src.indexOf('function decorateChunkTrees(');
const end=src.indexOf('function genChunk(',start);
assert.ok(start>=0&&end>start,'tree decorator and attached helper');

function fixture(kind,treeX,treeZ,{height=10,coast=false}={}){
 const calls=[],BI={COAST:3};
 const env={
  BI,H:32,SL:5,idx:(x,y,z)=>x+16*(z+16*y),
  biomeTree:(x,z)=>{calls.push(['tree',x,z]);return x===treeX&&z===treeZ?[kind,100,101]:null},
  hAt:(x,z)=>{calls.push(['height',x,z]);return height},
  biomeAt:(x,z)=>{calls.push(['biome',x,z]);return coast?BI.COAST:0},
  hs:(a,b)=>{calls.push(['noise',a,b]);const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n)}
 };
 const ctx={...env,Math,Uint16Array};
 vm.createContext(ctx);vm.runInContext(src.slice(start,end),ctx);
 return {env,ctx,calls};
}

test('all tree crowns retain exact voxel output and noise call order across chunk borders',()=>{
 for(const kind of ['oak','spruce','acacia','jungle','birch']){
  for(const [X0,Z0,tx,tz] of [[0,0,7,8],[0,0,-1,0],[0,0,16,15],[-16,-16,-16,-16]]){
   const prev=fixture(kind,tx,tz),next=fixture(kind,tx,tz);
   const a=new Uint16Array(32*256),b=new Uint16Array(32*256);
   const ta=legacyDecoration(a,1,X0,Z0,prev.env),tb=next.ctx.decorateChunkTrees(b,1,X0,Z0);
   assert.equal(tb,ta,kind+' height '+tx+','+tz);
   assert.deepEqual(b,a,kind+' voxels '+tx+','+tz);
   assert.deepEqual(next.calls,prev.calls,kind+' noise order '+tx+','+tz);
  }
 }
});

test('low elevation and coast continue to suppress trees without noise evaluation',()=>{
 for(const options of [{height:6},{height:10,coast:true},{height:23}]){
  const old=fixture('acacia',0,0,options),now=fixture('acacia',0,0,options);
  const a=new Uint16Array(32*256),b=new Uint16Array(32*256);
  assert.equal(legacyDecoration(a,1,0,0,old.env),now.ctx.decorateChunkTrees(b,1,0,0));
  assert.deepEqual(b,a);assert.deepEqual(now.calls,old.calls);
 }
});
