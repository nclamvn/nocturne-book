import * as T from '../vendor/three.core.js';

// A continuous cut-paper block, with filtered leaf seams in its node material.
export function createPaperStack(keep, side, gpuApi) {
  const uniforms = {
    uWidth: { value: 1.46 },
    uHeight: { value: 2.062 },
    uDepth: { value: 0.05 },
    uSheets: { value: 80 },
    uSide: { value: side },
    uFan: { value: 0.014 },
    uGutter: { value: 0.1 },
    uNight: { value: 0 },
    uLampPosition: { value: new T.Vector3() },
    uLampPower: { value: 1 },
  };
  const material = keep(gpuApi.stack(uniforms));
  const mesh = new T.Mesh(keep(new T.BoxGeometry(1, 1, 1, 40, 1, 192)), material);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, uniforms };
}
