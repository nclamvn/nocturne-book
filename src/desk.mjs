import * as T from '../vendor/three.core.js';
export function createDesk(keep, wood, gpuApi) {
  const uniforms = { uLampPosition: { value: new T.Vector3() }, uLampPower: { value: 1 } };
  const material = keep(gpuApi.desk(wood, uniforms));
  const mesh = new T.Mesh(keep(new T.PlaneGeometry(30, 30)), material);
  mesh.position.z = 0.014;
  mesh.receiveShadow = true;
  return { mesh, uniforms };
}
