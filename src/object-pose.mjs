import { Vector3, Quaternion } from '../vendor/three.core.js';
export function trackballPoint(x, y, centerX, centerY, radius) {
  const v = new Vector3((x - centerX) / radius, (centerY - y) / radius, 0),
    r2 = v.x * v.x + v.y * v.y;
  v.z = r2 <= 0.5 ? Math.sqrt(1 - r2) : 0.5 / Math.sqrt(r2);
  return v.normalize();
}
export function trackballRotation(start, end, cameraOrientation, initialOrientation) {
  const screen = new Quaternion().setFromUnitVectors(start, end);
  return cameraOrientation
    .clone()
    .multiply(screen)
    .multiply(cameraOrientation.clone().invert())
    .multiply(initialOrientation)
    .normalize();
}
// Keep a rotated book above the table. The pivot is the centre of its paper block.
export function clearance(orientation, width, height, depth) {
  let minZ = Infinity;
  for (const x of [-width, width])
    for (const y of [-height / 2, height / 2])
      for (const z of [-depth / 2, depth / 2 + 0.02]) {
        minZ = Math.min(minZ, new Vector3(x, y, z).applyQuaternion(orientation).z);
      }
  return Math.max(0, -minZ - depth / 2);
}
export function settleHeight(height, dt) {
  return height < 0.0001 ? 0 : height * Math.exp(-Math.min(dt, 0.05) * 10);
}
