import { readFileSync } from 'node:fs';
import { PLATFORM_VERSION, RELEASES } from '../../shared/releases.js';
import { requirementInfo } from './requirements.js';
export function publicReleaseInfo() {
  return {
    version: PLATFORM_VERSION,
    history: RELEASES.map(({ version, date, title, changes }) => ({
      version,
      date,
      title,
      summary: changes[0] || title,
    })),
  };
}
export function adminReleaseInfo() {
  return { ...releaseInfo(), requirements: requirementInfo() };
}
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
