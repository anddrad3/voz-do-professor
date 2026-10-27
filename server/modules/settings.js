import { defaultFeatures } from '../../shared/features.js';
export function settings(db) {
  let saved = {};
  try {
    saved = JSON.parse(
      db.prepare("SELECT value FROM metadata WHERE key='site-settings-v2'").get()?.value || '{}',
    );
  } catch {}
  const defaults = defaultFeatures();
  if (
    saved.features &&
    Object.values(saved.features).length &&
    Object.values(saved.features).every((v) => v === false)
  )
    Object.keys(defaults).forEach((k) => (defaults[k] = false));
  return {
    features: { ...defaults, ...saved.features },
    contactEmail: process.env.REPORT_EMAIL || 'relatos@exemplo.invalid',
  };
}
export function setFeatures(db, features) {
  const current = settings(db);
  db.prepare(
    "INSERT INTO metadata(key,value) VALUES('site-settings-v2',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run(JSON.stringify({ ...current, features }));
  return settings(db);
}
