import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cursorForPage, lastSpreadCursor, spreadRange } from '../src/spreads.mjs';
test('every requested page remains visible, including the even last page', () => {
  for (const count of [1, 2, 3, 320, 321])
    for (let n = 1; n <= count; n++) {
      const cursor = cursorForPage(n, count),
        range = spreadRange(cursor, count);
      assert.ok(cursor <= lastSpreadCursor(count));
      assert.ok(range.first <= n && range.last >= n);
    }
  assert.equal(cursorForPage(320, 320), 320);
  assert.deepEqual(spreadRange(160, 320), { first: 160, last: 161 });
});
test('odd documents stop at their final printed spread', () => {
  assert.equal(lastSpreadCursor(321), 320);
  assert.equal(lastSpreadCursor(1), 0);
  assert.throws(() => cursorForPage(322, 321), RangeError);
});
