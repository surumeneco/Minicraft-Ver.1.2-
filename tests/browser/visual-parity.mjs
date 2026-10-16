import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright';

const base=process.env.VISUAL_BASE_SHA;
assert.match(base||'',/^[a-f0-9]{40}$/,'PR base SHA must be supplied');
const root=resolve('.');
const old=mkdtempSync(join(tmpdir(),'minicraft-visual-base-'));
const servers=[];
let browser,worktree=false;

async function startServer(dir,port){
 const child=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],
  {cwd:dir,stdio:'ignore'});
 servers.push(child);
 for(let i=0;i<150;i++){
  if(child.exitCode!==null)throw Error('HTTP server unexpectedly terminated');
  try{const response=await fetch('http://127.0.0.1:'+port+'/');if(response.ok)return}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 throw Error('HTTP server failed to start: '+port);
}

async function capture(port){
 const context=await browser.newContext({viewport:{width:960,height:600}});
 await context.addInitScript(()=>{
  let seed=0x13579bdf;
  Math.random=()=>{
   seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
   return(seed>>>0)/4294967296;
  };
 });
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>typeof startGame==='function'&&
   document.getElementById('startBtn'),null,{timeout:30000});
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>document.getElementById('startGuide')?.style.display==='flex');
  await page.evaluate(()=>{if(document.pointerLockElement)document.exitPointerLock()});
  await page.locator('#closeGuide').click();
  await page.waitForFunction(()=>document.getElementById('msg').style.display==='none');
  const data=await page.evaluate(async()=>{
   const p=eval('P');
   eval('flying=true');
   p.x=43.5;p.y=70.5;p.z=40.5;p.vx=0;p.vy=0;p.vz=0;p.yaw=0;p.pitch=-.42;
   eval('worldClock=300');
   updateDayNight(0);
   // Build a deterministic texture/UV/AO scene using the production world
   // writing and meshing path, rather than a synthetic THREE geometry.
   const patch=[];
   const ids=[3,4,7,8];
   for(let z=33;z<=38;z++)for(let x=40;x<=45;x++)
    patch.push([x,70,z,ids[(x+z)&3]]);
   patch.push([43,71,35,3],[44,71,34,7],[42,71,37,8]);
   applyChanges(patch);
   mesh(getC(2,2));
   // Random entity/cloud positions should not be part of the rendering oracle.
   const scene0=eval('scene');
   for(const m of eval('mobs'))scene0.remove(m.g);
   const cl=eval('CLD');if(cl.m)scene0.remove(cl.m);
   scene0.background.set(0x94b2c2);
   if(scene0.fog){scene0.fog.color.set(0x94b2c2);scene0.fog.near=10;scene0.fog.far=80}
   updatePlayerCamera();
   const c=document.getElementById('c'),gl=c.getContext('webgl2');
   if(!gl)throw Error('WebGL2 unavailable');
   eval('ren.render(scene,cam)');
   const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
   const rgba=new Uint8Array(w*h*4);
   gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
   const samples=[],unique=new Set();
   const sw=96,sh=60;
   for(let j=0;j<sh;j++)for(let i=0;i<sw;i++){
    const x=Math.min(w-1,Math.floor((i+.5)*w/sw)),
      y=Math.min(h-1,Math.floor((j+.5)*h/sh));
    const offset=4*(y*w+x),r=rgba[offset],g=rgba[offset+1],b=rgba[offset+2];
    samples.push(r,g,b);unique.add((r>>4)+','+(g>>4)+','+(b>>4));
   }
   // SHA-256 covers every RGBA byte of the actual rendered framebuffer,
   // not only the sampled visual-diff diagnostics.
   const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',rgba));
   const fullHash=Array.from(digest).map(n=>n.toString(16).padStart(2,'0')).join('');
   return {w,h,samples,unique:unique.size,fullHash};
  });
  assert.deepEqual(errors,[],'real browser page had runtime errors');
  assert.ok(data.w>0&&data.h>0,'WebGL2 framebuffer must exist');
  assert.ok(data.unique>=8,'fixed scene must contain visible, varied rendered colors');
  return data;
 }finally{await context.close()}
}

try{
 execFileSync('git',['worktree','add','--detach',old,base],{cwd:root,stdio:'pipe'});
 worktree=true;
 await Promise.all([startServer(old,8891),startServer(root,8892)]);
 browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 const before=await capture(8891),after=await capture(8892);
 assert.equal(after.w,before.w);
 assert.equal(after.h,before.h);
 const pixels=before.samples.length/3;
 assert.equal(after.samples.length,before.samples.length);
 let changed=0,worst=0;
 for(let k=0;k<before.samples.length;k+=3){
  const diff=Math.max(...[0,1,2].map(d=>Math.abs(before.samples[k+d]-after.samples[k+d])));
  worst=Math.max(worst,diff);
  if(diff>10)changed++;
 }
 console.log('Visual parity: sampled RGB pixels',pixels,'changed >10',changed,
  'worst channel difference',worst,'base colors',before.unique,'head colors',after.unique);
 console.log('Full-frame GPU RGBA SHA-256:',before.fullHash,after.fullHash);
 assert.equal(after.fullHash,before.fullHash,
  'entire fixed GPU framebuffer must be bit-for-bit identical to PR base');
 assert.ok(changed<=Math.floor(pixels*.01),
  'production WebGL output deviated from the unchanged PR base at >1% of sampled positions');
}finally{
 if(browser)await browser.close();
 for(const p of servers){p.kill();try{if(p.exitCode===null)await new Promise(r=>p.once('exit',r))}catch{}}
 if(worktree)execFileSync('git',['worktree','remove','--force',old],{cwd:root});
 rmSync(old,{recursive:true,force:true});
}
