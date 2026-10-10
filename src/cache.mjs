/** Bounded residency. Callers pin any entry still referenced by a material. */
export class PageCache {
  constructor(source, createTexture, { maxEntries = 8, maxBytes = 256 * 1024 * 1024 } = {}) {
    Object.assign(this, { source, createTexture, maxEntries, maxBytes });
    this.entries = new Map();
    this.pending = new Map();
    this.pinned = new Set();
    this.closed = false;
    this.renders = 0;
    this.bytes = 0;
  }
  key(index, width) {
    return `${index}:${width}`;
  }
  pin(keys) {
    this.pinned = new Set(keys);
    this.trim();
  }
  async get(index, width) {
    const key = this.key(index, width);
    let entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
      return entry;
    }
    if (this.pending.has(key)) return this.pending.get(key);
    const task = (async () => {
      const canvas = await this.source.render(index, width);
      if (this.closed) {
        canvas.width = canvas.height = 0;
        throw new Error('Document replaced');
      }
      const texture = this.createTexture(canvas);
      entry = {
        key,
        index,
        width,
        canvas,
        texture,
        bytes: Math.ceil((canvas.width * canvas.height * 4 * 4) / 3),
      };
      this.entries.set(key, entry);
      this.bytes += entry.bytes;
      this.renders++;
      this.trim();
      return entry;
    })();
    this.pending.set(key, task);
    try {
      return await task;
    } finally {
      this.pending.delete(key);
    }
  }
  trim() {
    for (const [key, e] of this.entries) {
      if (this.entries.size <= this.maxEntries && this.bytes <= this.maxBytes) break;
      if (this.pinned.has(key)) continue;
      this.remove(key, e);
    }
  }
  remove(key, e) {
    this.entries.delete(key);
    this.bytes -= e.bytes;
    e.texture.dispose();
    e.canvas.width = e.canvas.height = 0;
  }
  dispose() {
    this.closed = true;
    for (const [key, e] of this.entries) this.remove(key, e);
    this.pinned.clear();
    this.bytes = 0;
  }
  stats() {
    return {
      resident: this.entries.size,
      bytes: Math.round(this.bytes),
      renders: this.renders,
      pending: this.pending.size,
    };
  }
}
