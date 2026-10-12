import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/06-circuits.js','utf8');
const rsAt=src.indexOf('function rsTick(');
assert.ok(rsAt>=0);
const caseRepeater=src.indexOf('case REPEATER:{const f=s&3,d=',rsAt);
const caseComparator=src.indexOf('case COMPARATOR:',caseRepeater);
const caseObserver=src.indexOf('case OBSERVER:{const f=s&3,cur=',caseComparator);
const casePiston=src.indexOf('case PISTON:',caseObserver);
const helper=src.indexOf('function updateRepeaterState(');
assert.ok(helper>=0||(caseRepeater>=0&&caseComparator>caseRepeater&&caseObserver>caseComparator&&casePiston>caseObserver));

function fixture(){
 let rear=0, observed=0;
 const calls=[];
 const D4=[[0,0,-1],[1,0,0],[0,0,1],[-1,0,0]];
 const ctx={D4,REPEATER:40,OBSERVER:41,
  outAt:(...args)=>{calls.push(['power',...args]);return rear;},
  getB:(...args)=>{calls.push(['block',...args]);return observed;},
  Math};
 vm.createContext(ctx);
 if(helper>=0){
  vm.runInContext(src.slice(helper,rsAt),ctx);
 }else{
  const rawRepeater=src.slice(caseRepeater,caseComparator);
  const rawObserver=src.slice(caseObserver,casePiston);
  vm.runInContext('function updateRepeaterState(c,x,y,z,s,ch){switch(c.bs){'+rawRepeater+'}}',ctx);
  vm.runInContext('function updateObserverState(c,x,y,z,s){switch(c.bs){'+rawObserver+'}}',ctx);
 }
 const rep=(c,s=0)=>{const ch=[];ctx.updateRepeaterState(c,5,7,9,s,ch);return JSON.parse(JSON.stringify(ch));};
 const obs=(c,s=0)=>{ctx.updateObserverState(c,5,7,9,s);};
 return {ctx,calls,rep,obs,setRear:n=>rear=n,setObserved:n=>observed=n};
}

test('repeater starts from persisted OFF state, changes only after its delay',()=>{
 const f=fixture(),c={bs:40};
 f.setRear(15);
 assert.deepEqual(f.rep(c,0),[]);
 assert.equal(c.on,false);assert.equal(c.pv,true);assert.equal(c.tm,1);
 assert.deepEqual(f.rep(c,0),[[5,7,9,40|(16<<8)]]);
 assert.equal(c.on,true);assert.equal(c.pv,undefined);
 assert.deepEqual(f.calls.slice(0,2),[['power',5,7,10,5,9],['power',5,7,10,5,9]]);
 f.setRear(0);
 assert.deepEqual(f.rep(c,16),[]);
 assert.deepEqual(f.rep(c,16),[[5,7,9,40]]);
 assert.equal(c.on,false);
});

test('repeater honors 1-4 tick delay encoding and cancels pending changes',()=>{
 const f=fixture(),c={bs:40,on:false};
 f.setRear(5);
 const s=3<<2;
 for(let i=0;i<4;i++){assert.deepEqual(f.rep(c,s),[]);assert.equal(c.on,false);}
 assert.deepEqual(f.rep(c,s),[[5,7,9,40|(28<<8)]]);
 assert.equal(c.on,true);
 const other={bs:40,on:false};
 f.rep(other,0);
 f.setRear(0);
 f.rep(other,0);
 assert.equal(other.pv,undefined);
 assert.equal(other.on,false);
 f.setRear(10);
 f.rep(other,0);
 assert.equal(other.tm,1);
});

test('observer records its initial front block without creating a pulse',()=>{
 const f=fixture(),c={bs:41};
 f.setObserved(7);
 f.obs(c,0);
 assert.equal(c.last,7);
 assert.equal(c.pulse,undefined);
 f.setObserved(8);
 f.obs(c,0);
 assert.equal(c.last,8);assert.equal(c.pulse,2);
 c.pulse=1;
 f.obs(c,0);
 assert.equal(c.pulse,1);
 f.setObserved(0);
 f.obs(c,0);
 assert.equal(c.pulse,2);
 assert.deepEqual(f.calls.slice(0,2),[['block',5,7,8],['block',5,7,8]]);
});

test('observer/repeater direction uses state low bits without changing evaluation sequence',()=>{
 const f=fixture(),rep={bs:40},obs={bs:41};
 f.setRear(10);f.setObserved(5);
 f.rep(rep,1);
 f.obs(obs,2);
 assert.deepEqual(f.calls,[['power',4,7,9,5,9],['block',5,7,10]]);
});
