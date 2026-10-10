// Z is up; the reader is on the negative-Y side of the desk.
export function lanternLayout(width, height) {
  return {
    position: [width + height * 0.2, -height * 0.42, 0.025],
    scale: Math.max(0.6, Math.min(0.92, height * 0.35)),
  };
}
export function cameraLayout({
  width,
  height,
  aspect,
  zoom = 1,
  night = false,
  overhead = false,
  bookPoints = [],
}) {
  const fov = night ? 32 : 40,
    half = Math.tan((fov * Math.PI) / 360);
  if (!night) {
    const dy = overhead ? -0.65 : -0.035,
      dz = overhead ? 0.85 : 1,
      norm = Math.hypot(dy, dz);
    let d = Math.max(height / (2 * half * 0.82), (width * 2 + 0.1) / (2 * half * aspect * 0.84));
    if (bookPoints.length) {
      let distance = d * norm;
      for (const [x, y, z] of bookPoints) {
        const toward = ((y - 0.035) * dy) / norm + (z * dz) / norm,
          screenY = ((y - 0.035) * dz) / norm - (z * dy) / norm;
        distance = Math.max(
          distance,
          toward + Math.max(Math.abs(x) / (half * aspect * 0.9), Math.abs(screenY) / (half * 0.84)),
        );
      }
      d = distance / norm;
    }
    d /= zoom;
    return { fov, target: [0, 0.035, 0], position: [0, d * dy, d * dz] };
  }
  const tilt = overhead ? 1.1 : 0.55,
    norm = Math.hypot(tilt, 1),
    s = tilt / norm,
    c = 1 / norm;
  const lamp = lanternLayout(width, height),
    [lx, ly, lz] = lamp.position,
    scale = lamp.scale;
  const compositionX = (lx + 0.29 * scale - width) / 2;
  const opticalX = lx * 0.72,
    target = [compositionX, -0.04, 0.13];
  // Fit the full book AND upright lantern, including the near corners.
  const boxes = [
    [-width - 0.025, width + 0.025, -height / 2 - 0.025, height / 2 + 0.025, 0.025, 0.28],
    [
      lx - 0.29 * scale,
      lx + 0.29 * scale,
      ly - 0.24 * scale,
      ly + 0.24 * scale,
      lz,
      lz + 1.6 * scale,
    ],
  ];
  const points = bookPoints.slice();
  for (const [x0, x1, y0, y1, z0, z1] of boxes)
    for (const x of [x0, x1])
      for (const y of [y0, y1]) for (const z of [z0, z1]) points.push([x, y, z]);
  let distance = 0;
  for (const [x, y, z] of points) {
    const rx = x - target[0],
      ry = y - target[1],
      rz = z - target[2];
    const towardEye = -s * ry + c * rz,
      screenY = c * ry + s * rz;
    distance = Math.max(
      distance,
      towardEye +
        Math.max(Math.abs(rx) / (half * aspect * 0.92), Math.abs(screenY) / (half * 0.84)),
    );
  }
  // Shift the lens rather than tilting the prop: the lantern stays close to the
  // vertical vanishing plane while the book retains genuine perspective depth.
  for (let iteration = 0; iteration < 12; iteration++) {
    let overflow = 1;
    for (const [x, y, z] of points) {
      const ry = y - target[1],
        rz = z - target[2],
        depth = distance - (-s * ry + c * rz);
      const px = ((x - opticalX) / depth + (opticalX - compositionX) / distance) / (half * aspect);
      const py = (c * ry + s * rz) / (depth * half);
      overflow = Math.max(overflow, Math.abs(px) / 0.92, Math.abs(py) / 0.84);
    }
    if (overflow <= 1.00001) break;
    distance *= overflow * 1.002;
  }
  distance /= zoom;
  const filmWidth = 35 * Math.min(aspect, 1);
  return {
    fov,
    filmOffset: ((compositionX - opticalX) * filmWidth) / distance,
    target: [opticalX, target[1], target[2]],
    position: [opticalX, target[1] - distance * s, target[2] + distance * c],
  };
}
