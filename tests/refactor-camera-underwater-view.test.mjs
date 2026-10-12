import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const src=readFileSync('src/js/08-game-loop.js','utf8');
const loop=src.indexOf('function loop(now){');
const cameraHelper=src.indexOf('function updatePlayerCamera(');
const underwaterHelper=src.indexOf('function updateUnderwaterVisuals(');
const cameraStart=src.indexOf('cam.position.set(P.x',loop);
const underwaterStart=src.indexOf('const nu=isW(getB(',cameraStart);
const next=src.indexOf('target=ray()',underwaterStart);
assert.ok(loop>=0&&(cameraHelper>=0||(cameraStart>=0&&underwaterStart>cameraStart&&next>underwaterStart)));
const code=cameraHelper>=0?
 src.slice(cameraHelper,loop):
 'function updatePlayerCamera(){'+src.slice(cameraStart,underwaterStart)+'}\n'+
 'function updateUnderwaterVisuals(){'+src.slice(underwaterStart,next)+'}';

function create({underwater=false,cloud=true,fov=65,cfg={fov:75,sprintFov:true},sprintAmt=.5,RD=3}={}){
 let inWater=underwater;const events=[],samples=[];
 const CLD={m:{visible:cloud}};
 const P={x:2.4,y:5,z:-3.2,pitch:.3,yaw:-.7};
 const cam={fov,position:{set:(...args)=>events.push(['position',...args])},
  rotation:{set:(...args)=>events.push(['rotation',...args])},
  updateProjectionMatrix:()=>events.push(['projection'])};
 const scene={fog:{color:{set:n=>events.push(['fogColor',n])},near:11,far:12},
  background:{set:n=>events.push(['background',n])}};
 const uwOverlay={style:{opacity:0}};
 const ctx={P,cam,cfg,sprintAmt,RD,CLD,scene,uwOverlay,
  Math,isW:v=>v===9,getB:(...coords)=>{samples.push(coords);return inWater?9:0}};
 vm.createContext(ctx);vm.runInContext('let uw=false;\n'+code,ctx);
 return {ctx,cam,events,samples,CLD,scene,uwOverlay,camera:()=>ctx.updatePlayerCamera(),visuals:()=>ctx.updateUnderwaterVisuals(),setWater:v=>{inWater=v},uw:()=>vm.runInContext('uw',ctx)};
}
test('camera preserves position, pitch/yaw and sprint-FOV projection refresh order',()=>{
 const f=create();f.camera();
 assert.deepEqual(f.events,[['position',2.4,6.6,-3.2],['projection'],['rotation',.3,-.7,0]]);
 assert.equal(f.cam.fov,81);
});
test('projection is not refreshed when FOV error does not exceed 0.01',()=>{
 const f=create({fov:81.005});
 f.camera();
 assert.deepEqual(f.events,[['position',2.4,6.6,-3.2],['rotation',.3,-.7,0]]);
 const noSprint=create({cfg:{fov:72,sprintFov:false},fov:65});
 noSprint.camera();assert.equal(noSprint.cam.fov,72);
});
test('an unchanged above-water view does not mutate fog, clouds or overlay',()=>{
 const f=create();f.visuals();
 assert.equal(f.uw(),false);
 assert.deepEqual(f.events,[]);
 assert.deepEqual(f.samples,[[2,6,-4]]);
 assert.equal(f.CLD.m.visible,true);
});
test('entering water hides clouds, updates overlay and chooses underwater fog',()=>{
 const f=create({underwater:true});
 f.visuals();
 assert.equal(f.uw(),true);
 assert.equal(f.uwOverlay.style.opacity,1);
 assert.equal(f.CLD.m.visible,false);
 assert.deepEqual(f.events,[['fogColor',0x1d4a8c],['background',0x1d4a8c]]);
 assert.equal(f.scene.fog.near,.1);
 assert.equal(f.scene.fog.far,24);
 f.events.length=0;f.visuals();assert.deepEqual(f.events,[]);
});
test('leaving water restores sky and draw-distance-dependent fog limits',()=>{
 const f=create({underwater:true,RD:3});
 f.visuals();f.setWater(false);f.events.length=0;f.visuals();
 assert.equal(f.uw(),false);
 assert.equal(f.uwOverlay.style.opacity,0);
 assert.equal(f.CLD.m.visible,true);
 assert.deepEqual(f.events,[['fogColor',0x87ceeb],['background',0x87ceeb]]);
 assert.equal(f.scene.fog.near,35);
 assert.equal(f.scene.fog.far,38);
});
