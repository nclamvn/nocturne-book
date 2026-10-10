import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('featured release includes the exact original Khởi Nguồn PDF and its attribution', async () => {
  const base = new URL('../assets/books/', import.meta.url);
  const info = JSON.parse(await readFile(new URL('book.json', base), 'utf8'));
  const pdf = await readFile(new URL(info.file, base));
  assert.equal(info.title, 'Khởi Nguồn');
  assert.equal(info.author, 'Nguyễn Cảnh Lâm');
  assert.equal(info.pages, 360);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal(pdf.length, 2948055);
  assert.equal(
    createHash('sha256').update(pdf).digest('hex'),
    'd783ee55c1de1e29bfc719d67899b97e1b443c73315d481263b39857dd43aa9a',
  );
  assert.equal(info.sha256, createHash('sha256').update(pdf).digest('hex'));
  assert.match(await readFile(new URL('RIGHTS.md', base), 'utf8'), /Nguyễn Cảnh Lâm/);
});
