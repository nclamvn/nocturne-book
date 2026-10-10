import { PdfSource } from './pages.mjs';
import { documentId } from './reader-state.mjs';

export async function loadFeaturedBook() {
  const response = await fetch(new URL('../assets/books/khoi-nguon.pdf', import.meta.url));
  if (!response.ok) throw new Error('Featured book unavailable');
  const data = new Uint8Array(await response.arrayBuffer());
  const id = await documentId(data);
  const source = await PdfSource.from(data, 'Khởi Nguồn.pdf');
  source.id = id;
  source.featured = true;
  source.author = 'Nguyễn Cảnh Lâm';
  return source;
}
