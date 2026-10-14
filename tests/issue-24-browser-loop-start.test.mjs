import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const loop=readFileSync('src/js/08-game-loop.js','utf8');
const settings=readFileSync('src/js/11-settings.js','utf8');
const html=readFileSync('index.html','utf8');

test('the initial game animation frame is scheduled only after settings initialize',()=>{
  assert.ok(loop.includes('ren.render(scene,cam);requestAnimationFrame(loop)}'),'per-frame scheduling remains');
  assert.notEqual(loop.trimEnd().split('\n').at(-1),'requestAnimationFrame(loop);','no early frame start');
  assert.ok(settings.trimEnd().endsWith('applyCfg();\nrequestAnimationFrame(loop);'),'start after settings');
  assert.equal((loop+'\n'+settings).split('\n').filter(x=>x==='requestAnimationFrame(loop);').length,1,'one initial frame');
});

test('the final settings section follows the game loop in classic-script load order',()=>{
  const loopPos=html.indexOf('./src/js/08-game-loop.js');
  const settingsPos=html.indexOf('./src/js/11-settings.js');
  assert.ok(loopPos>=0&&settingsPos>loopPos);
  assert.ok(html.includes('<script src="./src/js/11-settings.js"></script></body></html>'));
});
