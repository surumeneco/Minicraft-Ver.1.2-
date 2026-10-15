import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assessChangeSet} from '../scripts/refactor-change-evidence.mjs';

test('source changes require both independent tests and scope documentation',()=>{
 const r=assessChangeSet(['src/js/06-circuits.js','docs/refactor-roadmap.md'],'refactor: circuit');
 assert.equal(r.errors.length,1);
 assert.match(r.errors[0],/regression test/);
});

test('source changes without documentation cannot pass on green tests alone',()=>{
 const r=assessChangeSet(['src/js/04-1-input.js','tests/refactor-input.test.mjs'],'refactor: input');
 assert.equal(r.errors.length,1);
 assert.match(r.errors[0],/documentation/);
});

test('refactor source with unchanged-oracle tests and docs requires base-suite check',()=>{
 const r=assessChangeSet([
  'src/js/06-circuits.js','tests/refactor-circuit-consumer-integration.test.mjs','docs/refactor-roadmap.md'
 ],'refactor: isolate consumers');
 assert.deepEqual(r.errors,[]);
 assert.equal(r.requireBaseline,true);
});

test('bug fixes require test and documentation evidence but not green pre-change baseline',()=>{
 const r=assessChangeSet([
  'src/js/08-game-loop.js','tests/issue-24-browser-loop-start.test.mjs','docs/refactor-roadmap.md'
 ],'fix: correct startup');
 assert.deepEqual(r.errors,[]);
 assert.equal(r.requireBaseline,false);
});

test('test-only and docs-only PRs bypass source-change gate',()=>{
 for(const path of ['tests/browser/smoke.mjs','docs/refactor-roadmap.md']){
  const r=assessChangeSet([path],'docs: update');
  assert.deepEqual(r.errors,[]);
  assert.equal(r.requireBaseline,false);
 }
});

test('duplicate file paths cannot manufacture multiple scope evidences',()=>{
 const r=assessChangeSet(['src/js/03-world.js','src/js/03-world.js','tests/refactor-world.test.mjs','docs/refactor-roadmap.md'],'refactor: terrain');
 assert.equal(r.sources.length,1);
 assert.deepEqual(r.errors,[]);
});
