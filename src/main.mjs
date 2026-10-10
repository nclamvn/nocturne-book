import { BookScene } from './book.mjs';
import { createRenderer } from './renderer.mjs';
import { PageCache } from './cache.mjs';
import { PdfSource } from './pages.mjs';
import { ReferenceSource } from './reference.mjs';
import { cursorForPage, lastSpreadCursor, spreadRange } from './spreads.mjs';
import { releaseDecision } from './interaction.mjs';
import { ReaderState, documentId } from './reader-state.mjs';
const $ = (id) => document.getElementById(id),
  clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const startupControls = [
  'upload',
  'cover',
  'prev',
  'next',
  'zoom-in',
  'zoom-out',
  'page-mode',
  'move-mode',
  'rotate-mode',
  'reset-pose',
  'view',
  'light',
  'lamp-control',
  'motion',
  'sound',
  'fullscreen',
  'bookmark',
  'marks',
  'demo',
];
for (const id of startupControls) $(id).disabled = true;
let scene,
  source,
  cache,
  cursor = 0,
  busy = false,
  generation = 0,
  activeKeys = [],
  quality = 1400,
  hoverDirection = 0,
  hoverToken = 0,
  statusTimer,
  fileLoading = false;
let storage;
try {
  storage = localStorage;
} catch {
  storage = null;
}
const reader = new ReaderState(storage);
let bookId = 'paper-mono-v1',
  bookmarks = [],
  night = reader.preference('night', true);
