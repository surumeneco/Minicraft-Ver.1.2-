import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const circuits=readFileSync('src/js/06-circuits.js','utf8');
const chest=readFileSync('src/js/04-2-containers.js','utf8');
const begin=circuits.indexOf('function contInsert(');
const end=circuits.indexOf('function outAt(',begin);
const moveStart=chest.indexOf('function moveIntoChest(');
const moveEnd=chest.indexOf('function chestPut(',moveStart);
assert.ok(begin>=0&&end>begin&&moveStart>=0&&moveEnd>moveStart);
const source=chest.slice(moveStart,moveEnd)+'\n'+circuits.slice(begin,end);

function fixture(){
 const chests={};
 const blockAt=new Map();
 const getKey=(x,y,z)=>x+','+y+','+z;
 const ctx={chests,getB:(x,y,z)=>blockAt.get(getKey(x,y,z))||0,
  CONTB:new Map([[40,3],[41,2]]),rk:getKey,Math,Map};
 vm.createContext(ctx);
 vm.runInContext(source,ctx);
 return {ctx,chests,blockAt,key:getKey};
}
const slots=a=>JSON.parse(JSON.stringify(a));

test('circuit insert fills existing stacks, then vacant cells, without reordering other IDs',()=>{
 const f=fixture();
 const a=[[10,62],[20,20],null,[10,63],null];
 assert.equal(f.ctx.contInsert(a,10,5),true);
 assert.deepEqual(slots(a),[[10,64],[20,20],[10,2],[10,64],null]);
});

test('failed insertion preserves current partial mutation semantics',()=>{
 const f=fixture(),a=[[10,63],[20,64],null];
 assert.equal(f.ctx.contInsert(a,10,100),false);
 assert.deepEqual(slots(a),[[10,64],[20,64],[10,64]]);
 assert.equal(f.ctx.contInsert(a,10,1),false);
 assert.equal(f.ctx.contInsert(a,10,0),true);
});

test('container output strength retains zero, partial and completely filled levels',()=>{
 const f=fixture(),{ctx,chests,blockAt,key}=f;
 assert.equal(ctx.contLevel(0,1,0),-1);
 blockAt.set(key(0,1,0),40);
 assert.equal(ctx.contLevel(0,1,0),0);
 chests[key(0,1,0)]=[[10,1],null,null];
 assert.equal(ctx.contLevel(0,1,0),1);
 chests[key(0,1,0)]=[[10,64],[20,64],[30,64]];
 assert.equal(ctx.contLevel(0,1,0),15);
 blockAt.set(key(1,1,0),41|(13<<8));
 chests[key(1,1,0)]=[[10,64],null];
 assert.equal(ctx.contLevel(1,1,0),8);
});
