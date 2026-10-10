import { canvas } from './pages.mjs';
const pages = [
  'source.3johz36l3vgvu.webp',
  'source.20zjk78s-v4tb.webp',
  'source.2do_5ylfmwzim.webp',
  'source.1wxgnxua2rs60.webp',
  'source.2r9bec016u4d7.webp',
  'source.06umapw54bn3-.webp',
  'source.1zk6fayyj3ycc.webp',
  'source.20lyuk-rcisp0.webp',
  'source.1lew2a1x586nn.webp',
  'source.0loyupgd-llv3.webp',
  'source.2v4e83owsai-b.webp',
  'source.1u0_7tltzl8fb.webp',
  'source.01w72glyg2__s.webp',
  'source.31q1b48s9nf5a.webp',
  'source.0-wwe74rvfh03.webp',
  'source.35xazubcdw-23.webp',
  'source.11yz8cwgt9wpl.webp',
  'source.125upruoa8tj2.webp',
  'source.0xwfz71_undyc.webp',
  'source.41fz5m5jze7at.webp',
  'source.1fq2qhku_44ek.webp',
  'source.1b0211hm-3j8-.webp',
  'source.1kjldpjgis18k.webp',
  'source.04wapydx8ugdm.webp',
];
export class ReferenceSource {
  constructor() {
    this.count = pages.length;
    this.aspect = 3306 / 2400;
    this.title = 'Paper Mono';
    this.kind = 'reference';
    this.dead = false;
    this.abort = new AbortController();
  }
  async render(index, width) {
    if (this.dead) throw new Error('Document replaced');
    const response = await fetch(new URL('../assets/paper-mono/' + pages[index], import.meta.url), {
      signal: this.abort.signal,
    });
    if (!response.ok) throw new Error('Reference page unavailable');
    const image = await createImageBitmap(await response.blob());
    try {
      if (this.dead) throw new Error('Document replaced');
      const c = canvas(width, Math.round(width * this.aspect));
      c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
      return c;
    } finally {
      image.close();
    }
  }
  async destroy() {
    this.dead = true;
    this.abort.abort();
  }
}
