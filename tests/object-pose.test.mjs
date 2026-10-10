import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3, Euler } from '../vendor/three.core.js';
import { trackballPoint, trackballRotation, clearance, settleHeight } from '../src/object-pose.mjs';
test('trackball rotates in camera space and composes with the existing object pose', () => {
  const start = trackballPoint(400, 300, 400, 300, 200),
    end = trackballPoint(560, 250, 400, 300, 200);
  const camera = new Quaternion().setFromEuler(new Euler(0.7, 0.2, -0.15));
  const pose = new Quaternion().setFromEuler(new Euler(-0.2, 0.4, 0.1));
  const next = trackballRotation(start, end, camera, pose);
  const before = start.clone().applyQuaternion(camera),
    after = end.clone().applyQuaternion(camera);
  const delta = next.clone().multiply(pose.clone().invert());
  assert.ok(before.applyQuaternion(delta).distanceTo(after) < 1e-10);
  assert.ok(Math.abs(next.length() - 1) < 1e-10);
  assert.ok(next.angleTo(pose) > 0.5);
  assert.ok(trackballPoint(10000, -10000, 400, 300, 200).toArray().every(Number.isFinite));
});
test('all corners stay above the table when the book stands, flips or rotates diagonally', () => {
  const width = 1.46,
    height = 2.062,
    depth = 0.144;
  for (const angles of [
    [0, 0, 0],
    [Math.PI, 0, 0],
    [Math.PI / 2, 0, 0],
    [0.8, 1.2, -0.7],
    [-2, 2, 2],
  ]) {
    const q = new Quaternion().setFromEuler(new Euler(...angles));
    const lift = clearance(q, width, height, depth);
    for (const x of [-width, width])
      for (const y of [-height / 2, height / 2])
        for (const z of [-depth / 2, depth / 2 + 0.02]) {
          const corner = new Vector3(x, y, z).applyQuaternion(q);
          assert.ok(corner.z + 0.036 + depth / 2 + lift >= 0.036 - 1e-10);
        }
  }
});
test('released height settles monotonically without overshooting the table', () => {
  let h = 1.5;
  for (let i = 0; i < 300; i++) {
    const next = settleHeight(h, 1 / 60);
    assert.ok(next >= 0 && next <= h);
    h = next;
  }
  assert.equal(h, 0);
});
