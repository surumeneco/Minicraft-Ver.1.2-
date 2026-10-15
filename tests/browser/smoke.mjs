import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {deflateSync,deflateRawSync} from 'node:zlib';
import {chromium} from 'playwright';

// Runs against the checked-out site in a real Chromium browser. This is not
// part of node --test tests/*.test.mjs; the dedicated workflow installs Chrome.
function crc32(bytes){
 let c=0xffffffff;
 for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}
 return (c^0xffffffff)>>>0;
}
function pngChunk(tag,data){
 const length=Buffer.alloc(4);length.writeUInt32BE(data.length);
 const name=Buffer.from(tag),crc=Buffer.alloc(4);
 crc.writeUInt32BE(crc32(Buffer.concat([name,data])));
 return Buffer.concat([length,name,data,crc]);
}
function redPixelPng(){
 const header=Buffer.alloc(13);
 header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);
 header[8]=8;header[9]=6;
 return Buffer.concat([
  Buffer.from('89504e470d0a1a0a','hex'),
  pngChunk('IHDR',header),
  pngChunk('IDAT',deflateSync(Buffer.from([0,255,0,0,255]))),
  pngChunk('IEND',Buffer.alloc(0))
 ]);
}
function zipBlockPng(){
 const name=Buffer.from('assets/minecraft/textures/block/grass_block_top.png');
 const raw=redPixelPng(),packed=deflateRawSync(raw),crc=crc32(raw);
 const local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);
 local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(raw.length,22);
 local.writeUInt16LE(name.length,26);
 central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);
 central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);
 central.writeUInt32LE(packed.length,20);central.writeUInt32LE(raw.length,24);
 central.writeUInt16LE(name.length,28);
 const offset=local.length+name.length+packed.length;
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
 end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([local,name,packed,central,name,end]);
}

