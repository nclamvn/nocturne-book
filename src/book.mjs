import * as T from '../vendor/three.core.js';
import { canvas } from './pages.mjs';
import { createPaperStack } from './stack.mjs';
import { createLantern } from './lantern.mjs';
import { turnProgress } from './interaction.mjs';
import { cameraLayout, lanternLayout } from './camera.mjs';
import { createDesk } from './desk.mjs';
import { trackballPoint, trackballRotation, clearance, settleHeight } from './object-pose.mjs';
const PI = Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function linen() {
  const c = canvas(256, 256),
    g = c.getContext('2d');
  g.fillStyle = '#777';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      g.fillStyle = `rgb(${118 + (x % 3) * 7 + (y % 3) * 4},${118 + (x % 3) * 7 + (y % 3) * 4},${118 + (x % 3) * 7 + (y % 3) * 4})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}
export class BookScene {
  constructor(host, { onTurn, onDragEnd, onOpen, onHover, renderer, gpuApi, backend } = {}) {
    Object.assign(this, { host, onTurn, onDragEnd, onOpen, onHover, gpuApi });
    this.host.dataset.renderer = backend ?? 'WebGL 2';
    this.resources = new Set();
    this.W = 1.46;
    this.H = 2.062;
    this.depth = 0.2;
    this.cursor = 0;
    this.count = 320;
    this.open = 0;
    this.targetOpen = 0;
    this.rotation = { x: 0, z: 0.025 };
    this.zoom = 1;
    this.targetZoom = 1;
    this.overhead = false;
    this.dirty = true;
    this.last = performance.now();
    this.frames = [];
    this.renders = 0;
    this.audio = false;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = renderer;
    this.renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 2), 2.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.NoToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, -0.12, 3.45);
    this.camera.lookAt(0, 0, 0);
    this.perspective = this.camera;
    this.nightCamera = new T.PerspectiveCamera(32, 1, 0.1, 100);
    this.nightCamera.position.copy(this.camera.position);
    this.environment();
    this.hemi = new T.HemisphereLight('#f3f0df', '#596b7b', 1.3);
    this.scene.add(this.hemi);
    this.key = new T.DirectionalLight('#fff1d3', 2.8);
    this.key.position.set(-3.4, 3.4, 6);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, {
      left: -3,
      right: 3,
      top: 3,
      bottom: -3,
      near: 0.5,
      far: 16,
    });
    this.key.shadow.bias = -0.00035;
    this.key.shadow.normalBias = 0.003;
    this.key.shadow.radius = 4;
    this.scene.add(this.key);
    this.fill = new T.DirectionalLight('#dbeeff', 1.1);
    this.fill.position.set(4, -1, 3);
    this.scene.add(this.fill);
    const wood = canvas(1024, 512),
      wg = wood.getContext('2d');
    wg.fillStyle = '#645742';
    wg.fillRect(0, 0, 1024, 512);
    for (let y = 0; y < 512; y++) {
      const tint = 70 + 6 * Math.sin(y * 0.31) + 4 * Math.sin(y * 1.71);
      wg.strokeStyle = `rgba(${tint},${tint * 0.8},${tint * 0.6},.3)`;
      wg.beginPath();
      for (let x = 0; x <= 1024; x += 8) {
        const yy = y + Math.sin(x * 0.009 + y * 0.046) * 1.2;
        if (x === 0) wg.moveTo(x, yy);
        else wg.lineTo(x, yy);
      }
      wg.stroke();
    }
    const woodMap = this.texture(wood);
    woodMap.wrapS = woodMap.wrapT = T.RepeatWrapping;
    woodMap.repeat.set(4, 4);
    this.desk = createDesk((r) => this.keep(r), woodMap, this.gpuApi);
    this.floor = this.desk.mesh;
    this.scene.add(this.floor);
    // A soft contact shadow anchors the object without obscuring the page text.
    const contact = canvas(256, 256),
      cg = contact.getContext('2d'),
      grad = cg.createRadialGradient(128, 128, 5, 128, 128, 125);
    grad.addColorStop(0, 'rgba(13,30,38,.22)');
    grad.addColorStop(0.65, 'rgba(13,30,38,.1)');
    grad.addColorStop(1, 'rgba(13,30,38,0)');
    cg.fillStyle = grad;
    cg.fillRect(0, 0, 256, 256);
    this.contact = new T.Mesh(
      this.keep(new T.PlaneGeometry(4.3, 3.3)),
      this.keep(
        new T.MeshBasicMaterial({
          map: this.texture(contact),
          transparent: true,
          depthWrite: false,
          color: '#101413',
        }),
      ),
    );
    this.contact.position.z = 0.016;
    this.scene.add(this.contact);
    this.lampBrightness = 1.25;
    this.objectMode = 'page';
    this.objectOffset = new T.Vector3();
    this.objectOrientation = new T.Quaternion();
    this.targetOrientation = new T.Quaternion();
    this.objectRig = new T.Group();
    this.scene.add(this.objectRig);
    this.book = new T.Group();
    this.objectRig.add(this.book);
    this.book.rotation.z = this.rotation.z;
    const white = canvas(8, 8);
    white.getContext('2d').fillStyle = '#ffffff';
    white.getContext('2d').fillRect(0, 0, 8, 8);
    this.blank = this.texture(white);
    this.grain = this.texture(linen());
    this.grain.wrapS = this.grain.wrapT = T.RepeatWrapping;
    this.makeBoards();
    this.makePages();
    this.lantern = createLantern((r) => this.keep(r), this.gpuApi);
    this.scene.add(this.lantern.group, ...this.lantern.lights);
    this.gpuApi.bindLights(this.lantern.lights, this.key);
    this.setLight(true);
    // Original procedural grain; no texture borrowed from the reference site.
    for (const p of Object.values(this.pages)) p.material.uniforms.uPaperGrain.value = this.grain;
    this.ray = new T.Raycaster();
    this.pointer = new T.Vector2();
    this.hitPlane = new T.Plane(new T.Vector3(0, 0, 1), -0.15);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.bind();
    this.resize();
    this.loop = this.loop.bind(this);
    this.renderer.setAnimationLoop(this.loop);
  }
  keep(r) {
    this.resources.add(r);
    return r;
  }
  texture(c) {
    const t = this.keep(new T.CanvasTexture(c));
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = Math.min(
      this.renderer.getMaxAnisotropy?.() ?? this.renderer.capabilities.getMaxAnisotropy(),
      8,
    );
    return t;
  }
  pageTexture(c) {
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = Math.min(
      this.renderer.getMaxAnisotropy?.() ?? this.renderer.capabilities.getMaxAnisotropy(),
      8,
    );
    return t;
  }
  environment() {
    const room = new T.Scene();
    const shell = new T.Mesh(
      new T.BoxGeometry(12, 12, 12),
      new T.MeshBasicMaterial({ color: '#84959d', side: T.BackSide }),
    );
    room.add(shell);
    const panelMat = new T.MeshBasicMaterial({ color: new T.Color(4, 3.7, 3.1) }),
      panel = new T.Mesh(new T.PlaneGeometry(6, 4), panelMat);
    panel.position.set(-3, 2, 4);
    panel.lookAt(0, 0, 0);
    room.add(panel);
    const panel2 = new T.Mesh(
      new T.PlaneGeometry(3, 6),
      new T.MeshBasicMaterial({ color: new T.Color(1.5, 1.8, 2) }),
    );
    panel2.position.set(4, 1, 1);
    panel2.lookAt(0, 0, 0);
    room.add(panel2);
    const pmrem = new this.gpuApi.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(room, 0.08, 0.1, 100);
    this.scene.environment = env.texture;
    this.keep(env);
    room.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    pmrem.dispose();
  }
  makeBoards() {
    this.frontCoverTexture = this.blank;
    this.coverBackTexture = this.blank;
    const cloth = this.keep(
      new T.MeshStandardMaterial({
        color: '#f2f2ee',
        roughness: 0.78,
        bumpMap: this.grain,
        bumpScale: 0.012,
      }),
    );
    const back = this.keep(
      new T.MeshStandardMaterial({
        map: this.blank,
        roughness: 0.7,
        bumpMap: this.grain,
        bumpScale: 0.008,
      }),
    );
    const inside = this.keep(new T.MeshBasicMaterial({ map: this.blank }));
    const boardGeo = this.keep(new T.BoxGeometry(this.W + 0.008, this.H + 0.008, 0.004));
    this.backBoard = new T.Mesh(boardGeo, [cloth, cloth, cloth, cloth, inside, back]);
    this.backBoard.position.set(this.W / 2, 0, 0.033);
    this.backBoard.castShadow = true;
    this.book.add(this.backBoard);
  }
  makePages() {
    this.stacks = [
      createPaperStack((r) => this.keep(r), -1, this.gpuApi),
      createPaperStack((r) => this.keep(r), 1, this.gpuApi),
    ];
    for (const s of this.stacks) this.book.add(s.mesh);
    this.pageGeometry = this.keep(new T.PlaneGeometry(1, 1, 72, 84));
    this.pages = {};
    for (const [name, side] of [
      ['left', -1],
      ['right', 1],
      ['flap', 1],
      ['cover', 1],
    ]) {
      const u = {
        uProgress: { value: 0 },
        uSide: { value: side },
        uWidth: { value: this.W },
        uHeight: { value: this.H },
        uBase: { value: 0.1 },
        uLanding: { value: 0.1 },
        uGutter: { value: 0.1 },
        uCorner: { value: 0 },
        uBackMap: { value: this.blank },
      };
      const m = this.keep(this.gpuApi.page(u, this.blank)),
        mesh = new T.Mesh(this.pageGeometry, m);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.visible = name !== 'flap';
      this.book.add(mesh);
      this.pages[name] = { mesh, material: m, u };
    }
  }
  setDocument(source) {
    this.count = source.count;
    this.H = clamp(this.W * source.aspect, 1, 3.4);
    this.depth = clamp(source.count * 0.00045, 0.012, 0.24);
    this.cursor = 0;
    this.open = this.targetOpen = 0;
    this.resetObjectPose();
    this.flip = null;
    this.hover = null;
    this.pointerState = null;
    if (this.frontCoverTexture !== this.blank) {
      this.resources.delete(this.frontCoverTexture);
      this.frontCoverTexture.dispose();
    }
    this.frontCoverTexture = this.blank;
    const ratio = (this.H + 0.008) / 2.07;
    this.backBoard.scale.y = ratio;
    for (const p of Object.values(this.pages)) p.u.uHeight.value = this.H;
    this.baseMaps = { left: this.blank, right: this.blank };
    this.applyMaps(this.blank, this.blank);
    this.pages.cover.material.map = this.frontCoverTexture;
    this.invalidate();
  }
  applyMaps(left, right) {
    this.baseMaps = { left, right };
    this.pages.left.material.map = left;
    this.pages.left.u.uBackMap.value = left;
    this.pages.right.material.map = right;
    this.pages.right.u.uBackMap.value = right;
    this.pages.flap.mesh.visible = false;
    this.dirty = true;
  }
  prepareFlap(front, back, underLeft, underRight) {
    const p = this.pages.flap;
    p.u.uProgress.value = this.turnDirection > 0 ? 0 : 1;
    p.material.map = front;
    p.u.uBackMap.value = back;
    this.pages.left.material.map = underLeft;
    this.pages.left.u.uBackMap.value = underLeft;
    this.pages.right.material.map = underRight;
    this.pages.right.u.uBackMap.value = underRight;
    p.mesh.visible = true;
    this.invalidate();
  }
  clearFlap() {
    this.hover = null;
    this.onHover?.(0);
    if (this.flip) return;
    this.applyMaps(this.baseMaps.left, this.baseMaps.right);
    this.invalidate();
  }
  setCover(c, back) {
    if (this.frontCoverTexture !== this.blank) {
      this.resources.delete(this.frontCoverTexture);
      this.frontCoverTexture.dispose();
    }
    if (this.coverBackTexture !== this.blank) {
      this.resources.delete(this.coverBackTexture);
      this.coverBackTexture.dispose();
    }
    this.coverBackTexture = back ? this.texture(back) : this.blank;
    this.frontCoverTexture = this.texture(c);
    this.pages.cover.material.map = this.frontCoverTexture;
    this.pages.cover.u.uBackMap.value = this.coverBackTexture;
    this.invalidate();
  }
  setCursor(cursor) {
    this.cursor = cursor;
    this.updateGeometry();
    this.invalidate();
  }
  openBook(open = true) {
    this.targetOpen = open ? 1 : 0;
    this.clearFlap();
    this.invalidate();
  }
  setProgress(p, corner = 0) {
    this.pages.flap.u.uProgress.value = clamp(p, 0, 1);
    this.pages.flap.u.uCorner.value = corner;
    this.pages.flap.mesh.visible = true;
    this.invalidate();
  }
  animateTurn(from, to, { corner = 0, duration = 760, velocity = 0 } = {}) {
    return new Promise((resolve) => {
      this.hover = null;
      this.flip = {
        from,
        to,
        corner,
        velocity,
        start: performance.now(),
        duration: this.reduced ? 1 : duration,
        resolve,
      };
      this.invalidate();
    });
  }
  updateGeometry() {
    const p = this.pages.flap.u.uProgress.value;
    const transfer = this.pages.flap.mesh.visible ? (this.turnDirection > 0 ? p : p - 1) * 2 : 0;
    const frac = this.count ? clamp((this.cursor + transfer) / this.count, 0, 1) * this.open : 0;
    const ld = this.depth * frac,
      rd = this.depth * (1 - frac);
    const lz = 0.036 + ld,
      rz = 0.036 + rd;
    const balance = 1 - 4 * frac * (1 - frac);
    const openGutter = 0.036 + this.depth * (0.45 + 0.43 * balance);
    const gutter = (1 - this.open) * (0.042 + this.depth) + this.open * openGutter;
    for (const page of Object.values(this.pages)) page.u.uGutter.value = gutter;
    for (const stack of this.stacks) {
      const u = stack.uniforms,
        side = u.uSide.value,
        d = side > 0 ? rd : ld;
      const sheets = (this.count / 2) * (side > 0 ? 1 - frac : frac);
      u.uWidth.value = this.W;
      u.uHeight.value = this.H;
      u.uDepth.value = Math.max(d, 0.0003);
      u.uSheets.value = Math.max(1, sheets);
      u.uGutter.value = gutter - 0.0007;
      u.uFan.value = Math.min(0.018, d * 0.22);
      stack.mesh.visible = sheets > 0.1 && (side > 0 || this.open > 0.02);
    }
    this.pages.left.u.uBase.value = lz + 0.0007;
    this.pages.left.u.uLanding.value = lz + 0.0007;
    this.pages.right.u.uBase.value = rz + 0.0007;
    this.pages.right.u.uLanding.value = rz + 0.0007;
    this.pages.flap.u.uBase.value = rz + 0.007;
    this.pages.flap.u.uLanding.value = lz + 0.009;
    this.book.position.x = (-(1 - this.open) * this.W) / 2;
    this.pages.left.mesh.visible = this.open > 0.92;
    this.pages.right.mesh.visible = this.open > 0.01;
    this.book.rotation.z = this.rotation.z;
    this.book.rotation.x = this.rotation.x;
    this.book.rotation.y = -(1 - this.open) * 0.11;
    const pivot = 0.036 + this.depth / 2;
    this.book.position.z = -pivot;
    this.objectRig.quaternion.copy(this.objectOrientation);
    const lift = clearance(
      this.objectOrientation.clone().multiply(this.book.quaternion),
      this.W,
      this.H,
      this.depth,
    );
    this.objectRig.position.set(
      this.objectOffset.x,
      this.objectOffset.y,
      pivot + this.objectOffset.z + lift,
    );
    this.host.dataset.objectPose = [
      this.objectOffset.x,
      this.objectOffset.y,
      this.objectOffset.z,
      ...this.objectOrientation.toArray(),
    ]
      .map((x) => x.toFixed(3))
      .join(',');
    const cover = this.pages.cover;
    cover.mesh.visible = this.open < 0.995;
    cover.u.uBase.value = 0.036 + this.depth + 0.006;
    cover.u.uLanding.value = 0.032;
    cover.u.uProgress.value = this.open + (1 - this.open) * 0.018;
    cover.u.uCorner.value = -0.75;

    this.contact.scale.x = 0.62 + this.open * 0.38;
    this.contact.position.x = this.objectOffset.x;
    this.contact.position.y = this.objectOffset.y;
    this.contact.material.opacity = Math.exp(-this.objectOffset.z * 6);
    this.contact.rotation.z = this.rotation.z;
  }
  pointerRay(clientX, clientY) {
    const r = this.host.getBoundingClientRect();
    this.pointer.set(
      ((clientX - r.left) / r.width) * 2 - 1,
      (-(clientY - r.top) / r.height) * 2 + 1,
    );
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(this.pointer, this.camera);
    return this.ray.ray;
  }
  projectPoint(clientX, clientY) {
    this.book.updateWorldMatrix(true, false);
    const normal = new T.Vector3(0, 0, 1).transformDirection(this.book.matrixWorld),
      origin = this.book.localToWorld(new T.Vector3(0, 0, 0.1));
    this.hitPlane.setFromNormalAndCoplanarPoint(normal, origin);
    const v = this.pointerRay(clientX, clientY).intersectPlane(this.hitPlane, new T.Vector3());
    return v ? this.book.worldToLocal(v) : null;
  }
  setObjectMode(mode) {
    this.cancelPointer?.();
    this.objectMode = mode;
    this.clearFlap();
    this.host.dataset.objectMode = mode;
    this.renderer.domElement.style.cursor = mode === 'page' ? 'auto' : 'grab';
    this.invalidate();
  }
  resetObjectPose(resetView = true) {
    this.cancelPointer?.();
    this.objectOffset.set(0, 0, 0);
    this.objectOrientation.identity();
    this.targetOrientation.identity();
    this.dropping = false;
    if (resetView) {
      this.overhead = false;
      this.rotation = { x: 0, z: 0.025 };
      this.zoom = this.targetZoom = 1;
    }
    this.invalidate();
  }
  startObjectGesture(e, mode) {
    this.clearFlap();
    this.dropping = false;
    this.targetOrientation.copy(this.objectOrientation);
    this.objectRig.updateWorldMatrix(true, false);
    const r = this.host.getBoundingClientRect(),
      center = this.objectRig.getWorldPosition(new T.Vector3()),
      screen = center.clone().project(this.camera);
    const cx = r.left + ((screen.x + 1) * r.width) / 2,
      cy = r.top + ((1 - screen.y) * r.height) / 2,
      radius = Math.min(r.width * 0.32, r.height * 0.45);
    const plane = new T.Plane().setFromNormalAndCoplanarPoint(
      this.camera.getWorldDirection(new T.Vector3()),
      center,
    );
    const start = this.pointerRay(e.clientX, e.clientY).intersectPlane(plane, new T.Vector3());
    this.pointerState = {
      type: mode,
      pointerId: e.pointerId,
      plane,
      start,
      offset: this.objectOffset.clone(),
      orientation: this.objectOrientation.clone(),
      cameraOrientation: this.camera.quaternion.clone(),
      ball: trackballPoint(e.clientX, e.clientY, cx, cy, radius),
      cx,
      cy,
      radius,
    };
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.renderer.domElement.style.cursor = 'grabbing';
  }
  bind() {
    const c = this.renderer.domElement;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      if (![0, 1, 2].includes(e.button) || this.interactionBusy || this.pointerState || this.flip)
        return;
      const mode =
        e.button === 2 || e.button === 1 || e.altKey
          ? 'move'
          : e.shiftKey
            ? 'rotate'
            : this.objectMode;
      if (mode !== 'page') {
        this.startObjectGesture(e, mode);
        return;
      }
      const hit = this.projectPoint(e.clientX, e.clientY);
      if (!hit || Math.abs(hit.x) > this.W + 0.16 || Math.abs(hit.y) > this.H / 2 + 0.1) {
        this.startObjectGesture(e, 'rotate');
        return;
      }
      if (this.targetOpen < 0.5) {
        this.onOpen?.();
        return;
      }
      if (this.open < 0.97) return;
      const direction = hit.x > 0 ? 1 : -1;
      this.pointerState = {
        type: 'page',
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        direction,
        start: direction > 0 ? 0 : 1,
        corner: clamp(hit.y / (this.H / 2), -1, 1),
        initialCorner: clamp(hit.y / (this.H / 2), -1, 1),
        moved: false,
        ready: false,
      };
      c.setPointerCapture(e.pointerId);
      this.onTurn?.(direction, this.pointerState);
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointerState;
      if (p?.type === 'move') {
        const v = this.pointerRay(e.clientX, e.clientY).intersectPlane(p.plane, new T.Vector3());
        if (v && p.start) {
          this.objectOffset.copy(p.offset).add(v.sub(p.start));
          this.objectOffset.x = clamp(this.objectOffset.x, -3, 3);
          this.objectOffset.y = clamp(this.objectOffset.y, -3, 3);
          this.objectOffset.z = clamp(this.objectOffset.z, 0, 2.5);
          this.invalidate();
        }
        return;
      }
      if (p?.type === 'rotate') {
        const next = trackballPoint(e.clientX, e.clientY, p.cx, p.cy, p.radius);
        this.targetOrientation.copy(
          trackballRotation(p.ball, next, p.cameraOrientation, p.orientation),
        );
        this.invalidate();
        return;
      }
      if (p?.type === 'page') {
        const screenWidth = Math.min(this.host.clientWidth * 0.7, 820) * this.zoom,
          delta = (e.clientX - p.x) / (screenWidth * 0.45);
        const next = clamp(p.start - delta, 0, 1),
          now = performance.now();
        if (p.lastMoveTime) {
          const v = ((next - (p.progress ?? p.start)) * 1000) / Math.max(8, now - p.lastMoveTime);
          p.velocity = (p.velocity ?? v) * 0.55 + v * 0.45;
        }
        p.lastMoveTime = now;
        p.progress = next;
        p.corner = clamp(
          p.initialCorner - ((e.clientY - p.y) / this.host.clientHeight) * 2.2,
          -1.2,
          1.2,
        );
        p.moved ||= Math.abs(e.clientX - p.x) > 5;
        if (p.ready) this.setProgress(p.progress, p.corner);
        return;
      }
      if (this.objectMode === 'page' && !this.flip && this.open > 0.99) {
        const h = this.projectPoint(e.clientX, e.clientY);
        if (
          h &&
          Math.abs(h.x) > 0.6 * this.W &&
          Math.abs(h.x) < this.W + 0.05 &&
          Math.abs(h.y) < this.H / 2 + 0.06
        )
          this.onHover?.(h.x > 0 ? 1 : -1, clamp(h.y / (this.H / 2), -1, 1));
        else this.clearFlap();
      }
    });
    const end = (e) => {
      const p = this.pointerState;
      if (!p || e.pointerId !== p.pointerId) return;
      this.pointerState = null;
      if (c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
      c.style.cursor = this.objectMode === 'page' ? 'auto' : 'grab';
      const cancelled = e.type !== 'pointerup';
      if (p.type === 'page') {
        p.cancelled = cancelled;
        this.onDragEnd?.(p);
      } else if (cancelled) {
        this.objectOffset.copy(p.offset);
        this.objectOrientation.copy(p.orientation);
        this.targetOrientation.copy(p.orientation);
        this.invalidate();
      } else if (p.type === 'move') {
        this.dropping = this.objectOffset.z > 0;
        this.invalidate();
      }
    };
    this.cancelPointer = () => {
      const p = this.pointerState;
      if (!p) return;
      end({ pointerId: p.pointerId, type: 'pointercancel' });
    };
    window.addEventListener('blur', this.cancelPointer);
    c.addEventListener('lostpointercapture', end);
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', () => {
      if (!this.pointerState) this.clearFlap();
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.targetZoom = clamp(this.targetZoom * Math.exp(-e.deltaY * 0.001), 0.65, 1.85);
        this.invalidate();
        this.host.dispatchEvent(new CustomEvent('zoomchange'));
      },
      { passive: false },
    );
    c.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      this.host.dispatchEvent(new CustomEvent('contextlost'));
    });
    c.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.invalidate();
      this.host.dispatchEvent(new CustomEvent('contextrestored'));
    });
  }
  zoomBy(factor) {
    this.targetZoom = clamp(this.targetZoom * factor, 0.65, 1.85);
    this.invalidate();
  }
  setView() {
    this.resetObjectPose(false);
    this.overhead = !this.overhead;
    this.rotation.z = this.overhead ? -0.08 : 0.025;
    this.rotation.x = 0;
    this.invalidate();
  }
  // TSL shadow nodes stay bound across modes; freeze inactive maps instead of disabling castShadow.
  // r186 lightShadowMatrix otherwise calls PointLightShadow.updateMatrices without a target.
  setLight(night) {
    this.night = night;
    this.camera = night ? this.nightCamera : this.perspective;
    this.renderer.toneMapping = night ? T.ACESFilmicToneMapping : T.NoToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    for (const p of Object.values(this.pages)) p.material.uniforms.uNight.value = night ? 1 : 0;
    for (const s of this.stacks) s.uniforms.uNight.value = night ? 1 : 0;
    this.key.color.set(night ? '#d7e1e9' : '#fff1d3');
    this.key.intensity = night ? 0.025 : 2.8;
    this.key.castShadow = true;
    this.key.shadow.autoUpdate = !night;
    this.key.shadow.needsUpdate = !night;
    this.fill.intensity = night ? 0.055 : 1.1;
    this.hemi.intensity = night ? 0.015 : 1.3;
    this.lantern.group.visible = night;
    for (const light of this.lantern.lights) {
      light.visible = night;
      light.castShadow = true;
      light.shadow.autoUpdate = night;
      light.shadow.needsUpdate = night;
    }
    this.floor.visible = night;
    this.contact.visible = night;
    this.invalidate();
  }
  setLampBrightness(value) {
    this.lampBrightness = clamp(value, 0.5, 1.5);
    this.host.dataset.lampBrightness = String(this.lampBrightness);
    this.invalidate();
  }
  setReducedMotion(enabled) {
    this.reduced = enabled;
    this.invalidate();
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    for (const camera of [this.perspective, this.nightCamera]) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    this.invalidate();
  }
  invalidate() {
    this.dirty = true;
  }
  loop(now) {
    const dt = Math.min((now - this.last) / 1000, 0.04);
    this.last = now;
    if (this.lost || document.hidden) return;
    let moving = false;
    if (this.objectOrientation.angleTo(this.targetOrientation) > 0.0001) {
      this.objectOrientation.slerp(
        this.targetOrientation,
        this.reduced ? 1 : 1 - Math.exp(-dt * 18),
      );
      moving = true;
    } else this.objectOrientation.copy(this.targetOrientation);
    if (this.dropping) {
      this.objectOffset.z = this.reduced ? 0 : settleHeight(this.objectOffset.z, dt);
      this.dropping = this.objectOffset.z > 0;
      moving = true;
    }
    if (Math.abs(this.open - this.targetOpen) > 0.0001) {
      this.open += (this.targetOpen - this.open) * (this.reduced ? 1 : 1 - Math.exp(-dt * 6));
      moving = true;
    } else this.open = this.targetOpen;
    if (Math.abs(this.zoom - this.targetZoom) > 0.0001) {
      this.zoom += (this.targetZoom - this.zoom) * (1 - Math.exp(-dt * 9));
      moving = true;
    }
    if (this.flip) {
      const f = this.flip,
        t = clamp((now - f.start) / f.duration, 0, 1);
      this.setProgress(turnProgress(f.from, f.to, t, f.velocity, f.duration), f.corner);
      moving = true;
      if (t === 1) {
        this.flip = null;
        f.resolve();
      }
    }
    const bookPoints = [];
    if (this.objectOrientation.angleTo(new T.Quaternion()) > 0.001) {
      const effective = this.objectOrientation.clone().multiply(this.book.quaternion),
        lift = clearance(effective, this.W, this.H, this.depth);
      for (const x of [-this.W - 0.025, this.W + 0.025])
        for (const y of [-this.H / 2 - 0.025, this.H / 2 + 0.025])
          for (const z of [-this.depth / 2, this.depth / 2 + 0.03]) {
            const point = new T.Vector3(x, y, z).applyQuaternion(effective);
            point.z += 0.036 + this.depth / 2 + lift;
            bookPoints.push(point.toArray());
          }
    }
    const layout = cameraLayout({
      bookPoints,
      width: this.W,
      height: this.H,
      aspect: this.camera.aspect,
      zoom: this.zoom,
      night: this.night,
      overhead: this.overhead,
    });
    if (Math.abs(this.camera.filmOffset - (layout.filmOffset ?? 0)) > 0.00001) {
      this.camera.filmOffset = layout.filmOffset ?? 0;
      this.camera.updateProjectionMatrix();
    }
    const goal = new T.Vector3(...layout.position),
      aim = new T.Vector3(...layout.target);
    const needsSpace =
      bookPoints.length && goal.distanceTo(aim) > this.camera.position.distanceTo(aim) + 0.001;
    if (this.camera.position.distanceTo(goal) > 0.0001) {
      if (this.reduced || needsSpace) this.camera.position.copy(goal);
      else this.camera.position.lerp(goal, 1 - Math.exp(-dt * 8));
      moving = true;
    }
    this.camera.lookAt(...layout.target);
    const lampLayout = lanternLayout(this.W, this.H);
    this.lantern.group.position.set(...lampLayout.position);
    this.lantern.group.scale.setScalar(lampLayout.scale);
    if (
      this.night &&
      (this.dirty || moving || (!this.reduced && now - (this.flameTick ?? 0) > 33))
    ) {
      this.flameTick = now;
      const power = this.lantern.update(
        now / 1000,
        this.reduced,
        this.camera.position,
        this.lampBrightness,
      );
      this.desk.uniforms.uLampPosition.value.copy(this.lantern.light.position);
      this.desk.uniforms.uLampPower.value = power;
      for (const page of Object.values(this.pages)) {
        page.material.uniforms.uLampPosition.value.copy(this.lantern.light.position);
        page.material.uniforms.uLampPower.value = power;
      }
      for (const stack of this.stacks) {
        stack.uniforms.uLampPosition.value.copy(this.lantern.light.position);
        stack.uniforms.uLampPower.value = power;
      }
      this.dirty = true;
    }
    this.updateGeometry();
    if (this.dirty || moving) {
      this.renderer.shadowMap.needsUpdate = true;
      this.key.shadow.needsUpdate = !this.night;
      for (const light of this.lantern.lights) light.shadow.needsUpdate = this.night;
      this.renderer.render(this.scene, this.camera);
      this.lastDrawCalls = this.renderer.info.render.drawCalls;
      this.renders++;
      this.frames.push(dt * 1000);
      if (this.frames.length > 180) this.frames.shift();
      this.dirty = false;
    }
    this.host.dataset.animation = moving ? 'moving' : 'settled';
  }
  stats() {
    return {
      drawCalls: this.lastDrawCalls ?? 0,
      textures: this.renderer.info.memory.textures,
      geometries: this.renderer.info.memory.geometries,
      renderFrames: this.renders,
      averageFrameMs: this.frames.length
        ? Math.round((this.frames.reduce((a, b) => a + b, 0) / this.frames.length) * 10) / 10
        : 0,
    };
  }
  rustle() {
    if (!this.audio) return;
    try {
      this.audioContext ??= new AudioContext();
      const ac = this.audioContext;
      ac.resume();
      const buffer = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate),
        v = buffer.getChannelData(0);
      for (let i = 0; i < v.length; i++)
        v[i] = (Math.random() * 2 - 1) * Math.sin((PI * i) / v.length) * 0.22;
      const source = ac.createBufferSource(),
        filter = ac.createBiquadFilter(),
        gain = ac.createGain();
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.value = 1700;
      gain.gain.value = 0.1;
      source.connect(filter).connect(gain).connect(ac.destination);
      source.start();
    } catch {}
  }
  dispose() {
    this.disposed = true;
    window.removeEventListener('blur', this.cancelPointer);
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    for (const r of this.resources) r.dispose();
    for (const light of this.lantern.lights) light.shadow.dispose();
    this.key.shadow.dispose();
    this.renderer.dispose();
    this.audioContext?.close();
  }
}
