import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { PLATFORM_VERSION } from '../shared/releases.js';
let commit = null;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {}
writeFileSync(
  'server/build-info.json',
  JSON.stringify({ version: PLATFORM_VERSION, commit, builtAt: new Date().toISOString() }),
);
