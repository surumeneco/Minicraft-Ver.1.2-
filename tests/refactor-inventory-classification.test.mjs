import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

// Characterization oracle: preserve the current item/category contract across refactors.
function inventoryCatalog() {
  const src = readFileSync('src/js/09-inventory.js', 'utf8');
  const start = src.indexOf('const CIRCUIT=');
  const end = src.indexOf('function invIcon(id)', start);
  assert.ok(start >= 0 && end > start, 'inventory classification functions exist');
  const code = src.slice(start, end);
  const blocks = [
    'RED_DUST','RED_TORCH','REPEATER','LEVER','STONE_BUTTON','PRESSURE',
    'PISTON','STICKY_PISTON','OBSERVER','DISPENSER','COMPARATOR','DROPPER',
    'HOPPER','RED_LAMP','TARGET','CHEST','RAIL','POWERED_RAIL',
    'DETECTOR_RAIL','ACTIVATOR_RAIL'
  ];
  const ctx = Object.fromEntries(blocks.map((key, i) => [key, i + 10]));
  ctx.I = {
    redstone: 90, rail: 190, poweredRail: 191, detectorRail: 192,
    activatorRail: 193, minecart: 194, bucket: 195,
    waterBucket: 196, lavaBucket: 197
  };
  const names = {
    'レッドストーンブロック': 91, 'TNT': 92, '作業台': 93,
    'かまど': 94, '本棚': 95, 'スポンジ': 96
  };
  ctx.nmid = key => names[key];
  ctx.PL = [1, 10, 26, 202, 204, 204, null];
  ctx.ITEMS = {
    90: { type: 'material' }, 190: { type: 'material' },
    200: { type: 'food' }, 201: { type: 'weapon' },
    202: { type: 'armor' }, 203: { type: 'transport' },
    204: { type: 'block' }, 205: { type: 'tool' },
    206: { type: 'shield' }
  };
  return runInNewContext(code + `
    ({
      categories: Object.fromEntries(
        [1, 10, 25, 26, 27, 28, 29, 90, 93, 190, 194, 195, 200, 201, 202, 203, 204, 205, 206]
          .map(id => [id, itemCategory(id)])
      ),
      ids: [...allAvailableIds()],
      classify: itemCategory
    })
  `, ctx);
}

test('inventory item categories retain their current precedence', () => {
  const { categories } = inventoryCatalog();
  assert.deepEqual(JSON.parse(JSON.stringify(categories)), {
    1: 'building',
    10: 'circuit',
    25: 'func',
    26: 'transport',
    27: 'transport',
    28: 'transport',
    29: 'transport',
    90: 'circuit',
    93: 'func',
    190: 'transport',
    194: 'transport',
    195: 'func',
    200: 'food',
    201: 'combat',
    202: 'combat',
    203: 'transport',
    204: 'building',
    205: 'other',
    206: 'combat'
  });
});

test('available IDs retain ordering, deduplication, and rail-item exclusions', () => {
  const { ids } = inventoryCatalog();
  assert.deepEqual(Array.from(ids), [
    1, 10, 26, 202, 204, 90, 200, 201, 203, 205, 206
  ]);
});
