import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = readFileSync('src/js/09-inventory.js', 'utf8');
const start = source.indexOf('function find2x2Recipe(){');
const end = source.indexOf('// 2x2クラフトへアイテムを投入', start);
assert.ok(start >= 0 && end > start, '2x2 recipe matcher exists');
const matcher = source.slice(start, end);

function match(slots, recipes) {
  const result = runInNewContext(matcher + '\nfind2x2Recipe()', {
    craftSlots: slots, recipes
  });
  return result === null ? null : JSON.parse(JSON.stringify(result));
}

test('2x2 crafting ignores slot order but respects quantities', () => {
  const recipes = [
    [101, 1, [1, 2, 2, 1]],
    [102, 1, [1, 1]],
    [103, 1, [2, 2]]
  ];
  assert.deepEqual(match([1, 2, null, 1], recipes), [101, [[1, 2], [2, 1]]]);
  assert.deepEqual(match([2, null, 1, 1], recipes), [101, [[1, 2], [2, 1]]]);
  assert.equal(match([1, 1, 1, null], recipes), null);
  assert.equal(match([null, null, null, null], recipes), null);
});

test('2x2 crafting preserves recipe priority and returned ingredient structure', () => {
  const recipes = [
    [7, 1, [5, 1]],
    [8, 1, [5, 1]],
    [9, 1, [5, 1, 6, 1]]
  ];
  assert.deepEqual(match([null, 5, null, null], recipes), [7, [[5, 1]]]);
  assert.deepEqual(match([5, 6, null, null], recipes), [9, [[5, 1], [6, 1]]]);
  assert.equal(match([5, 5, null, null], recipes), null);
});
