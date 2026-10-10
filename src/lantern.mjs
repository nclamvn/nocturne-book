import * as T from '../vendor/three.core.js';

// Original geometry, guided by the user's old oil-lantern reference.
export function createLantern(keep, gpuApi) {
  const group = new T.Group();
  const metalMap = document.createElement('canvas');
  metalMap.width = metalMap.height = 256;
  const g = metalMap.getContext('2d');
  const pixels = g.createImageData(256, 256);
  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const noise = (x, y) => {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    let u = x - ix,
      v = y - iy;
    u = u * u * (3 - 2 * u);
    v = v * v * (3 - 2 * v);
    return (
      (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) +
      (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
    );
  };
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      const p =
        18 * (noise(x / 32, y / 32) - 0.5) +
        8 * (noise(x / 9, y / 9) - 0.5) +
        4 * (hash(x, y) - 0.5);
      pixels.data.set([104 + p, 77 + p * 0.8, 46 + p * 0.6, 255], i);
    }
  g.putImageData(pixels, 0, 0);
  const patina = keep(new T.CanvasTexture(metalMap));
  patina.colorSpace = T.SRGBColorSpace;
  const bronze = keep(
    new T.MeshStandardMaterial({
      map: patina,
      metalness: 0.58,
      roughness: 0.65,
      bumpMap: patina,
      bumpScale: 0.0006,
      envMapIntensity: 0.24,
    }),
  );
  const dark = keep(
    new T.MeshStandardMaterial({
      color: '#302b23',
      metalness: 0.58,
      roughness: 0.77,
      envMapIntensity: 0.25,
    }),
  );
  const brass = keep(
    new T.MeshStandardMaterial({
      color: '#9c7845',
      metalness: 0.72,
      roughness: 0.45,
      envMapIntensity: 0.32,
    }),
  );
  const black = keep(new T.MeshStandardMaterial({ color: '#14130e', roughness: 0.94 }));
  const soot = keep(new T.MeshStandardMaterial({ color: '#030201', roughness: 1, metalness: 0 }));
  const glassUniforms = { uSource: { value: new T.Vector3() } };
  const glass = keep(gpuApi.glass(glassUniforms));
  function add(geometry, material = bronze) {
    const mesh = new T.Mesh(keep(geometry), material);
    mesh.castShadow = material !== glass;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function lathe(points, material = bronze) {
    return add(
      new T.LatheGeometry(
        points.map(([r, y]) => new T.Vector2(r, y)),
        64,
      ),
      material,
    );
  }
  function tube(points, r = 0.012, material = dark) {
    return add(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        32,
        r,
        8,
        false,
      ),
      material,
    );
  }
  lathe([
    [0, 0],
    [0.22, 0],
    [0.275, 0.035],
    [0.283, 0.075],
    [0.265, 0.11],
    [0.24, 0.12],
    [0.225, 0.16],
    [0.19, 0.21],
    [0.155, 0.255],
    [0.145, 0.3],
    [0.14, 0.33],
    [0, 0.33],
  ]);
  for (const y of [0.07, 0.12, 0.24]) {
    const ring = add(new T.TorusGeometry(y === 0.24 ? 0.18 : 0.266, 0.007, 8, 64), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
  }
  lathe(
    [
      [0, 0.33],
      [0.105, 0.33],
      [0.125, 0.36],
      [0.13, 0.385],
      [0.12, 0.4],
      [0.095, 0.41],
      [0.085, 0.445],
      [0, 0.445],
    ],
    dark,
  );
  lathe(
    [
      [0, 0.443],
      [0.086, 0.443],
      [0.088, 0.457],
      [0.035, 0.463],
      [0, 0.463],
    ],
    soot,
  );
  lathe(
    [
      [0.1, 0.44],
      [0.155, 0.46],
      [0.175, 0.52],
      [0.186, 0.65],
      [0.175, 0.82],
      [0.142, 0.97],
      [0.108, 1.015],
    ],
    glass,
  );
  lathe([
    [0, 0.99],
    [0.115, 0.99],
    [0.15, 1.01],
    [0.16, 1.055],
    [0.135, 1.085],
    [0.13, 1.19],
    [0.12, 1.215],
    [0, 1.215],
  ]);
  lathe([
    [0, 1.21],
    [0.115, 1.21],
    [0.17, 1.24],
    [0.21, 1.28],
    [0.205, 1.3],
    [0.14, 1.335],
    [0.11, 1.35],
    [0, 1.35],
  ]);
  lathe(
    [
      [0.115, 1.11],
      [0.14, 1.11],
      [0.16, 1.14],
      [0.155, 1.155],
      [0.132, 1.165],
    ],
    brass,
  );
  // Vent apertures are actual dark inserts, not symbols painted on the silhouette.
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const hole = add(new T.SphereGeometry(0.017, 12, 8), black);
    hole.scale.set(1, 1, 0.18);
    hole.position.set(Math.sin(a) * 0.132, 1.12, Math.cos(a) * 0.132);
    hole.rotation.y = a;
  }
  for (const side of [-1, 1]) {
    tube(
      [
        [side * 0.17, 0.2, 0],
        [side * 0.255, 0.3, 0],
        [side * 0.272, 0.58, 0],
        [side * 0.25, 0.94, 0],
        [side * 0.19, 1.12, 0],
        [side * 0.11, 1.19, 0],
      ],
      0.036,
    );
    tube(
      [
        [side * 0.18, 0.24, -0.017],
        [side * 0.251, 0.38, -0.017],
        [side * 0.25, 0.85, -0.017],
        [side * 0.19, 1.09, -0.017],
      ],
      0.009,
      brass,
    );
    const rivet = add(new T.SphereGeometry(0.021, 12, 8), brass);
    rivet.position.set(side * 0.19, 1.09, 0.042);
  }
  for (const z of [-1, 1]) {
    tube(
      [
        [-0.155, 0.48, z * 0.077],
        [-0.17, 0.61, z * 0.08],
        [0, 0.78, z * 0.183],
        [0.135, 0.93, z * 0.082],
      ],
      0.008,
      brass,
    );
    tube(
      [
        [0.155, 0.48, z * 0.077],
        [0.17, 0.61, z * 0.08],
        [0, 0.78, z * 0.183],
        [-0.135, 0.93, z * 0.082],
      ],
      0.008,
      brass,
    );
  }
  tube(
    [
      [-0.185, 1.12, 0],
      [-0.2, 1.36, 0],
      [-0.115, 1.52, 0],
      [0, 1.565, 0],
      [0.115, 1.52, 0],
      [0.2, 1.36, 0],
      [0.185, 1.12, 0],
    ],
    0.013,
    brass,
  );
  const cap = add(new T.CylinderGeometry(0.038, 0.045, 0.026, 24), brass);
  cap.rotation.x = Math.PI / 2;
  cap.position.set(0.12, 0.27, 0.145);
  const wick = add(new T.CylinderGeometry(0.014, 0.014, 0.07, 16), black);
  wick.position.y = 0.47;
  // Flame is camera-facing inside the chimney; its base never leaves the wick.
  // Straight alpha avoids the old additive halo washing the burner into a white bowl.
  const flameUniforms = { uTime: { value: 0 }, uStill: { value: 0 }, uBrightness: { value: 1 } };
  const flameMaterial = keep(gpuApi.flame(flameUniforms));
  const flameGroup = new T.Group();
  group.add(flameGroup);
  flameGroup.position.y = 0.49;
  const flame = new T.Mesh(keep(new T.PlaneGeometry(0.15, 0.42, 4, 40)), flameMaterial);
  flame.position.y = 0.21;
  flame.renderOrder = 2;
  flameGroup.add(flame);
  // A small restrained glow sits around the flame, not around the entire burner.
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = haloCanvas.height = 128;
  const hg = haloCanvas.getContext('2d'),
    gradient = hg.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,166,30,.24)');
  gradient.addColorStop(0.2, 'rgba(255,105,15,.10)');
  gradient.addColorStop(1, 'rgba(255,100,0,0)');
  hg.fillStyle = gradient;
  hg.fillRect(0, 0, 128, 128);
  const haloTexture = keep(new T.CanvasTexture(haloCanvas));
  haloTexture.colorSpace = T.SRGBColorSpace;
  const haloMaterial = keep(
    new T.SpriteMaterial({
      map: haloTexture,
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      opacity: 0.52,
      toneMapped: false,
    }),
  );
  const halo = new T.Sprite(haloMaterial);
  halo.position.y = 0.71;
  halo.scale.set(0.36, 0.48, 1);
  group.add(halo);
  // The scene uses Z as up, while the model is built upright along Y.
  group.rotation.x = Math.PI / 2;
  const lights = [0.25, 0.5, 0.25].map((weight) => {
    const light = new T.PointLight('#ffb34c', 0.8 * weight, 8, 2);
    light.shadow.mapSize.set(768, 768);
    light.shadow.radius = 48;
    light.shadow.intensity = 0.95;
    light.shadow.bias = -0.00008;
    light.shadow.normalBias = 0.0007;
    light.shadow.camera.near = 0.015;
    light.shadow.camera.far = 8;
    return light;
  });
  const light = lights[1],
    center = new T.Vector3(),
    localEye = new T.Vector3();
  function update(time, still = false, cameraPosition, brightness = 1) {
    flameUniforms.uBrightness.value = brightness;
    flameUniforms.uTime.value = time;
    flameUniforms.uStill.value = still ? 1 : 0;
    const flicker = still
      ? 1
      : 1 +
        0.055 * Math.sin(time * 4.1) +
        0.03 * Math.sin(time * 9.7 + 0.7) +
        0.012 * Math.sin(time * 13.3);
    group.updateMatrixWorld(true);
    for (let i = 0; i < 3; i++) {
      center.set(
        still ? 0 : 0.012 * Math.sin(time * 3.7),
        0.63 + i * 0.1 + (still ? 0 : 0.012 * Math.sin(time * 4.1)),
        still ? 0 : 0.005 * Math.sin(time * 6.7),
      );
      lights[i].position.copy(center).applyMatrix4(group.matrixWorld);
      lights[i].intensity = 0.8 * (i === 1 ? 0.5 : 0.25) * flicker * brightness;
    }
    if (cameraPosition) {
      localEye.copy(cameraPosition);
      group.worldToLocal(localEye);
      flameGroup.rotation.y = Math.atan2(localEye.x, localEye.z);
    }
    glassUniforms.uSource.value.copy(light.position);
    haloMaterial.opacity = 0.52 * flicker * brightness;
    return flicker * brightness;
  }
  return { group, light, lights, update };
}
