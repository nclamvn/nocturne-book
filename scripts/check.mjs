import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const paths = [];
for (const folder of ['src', 'tests', 'scripts']) {
  for (const file of await readdir(resolve(root, folder))) {
    if (file.endsWith('.mjs')) paths.push(resolve(root, folder, file));
  }
}
for (const path of paths) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  const source = await readFile(path, 'utf8');
  for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g)) {
    await access(resolve(dirname(path), match[1]));
  }
}
const html = await readFile(resolve(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (!/^(?:https?:|\.\/)/.test(match[1])) await access(resolve(root, match[1]));
}
const provenance = JSON.parse(
  await readFile(resolve(root, 'assets/paper-mono/provenance.json'), 'utf8'),
);
for (const asset of provenance.assets) await access(resolve(root, asset.local ?? asset.path));
console.log(`Syntax and local module/HTML asset links checked: ${paths.length} files.`);