let reduced = reader.preference('reduced', matchMedia('(prefers-reduced-motion: reduce)').matches);
let lampBrightness = clamp(reader.preference('lamp-brightness', 1.25), 0.5, 1.5);
function remember() {
  if (source && !busy) reader.write(bookId, { cursor, open: scene.targetOpen > 0.5, bookmarks });
}
function marksUI() {
  const current = spreadRange(cursor, source.count).first,
    marked = bookmarks.includes(current);
  $('bookmark').setAttribute('aria-pressed', String(marked));
  $('bookmark').setAttribute('aria-label', marked ? 'Bỏ đánh dấu trang' : 'Đánh dấu trang');
  $('bookmark').disabled = busy || scene.targetOpen < 0.5;
  $('marks').setAttribute('aria-label', `Trang đánh dấu (${bookmarks.length})`);
  $('marks-count').textContent = bookmarks.length || '';
  const list = $('marks-list');
  list.replaceChildren();
  if (!bookmarks.length) {
    const p = document.createElement('p');
    p.textContent = 'Đánh dấu một trang để quay lại sau.';
    list.append(p);
  }
  for (const n of bookmarks) {
    const row = document.createElement('div'),
      button = document.createElement('button'),
      remove = document.createElement('button');
    button.textContent = `Trang ${n}`;
    button.dataset.page = n;
    remove.textContent = '×';
    remove.dataset.remove = n;
    remove.setAttribute('aria-label', `Bỏ đánh dấu trang ${n}`);
    row.append(button, remove);
    list.append(row);
  }
}
function lightUI() {
  $('studio').classList.toggle('night', night);
  $('light').setAttribute('aria-label', night ? 'Đọc ban ngày' : 'Đọc dưới ánh đèn');
  $('light').title = night ? 'Đọc ban ngày' : 'Đọc dưới ánh đèn';
  $('light').removeAttribute('aria-pressed');
  document
    .querySelector('.brand')
    .setAttribute(
      'aria-label',
      night ? 'Dưới ánh đèn, về sách mẫu' : 'Paper Mono, về bản đối chiếu',
    );
  document.querySelector('meta[name="theme-color"]').content = night ? '#101719' : '#f6f6f3';
  $('lamp-control').disabled = !night;
  if (!night) {
    $('lamp-panel').hidden = true;
    $('lamp-control').setAttribute('aria-expanded', 'false');
  }
  scene.setLight(night);
  scene.setLampBrightness(lampBrightness);
  $('lamp-brightness').value = String(Math.round(lampBrightness * 100));
  $('lamp-value').textContent = `${Math.round(lampBrightness * 100)}%`;
}
function motionUI() {
  scene.setReducedMotion(reduced);
  $('studio').classList.toggle('motion-reduced', reduced);
  $('motion').setAttribute('aria-pressed', String(reduced));
}
function status(message = '', error = false) {
  clearTimeout(statusTimer);
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
  if (message && !error)
    statusTimer = setTimeout(() => {
      $('status').textContent = '';
    }, 4000);
}
function setPanel(id, open, restoreFocus = false) {
  const button = $(id === 'lamp-panel' ? 'lamp-control' : 'marks');
  $(id).hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  if (!open && restoreFocus) button.focus();
}
function closePanels(restoreFocus = false) {
  for (const id of ['lamp-panel', 'marks-panel'])
    if (!$(id).hidden) setPanel(id, false, restoreFocus);
}
function maxCursor() {
  return lastSpreadCursor(source.count);
}
function key(index, width = quality) {
  return cache.key(index, width);
}
async function page(index) {
  if (index < 0 || index >= source.count) return scene.blank;
  return (await cache.get(index, quality)).texture;
}
function pin(indices) {
  activeKeys = indices.filter((i) => i >= 0 && i < source.count).map((i) => key(i));
  cache.pin(activeKeys);
}
function ui() {
  scene.interactionBusy = busy;
  for (const id of ['page-mode', 'move-mode', 'rotate-mode', 'reset-pose']) $(id).disabled = busy;
  const open = scene.targetOpen > 0.5,
    range = spreadRange(cursor, source.count);
  $('page').value = open ? String(range.first) : 'Bìa';
  $('page-total').textContent =
    open && range.first !== range.last ? `– ${range.last} / ${source.count}` : `/ ${source.count}`;
  $('prev').disabled = busy || !open || cursor === 0;
  $('next').disabled = busy || (open && cursor >= maxCursor());
  $('cover').textContent = open ? 'Đóng sách' : 'Mở sách';
  $('cover').setAttribute('aria-label', open ? 'Đóng sách' : 'Mở sách');
  $('cover').disabled = busy;
  $('hint').style.opacity = open ? '.52' : '0';
  $('studio').dataset.state = busy ? 'busy' : 'ready';
  $('studio').setAttribute('aria-busy', String(busy || fileLoading));
  $('reading-progress').max = source.count;
  $('reading-progress').value = open ? range.last : 0;
  $('studio').dataset.page = open ? String(Math.min(cursor + 1, source.count)) : 'cover';
  marksUI();
  remember();
}
async function showSpread() {
  const epoch = generation;
  const oldKeys = activeKeys.slice();
  const newKeys = [cursor - 1, cursor].filter((i) => i >= 0 && i < source.count).map((i) => key(i));
  cache.pin([...oldKeys, ...newKeys]);
  const [l, r] = await Promise.all([page(cursor - 1), page(cursor)]);
  if (epoch !== generation) return;
  scene.setCursor(cursor);
  scene.applyMaps(l, r);
  activeKeys = newKeys;
  cache.pin(newKeys);
  prefetch();
  ui();
}
function prefetch() {
  const epoch = generation;
  const near = [cursor + 1, cursor + 2, cursor - 2, cursor - 3];
  (async () => {
    for (const i of near) {
      if (epoch !== generation) return;
      if (i < 0 || i >= source.count) continue;
      try {
        await cache.get(i, quality);
      } catch {
        break;
      }
    }
  })();
}
async function prepare(direction, valid = () => true) {
  const epoch = generation;
  const front = direction > 0 ? cursor : cursor - 2,
    back = front + 1;
  scene.turnDirection = direction;
  const underL = direction > 0 ? cursor - 1 : cursor - 3,
    underR = direction > 0 ? cursor + 2 : cursor;
  pin([cursor - 1, cursor, front, back, underL, underR]);
  const maps = await Promise.all([page(front), page(back), page(underL), page(underR)]);
  if (epoch !== generation) throw new Error('Document replaced');
  if (!valid()) return;
  scene.prepareFlap(...maps);
  return epoch;
}
async function navigate(direction, drag = null) {
  if (busy || !source) return;
  if (scene.targetOpen < 0.5) {
    await toggleCover();
    return;
  }
  if ((direction > 0 && cursor >= maxCursor()) || (direction < 0 && cursor <= 0)) {
    scene.clearFlap();
    return;
  }
  const epoch = generation;
  busy = true;
  hoverToken++;
  hoverDirection = 0;
  ui();
  try {
    await prepare(direction);
    if (epoch !== generation) return;
    if (drag) {
      drag.ready = true;
      scene.setProgress(drag.progress ?? drag.start, drag.corner);
      if (drag.ended) await finishDrag(drag);
    } else {
      scene.rustle();
      await scene.animateTurn(direction > 0 ? 0 : 1, direction > 0 ? 1 : 0, {
        corner: direction > 0 ? -0.8 : 0.8,
      });
      if (epoch !== generation) return;
      cursor = clamp(cursor + 2 * direction, 0, maxCursor());
      await showSpread();
      busy = false;
      ui();
    }
  } catch (e) {
    if (epoch === generation) {
      busy = false;
      scene.clearFlap();
      status('Không render được trang. Hãy thử giở lại hoặc mở lại PDF.', true);
      ui();
    }
  }
}
async function finishDrag(p) {
  p.ended = true;
  if (!p.ready) return;
  const epoch = generation;
  const { from, commit, target, duration, velocity } = releaseDecision(p);
  try {
    if (commit) scene.rustle();
    await scene.animateTurn(from, target, { corner: p.corner, duration, velocity });
    if (epoch !== generation) return;
    if (commit) cursor = clamp(cursor + 2 * p.direction, 0, maxCursor());
    await showSpread();
    busy = false;
    ui();
  } catch {
    if (epoch === generation) {
      busy = false;
      ui();
    }
  }
}
async function hover(direction, corner) {
  if (!direction) {
    if (hoverDirection) {
      hoverDirection = 0;
      hoverToken++;
    }
    return;
  }
  if (busy || hoverDirection === direction) return;
  if ((direction < 0 && cursor === 0) || (direction > 0 && cursor >= maxCursor())) return;
  hoverDirection = direction;
  const token = ++hoverToken,
    epoch = generation;
  try {
    await prepare(direction, () => token === hoverToken && !busy);
    if (token !== hoverToken || epoch !== generation || busy) {
      return;
    }
    scene.hover = { direction };
    scene.setProgress(direction > 0 ? 0.024 : 0.976, corner);
  } catch {}
}
async function toggleCover() {
  if (busy) return;
  status('');
  if (scene.targetOpen < 0.5) {
    busy = true;
    ui();
    try {
      if (cursor === 0 && source.count > 1) cursor = 2;
      await showSpread();
      scene.openBook(true);
      busy = false;
      ui();
    } catch {
      busy = false;
      status('Không mở được trang đầu của PDF.', true);
      ui();
    }
  } else {
    scene.openBook(false);
    hoverToken++;
    hoverDirection = 0;
    ui();
  }
}
async function replace(next) {
  scene.cancelPointer?.();
  generation++;
  hoverToken++;
  hoverDirection = 0;
  busy = true;
  activeKeys = [];
  scene.flip?.resolve();
  scene.flip = null;
  const oldSource = source,
    oldCache = cache;
  source = next;
  bookId = source.id ?? 'paper-mono-v1';
  const saved = reader.read(bookId, source.count);
  bookmarks = saved.bookmarks;
  cursor = saved.cursor;
  quality = 1400;
  scene.setDocument(source);
  objectMode('page');
  cache = new PageCache(source, (c) => scene.pageTexture(c));
  oldCache?.dispose();
  await oldSource?.destroy();
  $('book-title').textContent = source.title;
  $('edition').textContent =
    source.kind === 'pdf'
      ? `PDF của bạn · ${source.count} trang`
      : `Paper Mono · ${source.count} trang`;
  $('book-subtitle').textContent =
    source.kind === 'pdf' ? 'Xử lý trên máy.' : 'Bản đối chiếu · paper.design/mono';
  ui();
  const epoch = generation;
  const [cover, backCover] = await Promise.all([
    source.render(0, 2400),
    source.count > 1 ? source.render(1, 1400) : Promise.resolve(null),
  ]);
  if (epoch !== generation) {
    cover.width = 0;
    if (backCover) backCover.width = 0;
    return;
  }
  scene.setCover(cover, backCover);
  await showSpread();
  scene.openBook(saved.open);
  busy = false;
  ui();
  status(
    saved.open
      ? `Đọc tiếp từ trang ${spreadRange(cursor, source.count).first}.`
      : 'Cuốn sách đã sẵn sàng. Chạm vào bìa để mở.',
  );
}
async function loadFile(file) {
  if (!file || fileLoading) return;
  fileLoading = true;
  closePanels();
  const epoch = generation;
  status('Đang mở PDF…');
  $('upload').disabled = true;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const id = await documentId(data);
    const next = await PdfSource.from(data, file.name);
    next.id = id;
    if (epoch !== generation) {
      await next.destroy();
      return;
    }
    await replace(next);
    ui();
  } catch (e) {
    status(
      e.name === 'PasswordException'
        ? 'PDF có mật khẩu. Hãy mở một bản PDF đã bỏ mật khẩu.'
        : 'Không mở được PDF này. Hãy kiểm tra tệp rồi thử lại.',
      true,
    );
  } finally {
    fileLoading = false;
    busy = false;
    $('upload').disabled = false;
    $('pdf-file').value = '';
    if (source) ui();
  }
}
try {
  status('Đang khởi tạo đồ hoạ…');
  $('scene').dataset.init = 'renderer';
  const engine = await createRenderer({
    forceWebGL: new URLSearchParams(location.search).get('renderer') === 'webgl',
  });
  $('scene').dataset.init = 'scene';
  scene = new BookScene($('scene'), {
    ...engine,
    onTurn: navigate,
    onDragEnd: finishDrag,
    onOpen: toggleCover,
    onHover: hover,
  });
  $('scene').dataset.init = 'ready';
  lightUI();
  motionUI();
  await replace(new ReferenceSource());
  for (const id of startupControls) $(id).disabled = false;
  lightUI();
  ui();
} catch (e) {
  status('Không khởi tạo được đồ hoạ. Hãy thử Chrome/Edge với tăng tốc đồ hoạ.', true);
  console.error(e);
}
$('cover').addEventListener('click', toggleCover);
$('next').addEventListener('click', () => navigate(1));
$('prev').addEventListener('click', () => navigate(-1));
$('jump-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy || !source) return;
  status('');
  const n = Number($('page').value);
  if (!Number.isInteger(n) || n < 1 || n > source.count) {
    status(`Nhập số trang từ 1 đến ${source.count}.`);
    ui();
    return;
  }
  busy = true;
  ui();
  const previous = cursor;
  cursor = cursorForPage(n, source.count);
  try {
    await showSpread();
    scene.openBook(true);
  } catch {
    cursor = previous;
    status('Không render được trang này. Hãy thử lại.', true);
  } finally {
    busy = false;
    ui();
    $('page').blur();
  }
});
$('zoom-in').addEventListener('click', () => {
  scene.zoomBy(1.2);
  sharpen();
});
$('zoom-out').addEventListener('click', () => scene.zoomBy(1 / 1.2));
async function sharpen() {
  if (scene.targetZoom < 1.35 || busy || quality === 2100) return;
  quality = 2100;
  busy = true;
  hoverToken++;
  hoverDirection = 0;
  ui();
  try {
    await showSpread();
  } catch {
  } finally {
    busy = false;
    ui();
  }
}
$('scene').addEventListener('zoomchange', sharpen);
function objectMode(mode) {
  scene.setObjectMode(mode);
  for (const [id, value] of [
    ['page-mode', 'page'],
    ['move-mode', 'move'],
    ['rotate-mode', 'rotate'],
  ])
    $(id).setAttribute('aria-pressed', String(mode === value));
  $('hint').textContent =
    mode === 'page'
      ? 'Kéo mép trang để giở · Shift + kéo để xoay'
      : mode === 'move'
        ? 'Kéo để nhấc sách · Thả để đặt xuống'
        : 'Kéo để xoay cuốn sách theo mọi hướng';
}
$('page-mode').addEventListener('click', () => objectMode('page'));
$('move-mode').addEventListener('click', () => objectMode('move'));
$('rotate-mode').addEventListener('click', () => objectMode('rotate'));
$('reset-pose').addEventListener('click', () => {
  scene.resetObjectPose();
  objectMode('page');
});
$('view').addEventListener('click', () => scene.setView());
$('light').addEventListener('click', () => {
  night = !night;
  reader.setPreference('night', night);
  lightUI();
});
$('lamp-control').addEventListener('click', () => {
  const open = $('lamp-panel').hidden;
  closePanels();
  setPanel('lamp-panel', open);
  if (open) $('lamp-brightness').focus();
});
$('lamp-brightness').addEventListener('input', (e) => {
  const value = Number(e.target.value);
  lampBrightness = value / 100;
  reader.setPreference('lamp-brightness', lampBrightness);
  scene.setLampBrightness(lampBrightness);
  $('lamp-value').textContent = `${value}%`;
});
$('motion').addEventListener('click', () => {
  reduced = !reduced;
  reader.setPreference('reduced', reduced);
  motionUI();
});
$('bookmark').addEventListener('click', () => {
  if (busy || scene.targetOpen < 0.5) return;
  const n = spreadRange(cursor, source.count).first;
  bookmarks = bookmarks.includes(n)
    ? bookmarks.filter((p) => p !== n)
    : [...bookmarks, n].sort((a, b) => a - b);
  ui();
  status(bookmarks.includes(n) ? `Đã đánh dấu trang ${n}.` : `Đã bỏ đánh dấu trang ${n}.`);
});
$('marks').addEventListener('click', () => {
  const open = $('marks-panel').hidden;
  closePanels();
  setPanel('marks-panel', open);
  if (open) $('marks-close').focus();
});
$('marks-close').addEventListener('click', () => setPanel('marks-panel', false, true));
$('marks-list').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.remove) {
    bookmarks = bookmarks.filter((n) => n !== Number(b.dataset.remove));
    ui();
    return;
  }
  if (b.dataset.page && !busy) {
    $('page').value = b.dataset.page;
    $('jump-form').requestSubmit();
    $('marks-panel').hidden = true;
    $('marks').setAttribute('aria-expanded', 'false');
  }
});
$('sound').addEventListener('click', () => {
  scene.audio = !scene.audio;
  $('sound').setAttribute('aria-pressed', String(scene.audio));
  $('sound').setAttribute('aria-label', scene.audio ? 'Tắt âm giở giấy' : 'Bật âm giở giấy');
  if (scene.audio) scene.rustle();
});
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('studio').requestFullscreen();
  } catch {
    status('Trình duyệt chưa cho phép toàn màn hình.');
  }
});
$('upload').addEventListener('click', () => $('pdf-file').click());
$('pdf-file').addEventListener('change', (e) => loadFile(e.target.files[0]));
$('help').addEventListener('click', () => {
  closePanels();
  $('help-dialog').showModal();
});
document.querySelector('.dialog-close').addEventListener('click', () => $('help-dialog').close());
$('demo').addEventListener('click', async () => {
  $('help-dialog').close();
  await replace(new ReferenceSource());
});
document.addEventListener('pointerdown', (e) => {
  for (const [id, button] of [
    ['lamp-panel', 'lamp-control'],
    ['marks-panel', 'marks'],
  ]) {
    if (!$(id).hidden && !$(id).contains(e.target) && !$(button).contains(e.target))
      setPanel(id, false);
  }
});
document.addEventListener('keydown', (e) => {
  if ($('help-dialog').open) return;
  if (e.key === 'Escape') {
    closePanels(true);
    scene?.cancelPointer?.();
    scene?.clearFlap();
    return;
  }
  if (
    /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    !scene ||
    busy
  )
    return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    navigate(e.key === 'ArrowRight' ? 1 : -1);
    return;
  }
  if (e.key.toLowerCase() === 'g') objectMode('page');
  if (e.key.toLowerCase() === 'c') objectMode('move');
  if (e.key.toLowerCase() === 'r') objectMode('rotate');
  if (e.key === '0') {
    scene.resetObjectPose();
    objectMode('page');
  }
});
let dropDepth = 0;
document.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer.types.includes('Files')) return;
  e.preventDefault();
  dropDepth++;
  $('drop-overlay').hidden = false;
});
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('dragleave', () => {
  if (--dropDepth <= 0) {
    dropDepth = 0;
    $('drop-overlay').hidden = true;
  }
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dropDepth = 0;
  $('drop-overlay').hidden = true;
  const f = [...e.dataTransfer.files].find(
    (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name),
  );
  if (f) loadFile(f);
  else status('Hãy thả một tệp PDF.');
});
$('scene').addEventListener('contextlost', () =>
  status('Kết nối đồ họa bị gián đoạn. Đang chờ trình duyệt khôi phục…', true),
);
$('scene').addEventListener('contextrestored', () => status('Đã khôi phục đồ họa.'));
if (new URLSearchParams(location.search).has('qa')) {
  $('diagnostics').hidden = false;
  setInterval(() => {
    if (!cache || !scene) return;
    const c = cache.stats(),
      s = scene.stats();
    $('diagnostics').textContent =
      `Renderer: ${$('scene').dataset.renderer}\nSource: ${source.kind}\nPages: ${source.count}\nResident: ${c.resident}\nTexture estimate: ${(c.bytes / 1048576).toFixed(1)} MiB\nPage renders: ${c.renders}\nDraw calls: ${s.drawCalls}\nGPU textures: ${s.textures}\nGeometries: ${s.geometries}\nAverage animation frame: ${s.averageFrameMs} ms`;
  }, 500);
}
let idleTimer;
function wakeControls() {
  $('studio').classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    $('studio').classList.add('idle');
  }, 2600);
}
document.addEventListener('pointermove', wakeControls, { passive: true });
document.addEventListener('keydown', wakeControls);
document.addEventListener('pointerdown', wakeControls, { passive: true });
document.addEventListener('focusin', wakeControls);
wakeControls();
window.addEventListener('pagehide', () => {
  remember();
  cache?.dispose();
  source?.destroy();
  scene?.dispose();
});
