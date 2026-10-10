import { WebGPURenderer } from '../vendor/three.webgpu.js';
import { createGPUApi } from './gpu-materials.mjs';
export async function createRenderer({ forceWebGL = false } = {}) {
  const renderer = new WebGPURenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    forceWebGL,
  });
  await renderer.init();
  return {
    renderer,
    gpuApi: createGPUApi(),
    backend: renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2',
  };
}
