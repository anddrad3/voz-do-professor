import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
for (const file of [
  'vite.config.js',
  ...['src', 'server', 'scripts', 'tests'].flatMap(walk),
].filter((f) => /\.(js|mjs)$/.test(f))) {
  const r = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
}
console.log('Sintaxe JavaScript validada.');
