import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const loop=readFileSync('src/js/08-game-loop.js','utf8');
const settings=readFileSync('src/js/11-settings.js','utf8');
const html=readFileSync('index.html','utf8');

test('the initial game animation frame is not scheduled before settings initialize',()=>{
  assert.match(loop,/ren\\.render\\(scene,cam\\);requestAnimationFrame\\(loop\\)\\}/,'per-frame scheduling remains in the loop');
  assert.doesNotMatch(loop,/\\nrequestAnimationFrame\\(loop\\);\\s*$/,'no early start in game loop script');
  assert.match(settings,/applyCfg\\(\\);\\s*requestAnimationFrame\\(loop\\);\\s*$/,'start only after configuration hydration');
  assert.equal((loop+settings).match(/^requestAnimationFrame\\(loop\\);$/gm)?.length,1,'exactly one initial frame');
});

test('the final settings section still follows the game loop in classic-script load order',()=>{
  const scripts=[...html.matchAll(/<script src=\"\\.\\/(src\\/js\\/[^\"]+)\"/g)].map(x=>x[1]);
  assert.ok(scripts.indexOf('src/js/08-game-loop.js')<scripts.indexOf('src/js/11-settings.js'));
  assert.equal(scripts.at(-1),'src/js/11-settings.js');
});
