import { filterRecords, normalize } from '../shared/filter.js';
export const state = {
  config: { features: {} },
  favorites: new Set(),
  savedRecords: [],
  records: new Map(),
  filters: {},
  map: null,
  calendarOffset: 0,
  profile: {},
  preferences: { opportunities: true, news: true, legislation: true },
  readAlerts: [],
  chats: [],
  cacheWarning: false,
  view: 'grid',
};
const KEY = 'voz-local-v2';
export function restoreLocal() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    state.favorites = new Set(Array.isArray(v.favorites) ? v.favorites : []);
    state.profile = v.profile || {};
    state.savedRecords = Array.isArray(v.savedRecords)
      ? v.savedRecords.filter((r) => r && typeof r.id === 'string').slice(-100)
      : [];
    state.view = v.view === 'list' ? 'list' : 'grid';
    state.preferences = { ...state.preferences, ...v.preferences };
    state.readAlerts = Array.isArray(v.readAlerts) ? v.readAlerts : [];
    state.chats = Array.isArray(v.chats)
      ? v.chats
          .filter(
            (c) =>
              c &&
              typeof c.text === 'string' &&
              Date.parse(c.generatedAt) > Date.now() - 90 * 86400000,
          )
          .slice(-20)
      : [];
  } catch {
    state.cacheWarning = true;
  }
}
export function saveLocal() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        favorites: [...state.favorites],
        profile: state.profile,
        savedRecords: state.savedRecords,
        view: state.view,
        preferences: state.preferences,
        readAlerts: state.readAlerts.slice(-1000),
        chats: state.chats,
      }),
    );
  } catch {
    state.cacheWarning = true;
  }
}
export function clearLocal() {
  state.favorites.clear();
  state.savedRecords = [];
  state.profile = {};
  state.view = 'grid';
  state.preferences = { opportunities: true, news: true, legislation: true };
  state.readAlerts = [];
  state.chats = [];
  state.filters = {};
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem('voz-theme');
    localStorage.removeItem('voz-terms-accepted');
  } catch {}
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('voz-local-cleared'));
}
export const enabled = (k) => state.config.features?.[k] === true;
export async function api(path) {
  const r = await fetch(`${import.meta.env?.BASE_URL || '/'}api${path}`, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!r.ok) throw new Error('Conteúdo indisponível. Tente novamente mais tarde.');
  return r.json();
}
export async function loadRecords(kind, query = {}) {
  if (!enabled(kind === 'story' ? 'voice' : kind)) return [];
  const result = await api(`/records/${kind}`);
  result.forEach((r) => state.records.set(r.id, r));
  const filtered = filterRecords(result, query);
  if (kind === 'content')
    filtered.sort(
      (a, b) =>
        (b.firstPublishedAt || b.updatedAt || '')
          .slice(0, 10)
          .localeCompare((a.firstPublishedAt || a.updatedAt || '').slice(0, 10)) ||
        (a.editorialPriority ?? 2) - (b.editorialPriority ?? 2),
    );
  return filtered;
}
export function localAlerts(items) {
  const p = state.profile,
    prefs = state.preferences;
  return items
    .filter((r) => {
      if (
        r.kind === 'opportunity'
          ? !prefs.opportunities
          : r.type === 'Notícia'
            ? !prefs.news
            : !prefs.legislation
      )
        return false;
      if (p.country && r.country && normalize(p.country) !== normalize(r.country)) return false;
      if (p.state && r.state && normalize(p.state) !== normalize(r.state)) return false;
      if (p.city && r.city && normalize(p.city) !== normalize(r.city)) return false;
      if (
        r.kind === 'opportunity' &&
        p.discipline &&
        r.discipline !== 'Todas' &&
        !normalize(r.discipline + ' ' + r.title).includes(normalize(p.discipline))
      )
        return false;
      if (
        r.kind === 'opportunity' &&
        Number(p.radius) > 0 &&
        !filterRecords([r], { radius: p.radius, lat: p.lat, lng: p.lng }).length
      )
        return false;
      return true;
    })
    .map((r) => ({
      ...r,
      alertKey: `${r.id}:${r.revision}`,
      read: state.readAlerts.includes(`${r.id}:${r.revision}`),
    }));
}
restoreLocal();

export function locationFilters(kind) {
  return {
    country: state.profile.country || '',
    state: state.profile.state || '',
    city: state.profile.city || '',
    ...(state.filters[kind] || {}),
  };
}
export function toggleFavorite(id) {
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
    state.savedRecords = state.savedRecords.filter((r) => r.id !== id);
  } else {
    state.favorites.add(id);
    const record = state.records.get(id);
    if (record)
      state.savedRecords = [
        ...state.savedRecords.filter((r) => r.id !== id),
        { ...record, savedAt: new Date().toISOString() },
      ].slice(-100);
  }
  saveLocal();
}
