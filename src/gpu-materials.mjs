import * as G from '../vendor/three.webgpu.js';
const N = G.TSL,
  pi = Math.PI;
function nodes(u) {
  for (const [key, entry] of Object.entries(u))
    u[key] = entry.value?.isTexture ? N.texture(entry.value) : N.uniform(entry.value);
  return u;
}
function sheet(v, u) {
  const s = v.x.mul(u.uWidth),
    wave = u.uProgress.mul(pi).sin(),
    row = v.y.sub(0.5);
  const base = u.uProgress.mul(pi).sub(wave.mul(N.float(0.62).sub(u.uCorner.mul(row).mul(0.42))));
  const curl = wave.mul(N.float(1.72).add(u.uCorner.mul(row).mul(2.15))).div(u.uWidth);
  const straight = curl.abs().lessThan(0.001),
    safe = straight.select(N.float(0.001), curl),
    angle = base.add(curl.mul(s));
  const x = straight.select(s.mul(base.cos()), angle.sin().sub(base.sin()).div(safe));
  const z = straight.select(s.mul(base.sin()), base.cos().sub(angle.cos()).div(safe));
  const support = N.mix(u.uBase, u.uLanding, u.uProgress),
    hinge = N.float(1).sub(N.smoothstep(0, 0.26, v.x));
  const lift = N.mix(N.mix(support, u.uGutter, hinge), u.uGutter, wave);
  const rest = v.x
    .mul(pi)
    .sin()
    .mul(0.018)
    .mul(N.float(1).sub(wave.mul(0.7)));
  const twist = u.uCorner.mul(wave).mul(v.x.mul(pi).sin()).mul(0.1).mul(u.uHeight);
  const diagonal = u.uCorner.mul(wave).mul(v.x.pow(2)).mul(row).mul(0.15).mul(u.uHeight);
  return N.vec3(u.uSide.mul(x), row.mul(u.uHeight).add(twist), z.add(lift).add(rest).add(diagonal));
}
function block(p, u) {
  const x = p.x.add(0.5),
    layer = p.z.add(0.5),
    leaf = layer.mul(u.uSheets);
  const irregular = leaf.mul(2.39996).sin().mul(0.00035).add(leaf.mul(0.743).sin().mul(0.00025));
  const lip = u.uFan.mul(N.float(1).sub(layer)).add(irregular);
  const swell = x
    .mul(pi)
    .sin()
    .mul(0.018)
    .mul(N.float(0.35).add(layer.mul(0.65)));
  const bend = u.uGutter
    .sub(N.float(0.036).add(u.uDepth))
    .mul(N.float(1).sub(N.smoothstep(0, 0.26, x)));
  return N.vec3(
    u.uSide.mul(x).mul(u.uWidth.add(lip)),
    p.y.mul(u.uHeight.add(lip.mul(1.1))),
    N.float(0.036).add(layer.mul(u.uDepth)).add(swell).add(bend),
  );
}
export function createGPUApi() {
  const api = { lights: [], key: null, PMREMGenerator: G.PMREMGenerator };
  api.bindLights = (lights, key) => {
    api.lights = lights;
    api.key = key;
    api.lampShadows = lights.map((light) => N.pointShadow(light));
    api.keyShadow = N.shadow(key);
  };
  api.visibility = () =>
    api.lampShadows[0].r
      .mul(0.25)
      .add(api.lampShadows[1].r.mul(0.5))
      .add(api.lampShadows[2].r.mul(0.25));
  api.page = (u, blank) => {
    Object.assign(u, {
      uFrontMap: { value: blank },
      uPaperGrain: { value: blank },
      uNight: { value: 0 },
      uLampPosition: { value: new G.Vector3() },
      uLampPower: { value: 1 },
    });
    nodes(u);
    const m = new G.MeshBasicNodeMaterial({ side: G.DoubleSide, toneMapped: false });
    m.uniforms = u;
    m.positionNode = N.Fn(() => sheet(N.uv(), u))();
    m.castShadowPositionNode = m.positionNode;
    m.fragmentNode = N.Fn(() => {
      const v = N.uv(),
        world = N.positionWorld;
      const front = u.uFrontMap.sample(v).rgb,
        back = u.uBackMap.sample(N.vec2(N.float(1).sub(v.x), v.y)).rgb;
      const printed = N.frontFacing.select(front, back),
        other = N.frontFacing.select(back, front);
      const n = N.cross(N.dFdx(world), N.dFdy(world)).normalize(),
        view = N.cameraPosition.sub(world).normalize();
      const pigment = printed.dot(N.vec3(0.2126, 0.7152, 0.0722));
      const paper = N.mix(printed, other, N.smoothstep(0.45, 0.95, pigment).mul(0.015));
      const gutter = N.float(1).sub(v.x.mul(-35).exp().mul(0.11));
      const grain = u.uPaperGrain.sample(v.mul(N.vec2(7, 9.6))).r;
      const light = N.vec3(-0.3, 0.55, 1).normalize(),
        illum = N.float(0.55).add(n.dot(light).max(0).mul(0.45));
      const delta = u.uLampPosition.sub(world),
        diff = n.dot(delta.normalize()).max(0),
        falloff = N.float(1).div(N.float(1).add(delta.dot(delta).mul(0.6)));
      const night = N.vec3(0.64, 0.65, 0.63).add(
        N.vec3(1, 0.69, 0.32)
          .mul(diff)
          .mul(falloff)
          .mul(1.18)
          .mul(u.uLampPower)
          .mul(api.visibility()),
      );
      const dayShadow = N.mix(0.74, 1, api.keyShadow.r);
      const lit = N.mix(N.vec3(illum.mul(dayShadow)), night, u.uNight);
      const fresnel = N.float(1).sub(n.dot(view).abs()).pow(3);
      const gloss = n.dot(light.add(view).normalize()).max(0).pow(55);
      const color = paper
        .mul(lit)
        .mul(gutter)
        .mul(N.float(0.996).add(grain.mul(0.008)))
        .add(
          N.vec3(0.18, 0.26, 0.42)
            .mul(fresnel)
            .mul(0.17)
            .mul(N.smoothstep(0.25, 0.9, pigment)),
        )
        .add(
          N.vec3(0.04)
            .mul(gloss)
            .mul(N.float(0.35).add(N.smoothstep(0.1, 0.8, pigment).mul(0.65))),
        );
      return N.vec4(color, 1);
    })();
    Object.defineProperty(m, 'map', {
      get() {
        return u.uFrontMap.value;
      },
      set(t) {
        u.uFrontMap.value = t;
      },
    });
    return m;
  };
  api.stack = (u) => {
    nodes(u);
    const m = new G.MeshBasicNodeMaterial({ side: G.DoubleSide, toneMapped: false });
    m.uniforms = u;
    m.positionNode = N.Fn(() => block(N.positionGeometry, u))();
    m.castShadowPositionNode = m.positionNode;
    const local = N.varying(N.positionGeometry.add(0.5)),
      cap = N.varying(N.normalLocal.z.abs());
    m.fragmentNode = N.Fn(() => {
      const n = N.cross(N.dFdx(N.positionWorld), N.dFdy(N.positionWorld)).normalize();
      const leaf = local.z.mul(u.uSheets),
        aa = N.fwidth(leaf).max(0.025);
      let seam = N.float(1).sub(
        N.smoothstep(0.035, N.float(0.035).add(aa), leaf.add(0.5).fract().sub(0.5).abs()),
      );
      seam = N.mix(seam, 0.12, N.smoothstep(0.35, 1.5, aa));
      const gathering = leaf.div(16),
        groupAA = N.fwidth(gathering).max(0.025);
      const group = N.mix(
        0.15,
        N.smoothstep(
          0.78,
          0.98,
          N.float(0.5).add(
            gathering
              .mul(pi * 2)
              .cos()
              .mul(0.5),
          ),
        ),
        groupAA.pow(2).mul(-2).exp(),
      );
      const density = N.float(0.5).add(leaf.floor().mul(2.39996).sin().mul(0.5));
      const fiber = local.x.mul(1387).add(local.y.mul(967)).add(leaf.mul(4.7)).sin().mul(0.008);
      const cut = N.vec3(0.94, 0.93, 0.9).mul(
        N.float(1).sub(seam.mul(0.25)).sub(group.mul(0.22)).sub(density.mul(0.025)).add(fiber),
      );
      const edge = N.float(1).sub(local.x).min(local.y).min(N.float(1).sub(local.y));
      const surface = N.vec3(0.96, 0.955, 0.94).mul(
        N.float(0.91).add(N.smoothstep(0, 0.008, edge).mul(0.09)),
      );
      const base = N.mix(cut, surface, cap).mul(
        N.float(0.88).add(
          n
            .dot(N.vec3(-0.3, 0.55, 1).normalize())
            .max(0)
            .mul(0.12),
        ),
      );
      const delta = u.uLampPosition.sub(N.positionWorld),
        diff = n.dot(delta.normalize()).max(0);
      const night = N.vec3(0.64, 0.65, 0.63).add(
        N.vec3(1, 0.69, 0.32)
          .mul(diff)
          .div(N.float(1).add(delta.dot(delta).mul(0.6)))
          .mul(1.18)
          .mul(u.uLampPower)
          .mul(api.visibility()),
      );
      return N.vec4(base.mul(N.mix(N.vec3(N.mix(0.74, 1, api.keyShadow.r)), night, u.uNight)), 1);
    })();
    return m;
  };
  api.desk = (wood, u) => {
    nodes(u);
    const tex = N.texture(wood),
      m = new G.MeshBasicNodeMaterial();
    m.uniforms = u;
    m.fragmentNode = N.Fn(() => {
      const w = tex.sample(N.uv().mul(4)).rgb,
        delta = u.uLampPosition.sub(N.positionWorld),
        light = delta.normalize(),
        eye = N.cameraPosition.sub(N.positionWorld).normalize();
      const irradiance = u.uLampPower.mul(1.15).div(delta.dot(delta).add(0.1)),
        visible = api.visibility();
      const direct = N.vec3(1, 0.61, 0.27).mul(light.z.max(0)).mul(irradiance).mul(visible);
      const spec = light
        .add(eye)
        .normalize()
        .z.max(0)
        .pow(48)
        .mul(0.035)
        .mul(irradiance)
        .mul(visible);
      return N.vec4(
        w.mul(N.vec3(0.06, 0.07, 0.085).add(direct)).add(N.vec3(1, 0.68, 0.33).mul(spec)),
        1,
      );
    })();
    return m;
  };
  api.glass = (u) => {
    nodes(u);
    const m = new G.MeshBasicNodeMaterial({
      transparent: true,
      side: G.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    m.uniforms = u;
    m.fragmentNode = N.Fn(() => {
      const eye = N.cameraPosition.sub(N.positionWorld).normalize(),
        raw = N.normalWorldGeometry.normalize();
      const n = raw.dot(eye).lessThan(0).select(raw.negate(), raw);
      const edge = N.float(1).sub(n.dot(eye).max(0)).pow(3),
        light = u.uSource.sub(N.positionWorld).normalize();
      const glint = n.dot(light.add(eye).normalize()).max(0).pow(72);
      return N.vec4(
        N.mix(
          N.vec3(0.17, 0.19, 0.17),
          N.vec3(0.76, 0.55, 0.28),
          glint.mul(0.72).add(edge.mul(0.28)),
        ),
        N.float(0.008).add(edge.mul(0.19)).add(glint.mul(0.12)),
      );
    })();
    return m;
  };
  api.flame = (u) => {
    nodes(u);
    const m = new G.MeshBasicNodeMaterial({
      transparent: true,
      side: G.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    m.uniforms = u;
    m.positionNode = N.Fn(() => {
      const v = N.uv(),
        p = N.positionGeometry,
        t = u.uTime.mul(N.float(1).sub(u.uStill));
      const x = p.x.add(
        v.y.pow(1.8).mul(t.mul(3.7).sin().mul(0.028).add(t.mul(7.1).add(1.3).sin().mul(0.012))),
      );
      const y = p.y
        .add(0.21)
        .mul(
          N.float(1).add(
            N.float(1)
              .sub(u.uStill)
              .mul(t.mul(4.1).sin().mul(0.065).add(t.mul(9.7).sin().mul(0.035))),
          ),
        )
        .sub(0.21);
      return N.vec3(x, y, p.z.add(v.y.pow(1.6).mul(0.08)));
    })();
    m.fragmentNode = N.Fn(() => {
      const v = N.uv(),
        y = v.y,
        t = u.uTime.mul(N.float(1).sub(u.uStill));
      const sway = y
        .mul(8)
        .sub(t.mul(4.3))
        .sin()
        .mul(0.055)
        .add(t.mul(6.7).add(y.mul(14)).sin().mul(0.025))
        .mul(y);
      const width = y
        .pow(0.62)
        .mul(pi)
        .sin()
        .mul(0.4)
        .mul(N.float(1).sub(y.mul(0.63)))
        .max(0.008);
      const d = v.x.sub(0.5).sub(sway).abs().div(width);
      const alpha = N.float(1)
        .sub(N.smoothstep(0.68, 1, d))
        .mul(N.smoothstep(0, 0.05, y))
        .mul(N.float(1).sub(N.smoothstep(0.94, 1, y)));
      const core = N.float(1)
        .sub(N.smoothstep(0.12, 0.63, d))
        .mul(N.float(1).sub(N.smoothstep(0.3, 0.86, y)));
      let color = N.mix(N.vec3(1.65, 0.28, 0.006), N.vec3(2.6, 2.1, 1.12), core);
      color = N.mix(
        color,
        N.vec3(0.1, 0.4, 1.35),
        N.float(1)
          .sub(N.smoothstep(0.03, 0.13, y))
          .mul(0.7),
      );
      return N.vec4(color.mul(u.uBrightness), alpha.mul(0.99));
    })();
    return m;
  };
  return api;
}
