import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const registry=readFileSync('src/js/01-block-registry.js','utf8');
const world=readFileSync('src/js/03-world.js','utf8');
const noise=registry.slice(registry.indexOf('function hs('),registry.indexOf('const F='));
const generation=world.slice(0,world.indexOf('function getC('));
assert.ok(noise.startsWith('function hs(')&&noise.includes('function vn3('));
assert.ok(generation.includes('function genChunk(')&&generation.includes('function decorateTreeCrown('));

function fixture(){
 const ids=new Map();
 const ctx={
  H:80,SL:30,WA:24,LA:25,Math,Map,Set,Uint16Array,
  idx:(x,y,z)=>x+16*(z+16*y),
  nmid:name=>{if(!ids.has(name))ids.set(name,170+ids.size);return ids.get(name)}
 };
 vm.createContext(ctx);
 vm.runInContext(noise+'\n'+generation,ctx);
 return {ctx,edits:vm.runInContext('edits',ctx),ck:vm.runInContext('ck',ctx)};
}
function digest(chunk){
 const buf=Buffer.alloc(chunk.d.length*2);
 for(let i=0;i<chunk.d.length;i++)buf.writeUInt16LE(chunk.d[i],i*2);
 return createHash('sha256').update(buf).digest('hex');
}
function summary(chunk){
 let solid=0,water=0,logs=0;
 for(const value of chunk.d){
  if(value!==0)solid++;
  if(value===24)water++;
  if(value===4||value>=170&&value<=174)logs++;
 }
 return {cx:chunk.cx,cz:chunk.cz,top:chunk.top,solid,water,logs,sha:digest(chunk)};
}

test('actual deterministic world noise preserves 8 chunk snapshots over origin and distant coordinates',()=>{
 const scenarios=[[0,0],[-1,0],[0,-1],[-1,1],[4,-7],[28,31],[-80,120],[450,-320]];
 const f=fixture(),g=fixture();
 const current=scenarios.map(([x,z])=>summary(f.ctx.genChunk(x,z)));
 const repeated=scenarios.map(([x,z])=>summary(g.ctx.genChunk(x,z)));
 assert.deepEqual(current,repeated);
 assert.deepEqual(current,[{"cx":0,"cz":0,"top":31,"solid":7936,"water":5371,"logs":0,"sha":"68152a2c2e4006afdddfda067890472a1112d00daefcbd72e2ea09f245aadc3e"},{"cx":-1,"cz":0,"top":31,"solid":7931,"water":5044,"logs":0,"sha":"f93a5eb3c0e3e659eed88fa709d199c5f6e1ab524245c70fb6048b1cb46ae4a9"},{"cx":0,"cz":-1,"top":31,"solid":7936,"water":5643,"logs":0,"sha":"1bdcb8c1404f7b2826e7570c0cc3fbee5983e25bfc75b3156d993768afc12f11"},{"cx":-1,"cz":1,"top":31,"solid":7936,"water":3701,"logs":0,"sha":"1e3c2cf7efbfc461dc134df1a7115cdef6b3348a1233e5942278c6911b2d169f"},{"cx":4,"cz":-7,"top":31,"solid":7245,"water":1093,"logs":0,"sha":"6eaf28f2fb424ed8a47468c598e6e1895bdf8b132015ec536caf8aa5215e99cf"},{"cx":28,"cz":31,"top":55,"solid":11176,"water":0,"logs":12,"sha":"018d03531fa9905fcac769a4d80e172d61b4d817d3caad9f707f5dbc04020281"},{"cx":-80,"cz":120,"top":45,"solid":9351,"water":0,"logs":12,"sha":"9739caee195332f44710412382eeef9dd9723f5dcbecd4a2654b366f040c5cd0"},{"cx":450,"cz":-320,"top":57,"solid":10906,"water":0,"logs":6,"sha":"a1dd32439a1e330ca0e9b6b1277d6ed484bab365530bd9895f7f8514309527bf"}],'frozen real-noise baseline from green pre-refactor CI #38560851898');
 assert.ok(current.every(x=>x.solid>0&&x.solid<=80*256&&x.top>0&&x.top<=80));
 console.log('WORLD_NOISE_BASELINE='+JSON.stringify(current));
});

test('actual world noise applies persisted edits after decorations and raises top without changing neighbors',()=>{
 const f=fixture(),original=f.ctx.genChunk(0,0),i=f.ctx.idx;
 const base=digest(original),edits=new Map([[i(0,70,0),82],[i(1,20,1),0],[i(15,64,15),84]]);
 f.edits.set(f.ck(0,0),edits);
 const c=f.ctx.genChunk(0,0);
 assert.equal(c.d[i(0,70,0)],82);assert.equal(c.d[i(1,20,1)],0);
 assert.equal(c.d[i(15,64,15)],84);
 assert.equal(c.top,Math.max(original.top,71));
 assert.notEqual(digest(c),base);
 assert.deepEqual(summary(c),{"cx":0,"cz":0,"top":71,"solid":7937,"water":5370,"logs":0,"sha":"2b22d7f430846c4908d0adb2667d38daf95bc24d4313d13041ce722840c123a9"});
 const d=f.ctx.genChunk(0,0);assert.deepEqual(summary(d),summary(c));
 assert.equal(digest(f.ctx.genChunk(1,0)),digest(f.ctx.genChunk(1,0)));
 console.log('WORLD_EDIT_BASELINE='+JSON.stringify(summary(c)));
});
