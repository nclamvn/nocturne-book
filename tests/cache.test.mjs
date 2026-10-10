import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PageCache } from '../src/cache.mjs';
const source = { render: async (index, width) => ({ width, height: width, index }) };
const tex = (canvas) => ({
  index: canvas.index,
  disposed: false,
  dispose() {
    this.disposed = true;
  },
});
test('resident memory stays bounded after 320 distinct pages; material references are pinned', async () => {
  const cache = new PageCache(source, tex, { maxEntries: 6, maxBytes: 100000 });
  for (let i = 0; i < 320; i++) {
    cache.pin([cache.key(i, 10)]);
    const e = await cache.get(i, 10);
    assert.equal(e.texture.disposed, false);
    assert.equal(e.canvas.width, 10);
    assert.ok(cache.entries.size <= 6);
    assert.ok(cache.bytes <= 100000);
  }
  assert.equal(cache.renders, 320);
  assert.equal(cache.entries.size, 6);
  const entries = [...cache.entries.values()];
  cache.dispose();
  assert.ok(entries.every((e) => e.texture.disposed && e.canvas.width === 0));
  assert.equal(cache.bytes, 0);
});
test('identical concurrent requests render only once', async () => {
  let resolve;
  let calls = 0;
  const cache = new PageCache(
    {
      render: () => {
        calls++;
        return new Promise((r) => {
          resolve = r;
        });
      },
    },
    tex,
  );
  cache.pin(['0:10']);
  const a = cache.get(0, 10),
    b = cache.get(0, 10);
  resolve({ width: 10, height: 10, index: 0 });
  assert.equal(await a, await b);
  assert.equal(calls, 1);
  cache.dispose();
});
test('replacing a document releases late render results without creating a GPU texture', async () => {
  let resolve,
    made = 0;
  const cache = new PageCache({ render: () => new Promise((r) => (resolve = r)) }, (c) => {
    made++;
    return tex(c);
  });
  const request = cache.get(1, 10);
  cache.dispose();
  const canvas = { width: 10, height: 20 };
  resolve(canvas);
  await assert.rejects(request, /Document replaced/);
  assert.equal(made, 0);
  assert.equal(canvas.width, 0);
  assert.equal(cache.entries.size, 0);
});
test('texture byte budget evicts old unpinned pages', async () => {
  const cache = new PageCache(source, tex, { maxEntries: 100, maxBytes: 2500 });
  cache.pin(['0:10']);
  const a = await cache.get(0, 10);
  cache.pin(['1:20']);
  await cache.get(1, 20);
  assert.equal(a.texture.disposed, true);
  assert.ok(cache.bytes <= 2500);
  const b = await cache.get(1, 20);
  cache.pin(['2:20']);
  const c = await cache.get(2, 20);
  assert.equal(b.texture.disposed, true);
  assert.equal(c.texture.disposed, false);
  assert.ok(cache.bytes <= 2500);
  cache.dispose();
});
