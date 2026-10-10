export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export class PdfSource {
  static async from(data, title) {
    const pdfjs = await import('../vendor/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      '../vendor/pdf.worker.min.mjs',
      import.meta.url,
    ).href;
    const source = new PdfSource();
    source.tasks = new Set();
    source.loading = pdfjs.getDocument({
      data,
      cMapUrl: new URL('../vendor/cmaps/', import.meta.url).href,
      cMapPacked: true,
      standardFontDataUrl: new URL('../vendor/standard_fonts/', import.meta.url).href,
      wasmUrl: new URL('../vendor/wasm/', import.meta.url).href,
    });
    try {
      source.pdf = await source.loading.promise;
      const first = await source.pdf.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      source.aspect = vp.height / vp.width;
      source.count = source.pdf.numPages;
      source.title = title.replace(/\.pdf$/i, '');
      source.kind = 'pdf';
      source.dead = false;
      return source;
    } catch (e) {
      await source.loading.destroy();
      throw e;
    }
  }
  async render(index, width) {
    if (this.dead) throw new Error('Document replaced');
    if (index < 0 || index >= this.count) throw new RangeError('Page outside document');
    const page = await this.pdf.getPage(index + 1);
    if (this.dead) throw new Error('Document replaced');
    const base = page.getViewport({ scale: 1 });
    const targetHeight = Math.min(Math.round(width * this.aspect), 4096);
    const scale = Math.min(width / base.width, targetHeight / base.height);
    const viewport = page.getViewport({ scale });
    const renderCanvas = canvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const task = page.render({
      canvasContext: renderCanvas.getContext('2d', { alpha: false }),
      viewport,
    });
    this.tasks.add(task);
    try {
      await task.promise;
      if (this.dead) throw new Error('Document replaced');
      const out = canvas(width, targetHeight),
        g = out.getContext('2d', { alpha: false });
      g.fillStyle = 'white';
      g.fillRect(0, 0, out.width, out.height);
      g.drawImage(
        renderCanvas,
        (out.width - renderCanvas.width) / 2,
        (out.height - renderCanvas.height) / 2,
      );
      return out;
    } finally {
      this.tasks.delete(task);
      renderCanvas.width = renderCanvas.height = 0;
      page.cleanup();
    }
  }
  async destroy() {
    this.dead = true;
    for (const t of this.tasks) t.cancel();
    await this.loading.destroy();
  }
}
