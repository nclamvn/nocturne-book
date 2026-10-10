import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.core.js';
import { cameraLayout, lanternLayout } from '../src/camera.mjs';
function camera(options) {
  const l = cameraLayout(options),
    c = new T.PerspectiveCamera(l.fov, options.aspect, 0.1, 100);
  c.filmOffset = l.filmOffset ?? 0;
  c.updateProjectionMatrix();
  c.position.set(...l.position);
  c.lookAt(...l.target);
  c.updateMatrixWorld();
  return c;
}
test('both night angles make the far book edge narrower than the near edge', () => {
  for (const overhead of [false, true])
    for (const height of [1.68, 2.062, 3.4]) {
      const c = camera({ width: 1.46, height, aspect: 1440 / 797, night: true, overhead });
      const widthAt = (y) =>
        new T.Vector3(1.46, y, 0.12).project(c).x - new T.Vector3(-1.46, y, 0.12).project(c).x;
      const ratio = widthAt(height / 2) / widthAt(-height / 2);
      assert.ok(ratio < 0.92 && ratio > 0.6, `far/near ratio ${ratio}`);
    }
});
test('default perspective keeps the entire lantern inside landscape and portrait frames', () => {
  for (const aspect of [856 / 887, 1280 / 617, 1440 / 797, 1920 / 977])
    for (const height of [1.68, 2.062, 3.4])
      for (const overhead of [false, true]) {
        const c = camera({ width: 1.46, height, aspect, night: true, overhead });
        const {
          position: [x, y, z],
          scale: s,
        } = lanternLayout(1.46, height);
        for (const dx of [-0.29, 0.29])
          for (const dy of [-0.24, 0.24])
            for (const dz of [0, 1.6]) {
              const p = new T.Vector3(x + dx * s, y + dy * s, z + dz * s).project(c);
              assert.ok(
                Math.abs(p.x) <= 0.921 && Math.abs(p.y) <= 0.841,
                JSON.stringify({ aspect, height, overhead, p }),
              );
            }
      }
});

test('adaptive framing retains a book rotated upright or flipped in both render views', async () => {
  const { clearance } = await import('../src/object-pose.mjs');
  for (const night of [false, true])
    for (const angles of [
      [1.1, 0.4, 0.7],
      [-0.6, 0.8, 0.4],
      [Math.PI, 0, 0],
    ]) {
      const q = new T.Quaternion().setFromEuler(new T.Euler(...angles)),
        points = [];
      const depth = 0.144,
        lift = clearance(q, 1.46, 2.062, depth);
      for (const x of [-1.46, 1.46])
        for (const y of [-1.031, 1.031])
          for (const z of [-depth / 2, depth / 2 + 0.02]) {
            const p = new T.Vector3(x, y, z).applyQuaternion(q);
            p.z += 0.036 + depth / 2 + lift;
            points.push(p.toArray());
          }
      const c = camera({
        width: 1.46,
        height: 2.062,
        aspect: 1440 / 797,
        night,
        bookPoints: points,
      });
      for (const point of points) {
        const p = new T.Vector3(...point).project(c);
        assert.ok(
          Math.abs(p.x) < 0.94 && Math.abs(p.y) < 0.86,
          JSON.stringify({ night, angles, p }),
        );
      }
    }
});
