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
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.getElementById('pauseMenu').style.display==='flex');
 await page.locator('#pauseMenu button').filter({hasText:'標準テクスチャに戻す'}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('minicraft_pack')),null);
 assert.equal(await page.evaluate(()=>eval('ac.toDataURL("image/png")')),original);

 await page.reload({waitUntil:'load',timeout:60000});
 await page.waitForFunction(()=>eval('fr')>=3,{timeout:20000});
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('minicraft_v2')));
 assert.deepEqual(restored.p,beforeSave.p);
 assert.deepEqual(restored.craftSlots,beforeSave.craftSlots);
 assert.deepEqual(errors,[],'unexpected browser runtime exceptions');
 console.log('Chromium: WebGL, UI, save/reload, real DEFLATE PNG atlas apply/reset passed');
}finally{
 if(browser)await browser.close();
 webServer.kill();
}
