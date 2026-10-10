import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source = readFileSync('src/js/04-2-containers.js', 'utf8');

function element() {
  const node = {
    children: [], style: {}, className: '', title: '', textContent: '',
    appendChild(child) { this.children.push(child); return child; },
    querySelector() { return this; }
  };
  Object.defineProperty(node, 'innerHTML', {
    get() { return this.html ?? ''; },
    set(value) { this.html = value; this.children = []; }
  });
  return node;
}

function harness() {
  const chestUI = element();
  const chestBody = element();
  const messages = [], events = [];
  const ctx = {
    document: {
      getElementById: id => id === 'chestUI' ? chestUI : chestBody,
      createElement: element,
      pointerLockElement: null
    },
    chests: { '1,2,3': [[100, 62], [100, 63], null, null] },
    invCount: { 100: 5, 101: 2 },
    ITEMS: { 100: { name: 'Stone' }, 101: { name: 'Wood' } },
    NM: {}, NMS: { 40: 'Chest' },
    CONTB: new Map([[40, 4]]), getB: () => 40,
    inv: false, invEl: { style: {} }, cv: { requestPointerLock() {} },
    invIcon: id => `<i>${id}</i><u>999</u>`,
    give(id, count) { ctx.invCount[id] = (ctx.invCount[id] || 0) + count; events.push(['give', id, count]); },
    take(id, count) { if ((ctx.invCount[id] || 0) < count) return false; ctx.invCount[id] -= count; events.push(['take', id, count]); return true; },
    toast(message) { messages.push(message); },
    spawnDrop() {}, CHEST: 40, Math
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  vm.runInContext("chestKey='1,2,3'", ctx);
  return { ctx, chestBody, messages, events };
}

test('stack transfer fills existing stacks before empty slots, without changing item totals', () => {
  const { ctx, events } = harness();
  ctx.chestPut(100, true);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.chests['1,2,3'])), [[100,64],[100,64],[100,2],null]);
  assert.equal(ctx.invCount[100], 0);
  assert.deepEqual(events, [['take',100,5]]);
  ctx.chestGet(0, false);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.chests['1,2,3'][0])), [100,63]);
  assert.equal(ctx.invCount[100], 1);
  ctx.chestGet(1, true);
  assert.equal(ctx.chests['1,2,3'][1], null);
  assert.equal(ctx.invCount[100], 65);
  assert.deepEqual(events.slice(1), [['give',100,1],['give',100,64]]);
});

test('single-item transfer, full chest, and unavailable inventory retain behavior', () => {
  const { ctx, messages, events } = harness();
  ctx.chestPut(101, false);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.chests['1,2,3'][2])), [101,1]);
  assert.equal(ctx.invCount[101], 1);
  ctx.chests['1,2,3'] = [[100,64],[100,64],[101,64],[101,64]];
  ctx.chestPut(101, true);
  assert.deepEqual(messages, ['チェストがいっぱいです']);
  assert.equal(ctx.invCount[101], 1);
  const before = events.length;
  ctx.chestPut(777, true);
  ctx.chestGet(100, true);
  assert.equal(events.length, before);
});

test('chest grid keeps visual order and left/right mouse actions', () => {
  const { ctx, chestBody } = harness();
  ctx.chests['1,2,3'] = [[100,2],null];
  const calls = [];
  ctx.chestGet = (index, all) => calls.push(['get',index,all]);
  ctx.chestPut = (id, all) => calls.push(['put',id,all]);
  ctx.renderChest();
  assert.equal(chestBody.children.length,4);
  const [title1, grid1, title2, grid2] = chestBody.children;
  assert.equal(title1.textContent,'チェストの中身');
  assert.equal(title2.textContent,'持ち物（クリックでチェストへ）');
  assert.equal(grid1.className,'chGrid');
  assert.equal(grid1.children.length,2);
  assert.equal(grid1.children[0].title,'Stone');
  assert.equal(grid1.children[0].innerHTML,'<i>100</i><u>2</u>');
  assert.equal(grid1.children[1].innerHTML,'');
  assert.equal(grid2.className,'chGrid');
  assert.deepEqual(grid2.children.map(el=>el.title),['Stone','Wood']);
  assert.equal(grid2.children[0].innerHTML,'<i>100</i><u>5</u>');
  grid1.children[0].onclick();
  grid2.children[1].onclick();
  let prevented = 0;
  grid1.children[1].oncontextmenu({preventDefault(){prevented++}});
  grid2.children[0].oncontextmenu({preventDefault(){prevented++}});
  assert.equal(prevented,2);
  assert.deepEqual(calls,[['get',0,true],['put',101,true],['get',1,false],['put',100,false]]);
});
