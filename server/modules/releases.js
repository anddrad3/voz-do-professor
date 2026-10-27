import { readFileSync } from 'node:fs';
import { PLATFORM_VERSION, RELEASES } from '../../shared/releases.js';
export function releaseInfo() {
  let build = {};
  try {
    build = JSON.parse(readFileSync(new URL('../build-info.json', import.meta.url), 'utf8'));
  } catch {}
  return {
    version: PLATFORM_VERSION,
    commit: build.commit || null,
    builtAt: build.builtAt || null,
    history: RELEASES,
  };
}
