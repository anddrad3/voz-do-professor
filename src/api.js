export const state = {
  user: null,
  csrf: null,
  config: {},
  favorites: new Set(),
  records: new Map(),
  filters: {},
  adminTab: 'content',
  adminEdit: null,
  map: null,
  calendarOffset: 0,
};
export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.csrf ? { 'X-CSRF-Token': state.csrf } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('O servidor não respondeu. Confira se o serviço está em execução.');
  }
  if (!response.ok) throw new Error(data.error || 'Falha na solicitação.');
  return data;
}
export async function loadRecords(kind, query = {}) {
  const q = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null));
  const result = await api(`/records/${kind}?${q}`);
  result.forEach((r) => state.records.set(r.id, r));
  return result;
}
