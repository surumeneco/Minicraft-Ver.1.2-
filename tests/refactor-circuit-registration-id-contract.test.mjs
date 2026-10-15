import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/06-circuits.js','utf8');
const start=src.indexOf('function rsReg(');
const end=src.indexOf('// セーブ復元',start);
assert.ok(start>=0&&end>start);
const contract=src.slice(start,end);

function setup(){
 const RS=new Map(),edits=new Map();
 const ctx={RS,edits,RSB:new Set([17,19,253]),
  rk:(x,y,z)=>[x,y,z].join(','),
  blockBaseId:v=>v&255};
 vm.createContext(ctx);vm.runInContext(contract,ctx);
 return {ctx,RS,edits};
}

test('registration uses low-byte ID independent of high-byte orientation and state',()=>{
 const f=setup(),state=19|(29<<8);
 f.ctx.rsReg(1,45,-2,0,state);
 assert.deepEqual(Array.from(f.RS.keys()),['1,45,-2']);
 assert.deepEqual(JSON.parse(JSON.stringify(f.RS.get('1,45,-2'))),{x:1,y:45,z:-2});
 f.ctx.rsReg(1,45,-2,state,253|(13<<8));
 assert.equal(f.RS.size,1,'recognized type changes retain existing registration object');
 f.ctx.rsReg(1,45,-2,state,0);
 assert.equal(f.RS.size,0,'removing a redstone block deregisters it');
});

test('unregistered IDs never become circuit parts merely because state bits are populated',()=>{
 const f=setup();
 f.ctx.rsReg(4,22,7,0,2|(253<<8));
 assert.equal(f.RS.size,0);
 f.ctx.rsReg(4,22,7,0,17|(253<<8));
 assert.equal(f.RS.size,1);
 f.ctx.rsReg(4,22,7,17|(253<<8),2|(253<<8));
 assert.equal(f.RS.size,0);
});

test('saved block edits scan translates chunk/local block indices and preserves state',()=>{
 const f=setup();
 // Encoded map key for chunk cx=-2, cz=3.
 const key=(-2+512)*1024+(3+512);
 const y=55,lx=15,lz=10,i=lx+16*(lz+16*y);
 f.edits.set(key,new Map([[i,253|(29<<8)],[i+1,42|(29<<8)]]));
 f.ctx.scanRS();
 assert.deepEqual(Array.from(f.RS.keys()),['-17,55,58']);
 const r=f.RS.get('-17,55,58');
 assert.deepEqual(JSON.parse(JSON.stringify(r)),{x:-17,y:55,z:58});
});

test('empty and non-redstone save edits do not register circuits',()=>{
 const f=setup();
 f.edits.set(512*1024+512,new Map([[0,0],[1,42|(29<<8)]]));
 f.ctx.scanRS();
 assert.equal(f.RS.size,0);
});