const webServer=spawn('python3',['-m','http.server','8000','--bind','127.0.0.1'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){
  try{const r=await fetch('http://127.0.0.1:8000/');if(r.ok)break;}catch{}
  if(i===99)throw Error('local HTTP server did not start');
  await new Promise(r=>setTimeout(r,100));
 }
 browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.stack||String(e)));
 const res=await page.goto('http://127.0.0.1:8000/',{waitUntil:'load',timeout:60000});
 assert.equal(res.status(),200);
 await page.waitForFunction(()=>typeof startGame==='function'&&document.getElementById('startBtn'),{timeout:60000});
 const gl=await page.evaluate(()=>{
  const canvas=document.getElementById('c');
  return {webgl2:!!canvas.getContext('webgl2'),webgl:!!canvas.getContext('webgl')};
 });
 console.log('Canvas rendering contexts:',gl,'runtime errors:',errors);
 assert.equal(gl.webgl2||gl.webgl,true,'WebGL context unavailable (do not treat as visual pass)');
 await page.locator('#startBtn').click();
 await page.waitForFunction(()=>document.getElementById('startGuide').style.display==='flex');
 // Pointer lock sends mouse events to the canvas until released.
 await page.evaluate(()=>{if(document.pointerLockElement)document.exitPointerLock()});
 await page.locator('#closeGuide').click();
 await page.waitForFunction(()=>document.getElementById('msg').style.display==='none');
 await page.waitForFunction(()=>eval('fr')>=3,{timeout:20000});
 mkdirSync('artifacts',{recursive:true});
 await page.screenshot({path:'artifacts/minicraft-browser-smoke.png'});
 // Read real rendered WebGL2 output, not only the canvas atlas or an available
 // context. Rendering and readPixels run in the same JS task because
 // preserveDrawingBuffer may be disabled by the renderer.
 const fb=await page.evaluate(()=>{
  const c=document.getElementById('c'),gl=c.getContext('webgl2');
  eval('ren.render(scene,cam)');
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
  const pixels=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let nonzeroAlpha=0,nonzeroColor=0;const rgb=new Set();
  for(let i=0;i<pixels.length;i+=4){
   if(pixels[i+3])nonzeroAlpha++;
   if(pixels[i]||pixels[i+1]||pixels[i+2])nonzeroColor++;
   if(i%2048===0)rgb.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2]);
  }
  return {w,h,nonzeroAlpha,nonzeroColor,uniqueSamples:rgb.size};
 });
 assert.ok(fb.w>0&&fb.h>0,'framebuffer size must be nonzero');
 assert.ok(fb.nonzeroAlpha>fb.w*fb.h/2,'GPU framebuffer was empty/transparent');
 assert.ok(fb.nonzeroColor>fb.w*fb.h/2,'GPU framebuffer was all black');
 console.log('Real GPU framebuffer readback:',fb);

 await page.keyboard.press('e');
 await page.waitForFunction(()=>document.getElementById('inv').style.display==='flex');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.getElementById('pauseMenu').style.display==='flex');
 const beforeSave=await page.evaluate(()=>JSON.parse(localStorage.getItem('minicraft_v2')));
 assert.ok(beforeSave&&Array.isArray(beforeSave.p)&&Array.isArray(beforeSave.craftSlots));
 await page.locator('#resumeBtn').click();
 await page.waitForFunction(()=>document.getElementById('pauseMenu').style.display==='none');

 const original=await page.evaluate(()=>eval('ac.toDataURL("image/png")'));
 await page.locator('input[type=file][accept*=".zip"]').setInputFiles({
  name:'chromium-test.zip',mimeType:'application/zip',buffer:zipBlockPng()
 });
 await page.waitForFunction(()=>!!localStorage.getItem('minicraft_pack'),{timeout:30000});
 const applied=await page.evaluate(()=>eval('ac.toDataURL("image/png")'));
 assert.notEqual(applied,original,'real ZIP/PNG did not update atlas pixels');
 // Ensure a saved real PNG atlas is rehydrated after a full browser reload.
 await page.reload({waitUntil:'load',timeout:60000});
 await page.waitForFunction(expected=>eval('ac.toDataURL("image/png")')===expected,applied,{timeout:20000});
 await page.waitForFunction(()=>eval('fr')>=3,{timeout:20000});
 await page.locator('#startBtn').click();
 await page.waitForFunction(()=>document.getElementById('startGuide').style.display==='flex');
 await page.evaluate(()=>{if(document.pointerLockElement)document.exitPointerLock()});
 await page.locator('#closeGuide').click();
 await page.waitForFunction(()=>document.getElementById('msg').style.display==='none');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.getElementById('pauseMenu').style.display==='flex');
 await page.locator('#pauseMenu button').filter({hasText:'標準テクスチャに戻す'}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('minicraft_pack')),null);
 assert.equal(await page.evaluate(()=>eval('ac.toDataURL("image/png")')),original);

 await page.reload({waitUntil:'load',timeout:60000});
 await page.waitForFunction(()=>eval('fr')>=3,{timeout:20000});
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('minicraft_v2')));
 // Mouse pointer lock and simulation may legitimately update pitch/yaw or Y before pagehide.
 assert.deepEqual([restored.p[0],restored.p[2]],[beforeSave.p[0],beforeSave.p[2]]);
 assert.deepEqual(restored.craftSlots,beforeSave.craftSlots);
 assert.deepEqual(errors,[],'unexpected browser runtime exceptions');

 // Exercise an older save shape in a fresh Chromium storage context, without
 // inventing a user-provided save file or changing the production schema.
 const legacyContext=await browser.newContext({viewport:{width:1280,height:800}});
 const oldSave={
  e:{'524800':[8977,7]},p:[18,42,19,0,0],
  hot:[24,25,3,4,5,6,7,8,9],sel:3,
  invCount:{101:5},equipped:{helmet:null},
  ch:{'1,35,1':[[101,2],null]}
 };
 await legacyContext.addInitScript(snapshot=>{
  if(!localStorage.getItem('minicraft_v2'))
   localStorage.setItem('minicraft_v2',JSON.stringify(snapshot));
 },oldSave);
 const legacy=await legacyContext.newPage();
 const legacyErrors=[];legacy.on('pageerror',e=>legacyErrors.push(e.stack||String(e)));
 await legacy.goto('http://127.0.0.1:8000/',{waitUntil:'load',timeout:60000});
 await legacy.waitForFunction(()=>eval('loaded')===true,{timeout:20000});
 const restoredLegacy=await legacy.evaluate(()=>({
  coords:[eval('P').x,eval('P').z],
  hot:Array.from(eval('hot')),
  inv:eval('invCount')[101],
  chest:eval('chests')['1,35,1'][0],
  edit:Array.from(eval('edits').get(524800)||[]),
  hp:eval('hp'),hunger:eval('hunger'),worldClock:eval('worldClock'),
  slots:Array.from(eval('craftSlots'))
 }));
 assert.deepEqual(restoredLegacy.coords,[18,19]);
 assert.deepEqual(restoredLegacy.hot.slice(0,4),[1,1,3,4]);
 assert.equal(restoredLegacy.inv,5);
 assert.deepEqual(restoredLegacy.chest,[101,2]);
 assert.deepEqual(restoredLegacy.edit,[[8977,7]]);
 assert.deepEqual([restoredLegacy.hp,restoredLegacy.hunger],[20,10]);
 assert.ok(restoredLegacy.worldClock>=0&&restoredLegacy.worldClock<1,'default world clock may advance with live frames');
 assert.deepEqual(restoredLegacy.slots,[null,null,null,null]);

 // A real Chromium click goes through the chest grid's registered DOM handlers.
 await legacy.locator('#startBtn').click();
 await legacy.waitForFunction(()=>document.getElementById('startGuide').style.display==='flex');
 await legacy.evaluate(()=>{if(document.pointerLockElement)document.exitPointerLock()});
 await legacy.locator('#closeGuide').click();
 await legacy.waitForFunction(()=>document.getElementById('msg').style.display==='none');
 await legacy.evaluate(()=>{
  eval('invCount')[1]=5;
  eval('chests')['3,35,3']=[[1,2],null];
  openChest(3,35,3);
 });
 await legacy.waitForFunction(()=>document.getElementById('chestUI').style.display==='flex');
 await legacy.locator('#chestBody .chGrid').first().locator('.it').first().click();
 let transfer=await legacy.evaluate(()=>({
  count:eval('invCount')[1],slot:eval('chests')['3,35,3'][0]
 }));
 assert.deepEqual(transfer,{count:7,slot:null});
 const ownedIndex=await legacy.evaluate(()=>{
  const items=eval('invCount');
  return Object.keys(items).map(Number).filter(id=>items[id]>0).indexOf(1);
 });
 assert.ok(ownedIndex>=0);
 await legacy.locator('#chestBody .chGrid').nth(1).locator('.it').nth(ownedIndex).click({button:'right'});
 transfer=await legacy.evaluate(()=>({
  count:eval('invCount')[1],slot:eval('chests')['3,35,3'][0]
 }));
 assert.deepEqual(transfer,{count:6,slot:[1,1]});
 await legacy.keyboard.press('e');
 await legacy.waitForFunction(()=>document.getElementById('chestUI').style.display==='none');

 // Test actual browser inventory clicks, armor/equipment state, craft slot return.
 const equipIds=await legacy.evaluate(()=>{
  const id=eval('I'),count=eval('invCount');
  give(id.shield,1);give(id.iron,1);
  return {shield:id.shield,iron:id.iron,
   shieldCount:count[id.shield],ironCount:count[id.iron]};
 });
 await legacy.keyboard.press('e');
 await legacy.waitForFunction(()=>document.getElementById('inv').style.display==='flex');
 await legacy.locator('#invTabs button').filter({hasText:'インベントリ'}).click();
 const slotIndex=async id=>legacy.evaluate(target=>{
  const owned=Object.keys(eval('invCount')).map(Number).filter(id=>eval('invCount')[id]>0);
  return owned.indexOf(target);
 },id);
 const shieldIndex=await slotIndex(equipIds.shield);
 assert.ok(shieldIndex>=0&&shieldIndex<27);
 await legacy.locator('#invBody .playerInvGrid .slot').nth(shieldIndex).click();
 assert.equal(await legacy.evaluate(()=>eval('equipped').shield),equipIds.shield);
 await legacy.locator('#invTabs button').filter({hasText:'インベントリ'}).click();
 assert.ok((await legacy.locator('#invBody .equipPanel').innerText()).includes('盾（Shiftで構える）：盾'));

 const ironIndex=await slotIndex(equipIds.iron);
 assert.ok(ironIndex>=0&&ironIndex<27);
 await legacy.locator('#invBody .playerInvGrid .slot').nth(ironIndex).click();
 assert.equal(await legacy.evaluate(id=>eval('invCount')[id],equipIds.iron),equipIds.ironCount-1);
 assert.deepEqual(await legacy.evaluate(()=>Array.from(eval('craftSlots'))),
  [equipIds.iron,null,null,null]);
 await legacy.locator('#invBody .craft2 .slot').first().click();
 assert.equal(await legacy.evaluate(id=>eval('invCount')[id],equipIds.iron),equipIds.ironCount);
 assert.deepEqual(await legacy.evaluate(()=>Array.from(eval('craftSlots'))),
  [null,null,null,null]);

 // Complete a real, single-ingredient recipe through the rendered output slot.
 const recipe=await legacy.evaluate(()=>{
  const ingredient=eval('I').redstone,output=eval('RED_DUST');
  give(ingredient,1);
  return {ingredient,output,inputCount:eval('invCount')[ingredient],
   outputCount:eval('invCount')[output]||0};
 });
 await legacy.locator('#invTabs button').filter({hasText:'インベントリ'}).click();
 const redstoneIndex=await slotIndex(recipe.ingredient);
 assert.ok(redstoneIndex>=0&&redstoneIndex<27);
 await legacy.locator('#invBody .playerInvGrid .slot').nth(redstoneIndex).click();
 assert.equal(await legacy.evaluate(id=>eval('invCount')[id],recipe.ingredient),recipe.inputCount-1);
 assert.deepEqual(await legacy.evaluate(()=>Array.from(eval('craftSlots'))),
  [recipe.ingredient,null,null,null]);
 assert.ok((await legacy.locator('#invBody .craftOut').innerText()).includes('レッドストーンダスト'));
 await legacy.locator('#invBody .craftOut .slot').click();
 assert.deepEqual(await legacy.evaluate(()=>Array.from(eval('craftSlots'))),
  [null,null,null,null]);
 assert.equal(await legacy.evaluate(id=>eval('invCount')[id],recipe.output),recipe.outputCount+1);

 await legacy.keyboard.press('e');
 await legacy.waitForFunction(()=>document.getElementById('inv').style.display==='none');

 // Browser-level held input: actual mouse down/up must arm and release repeat
 // timers even when the camera ray has no breakable block.
 await legacy.mouse.move(640,400);
 await legacy.mouse.down({button:'left'});
 await legacy.waitForFunction(()=>eval('leftBreakHeld')===true,{timeout:3000});
 await legacy.waitForTimeout(235);
 await legacy.mouse.up({button:'left'});
 await legacy.waitForFunction(()=>eval('leftBreakHeld')===false&&eval('leftBreakTimer')===0);
 await legacy.mouse.down({button:'right'});
 await legacy.waitForFunction(()=>eval('rightPlaceHeld')===true,{timeout:3000});
 await legacy.mouse.up({button:'right'});
 await legacy.waitForFunction(()=>eval('rightPlaceHeld')===false&&eval('rightPlaceTimer')===0);

 // Place a genuine Three.js mob on the player's unobstructed forward ray
 // and deliver an actual Chromium mouse click through the game's handler.
 await legacy.evaluate(()=>{
  const P0=eval('P');P0.x=40.5;P0.y=70;P0.z=40.5;P0.pitch=0;P0.yaw=0;
  eval('flying=true');
 });
 await legacy.waitForTimeout(130);
 const mobBefore=await legacy.evaluate(()=>{
  const o=eval('cam').position,dir=eval('rdir');
  const mobX=o.x+dir.x*2,mobY=o.y+dir.y*2-.65,mobZ=o.z+dir.z*2;
  addMob('cow',mobX,mobY,mobZ);
  const m=eval('mobs').at(-1);
  window.__combatTestMob=m;
  return {hp:m.hp,hit:!!pickMob()};
 });
 assert.equal(mobBefore.hit,true,'real camera ray must identify seeded mob');
 await legacy.mouse.click(640,400,{button:'left'});
 const mobAfter=await legacy.evaluate(()=>({
  before:window.__combatTestMob.hp,alive:eval('mobs').includes(window.__combatTestMob)
 }));
 assert.equal(mobAfter.alive,true);
 assert.equal(mobAfter.before,mobBefore.hp-5,'actual browser mouse click must deal unarmed melee damage');

 // Exercise the real world ray -> mousedown -> 180ms synthetic repeat path
 // with two adjacent blocks in the player's high-altitude line of sight.
 const placedBreakBlocks=await legacy.evaluate(()=>{
  if(eval('mobs').includes(window.__combatTestMob))rmMob(window.__combatTestMob);
  const o=eval('cam').position,d=new THREE.Vector3(0,0,-1).applyEuler(eval('cam').rotation);
  const cells=[2.3,3.3,4.3].map(t=>[
   Math.floor(o.x+d.x*t),Math.floor(o.y+d.y*t),Math.floor(o.z+d.z*t)
  ]).filter((v,i,all)=>i===0||v.some((n,k)=>n!==all[i-1][k]));
  if(cells.length<2)throw Error('camera cells are not distinct');
  for(const [x,y,z]of cells.slice(0,2))setB(x,y,z,3);
  window.__breakCells=cells.slice(0,2);
  return window.__breakCells;
 });
 await legacy.waitForFunction(()=>{
  const t=eval('target'),p=window.__breakCells[0];
  return !!t&&t.x===p[0]&&t.y===p[1]&&t.z===p[2];
 },{timeout:6000});
 await legacy.mouse.down({button:'left'});
 await legacy.waitForTimeout(700);
 const breakResult=await legacy.evaluate(()=>({
  cells:window.__breakCells.map(([x,y,z])=>[x,y,z,getB(x,y,z)]),
  target:eval('target'),
  held:eval('leftBreakHeld'),
  timer:eval('leftBreakTimer'),locked:eval('locked'),fallback:eval('fallback')
 }));
 await legacy.mouse.up({button:'left'});
 await legacy.waitForFunction(()=>eval('leftBreakHeld')===false&&eval('leftBreakTimer')===0);
 console.log('Repeated break debug:',JSON.stringify(breakResult));
 assert.ok(breakResult.cells.every(c=>c[3]===0),'both actual world blocks must be removed by held mouse');
 console.log('Held block break removed two camera-targeted blocks:',placedBreakBlocks);

 await legacy.evaluate(()=>save(false));
 const normalized=await legacy.evaluate(()=>JSON.parse(localStorage.getItem('minicraft_v2')));
 assert.equal(normalized.invCount[101],5);
 assert.deepEqual(normalized.ch['1,35,1'][0],[101,2]);
 assert.deepEqual(normalized.e['524800'],[8977,7]);
 assert.deepEqual(normalized.craftSlots,[null,null,null,null]);
 await legacy.reload({waitUntil:'load',timeout:60000});
 await legacy.waitForFunction(()=>eval('loaded')===true,{timeout:20000});
 assert.equal(await legacy.evaluate(()=>eval('invCount')[101]),5);
 assert.deepEqual(legacyErrors,[],'legacy browser save emitted JavaScript errors');
 await legacyContext.close();
 console.log('Chromium: WebGL, UI, saves, ZIP/PNG atlas, and synthetic legacy-schema hydration passed');
}finally{
 if(browser)await browser.close();
 webServer.kill();
}
