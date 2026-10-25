import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  state,
  saveLocal,
  restoreLocal,
  clearLocal,
  localAlerts,
  loadRecords,
} from '../src/api.js';

test('preferências e alertas persistem apenas no navegador; consulta não envia localização', async () => {
  const values = new Map();
  globalThis.localStorage = {
    setItem: (k, v) => values.set(k, v),
    getItem: (k) => values.get(k),
    removeItem: (k) => values.delete(k),
  };
  const originalFetch = globalThis.fetch;
  try {
    clearLocal();
    state.profile = { country: 'BR', city: 'Recife', lat: -8, lng: -34 };
    state.favorites.add('x');
    state.readAlerts = ['x:1'];
    saveLocal();
    state.profile = {};
    restoreLocal();
    assert.equal(state.profile.city, 'Recife');
    assert.ok(state.favorites.has('x'));
    const items = [
      { id: 'x', revision: 1, kind: 'content', type: 'Notícia', country: 'BR', city: 'Recife' },
      { id: 'y', revision: 1, kind: 'content', type: 'Notícia', country: 'BR', city: 'Salvador' },
    ];
    assert.deepEqual(
      localAlerts(items).map((r) => [r.id, r.read]),
      [['x', true]],
    );
    state.config.features.content = true;
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/records/content');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.body, undefined);
      return { ok: true, json: async () => items };
    };
    assert.equal((await loadRecords('content', { city: 'Recife', lat: -8, lng: -34 })).length, 1);
    clearLocal();
    assert.equal(values.size, 0);
    assert.equal(state.favorites.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.localStorage;
  }
});

test('cache bloqueado mantém uso em memória', () => {
  globalThis.localStorage = {
    setItem() {
      throw new Error('blocked');
    },
  };
  state.profile = { city: 'Recife' };
  saveLocal();
  assert.equal(state.cacheWarning, true);
  assert.equal(state.profile.city, 'Recife');
  delete globalThis.localStorage;
});
