import test from 'node:test';
import assert from 'node:assert/strict';
import { ReaderState, documentId } from '../src/reader-state.mjs';
import { releaseDecision, turnProgress } from '../src/interaction.mjs';
function storage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
}
test('reading position and bookmarks survive a new session and stay document-specific', () => {
  const s = storage(),
    first = new ReaderState(s);
  first.write('a', { cursor: 160, open: true, bookmarks: [2, 160] });
  assert.deepEqual(new ReaderState(s).read('a', 320), {
    cursor: 160,
    open: true,
    bookmarks: [2, 160],
  });
  assert.deepEqual(first.read('b', 24), { cursor: 0, open: false, bookmarks: [] });
});
test('corrupt or obsolete saved data cannot create invalid page positions', () => {
  const s = storage(),
    state = new ReaderState(s);
  s.setItem('book-state:a', '{');
  assert.equal(state.read('a', 24).cursor, 0);
  state.write('a', { cursor: 999, open: 'yes', bookmarks: [-1, 0, 1, 2, 2, 50, '3'] });
  assert.deepEqual(state.read('a', 24), { cursor: 24, open: false, bookmarks: [1, 2] });
  state.write('a', { cursor: 11, open: true, bookmarks: {} });
  assert.equal(state.read('a', 24).cursor, 10);
  s.setItem('book-pref:night', '[]');
  assert.equal(state.preference('night', true), true);
});
test('blocked browser storage leaves the reader usable', () => {
  const state = new ReaderState({
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('quota');
    },
  });
  assert.equal(state.write('a', {}), false);
  assert.equal(state.preference('night', true), true);
  assert.equal(state.read('a', 320).cursor, 0);
});
test('document identity follows file contents, independently of its filename', async () => {
  const a = await documentId(new Uint8Array([1, 2, 3]));
  assert.equal(a, await documentId(new Uint8Array([1, 2, 3])));
  assert.notEqual(a, await documentId(new Uint8Array([1, 2, 4])));
});
test('release distinguishes a deliberate flick, a short pull, a stale fling and cancellation', () => {
  const p = { start: 0, direction: 1, progress: 0.12, moved: true, velocity: 2, lastMoveTime: 100 };
  assert.equal(releaseDecision(p, 110).commit, true);
  assert.equal(releaseDecision({ ...p, velocity: 0 }, 110).commit, false);
  assert.equal(releaseDecision(p, 500).commit, false);
  assert.equal(releaseDecision({ ...p, cancelled: true }, 110).commit, false);
  assert.equal(
    releaseDecision({ ...p, start: 1, direction: -1, progress: 0.9, velocity: -2 }, 110).target,
    0,
  );
});
test('inertial landing reaches exact endpoints monotonically without overshooting', () => {
  for (const [a, b] of [
    [0, 1],
    [0.45, 1],
    [1, 0],
    [0.7, 0],
  ])
    for (const velocity of [-4, 0, 4]) {
      let previous = a;
      assert.equal(turnProgress(a, b, 0, velocity, 500), a);
      for (let i = 1; i <= 100; i++) {
        const p = turnProgress(a, b, i / 100, velocity, 500);
        assert.ok(p >= Math.min(a, b) - 1e-9 && p <= Math.max(a, b) + 1e-9);
        assert.ok((p - previous) * Math.sign(b - a) >= -1e-9);
        previous = p;
      }
      assert.equal(previous, b);
    }
});
