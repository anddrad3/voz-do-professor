import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  state,
  clearLocal,
  locationFilters,
  toggleFavorite,
  saveLocal,
  restoreLocal,
} from '../src/api.js';
import { catalog } from '../src/modules/catalog.js';
import { assistantPanel } from '../src/modules/assistant.js';
import { nearestCity } from '../src/modules/location.js';
import { clientAddress } from '../server/security.js';
import { openDatabase, records } from '../server/db.js';
import { reserveRequest, questionPrompt } from '../server/modules/gemini.js';
import { createDailyAI } from '../server/modules/daily-ai.js';

test('piso e concursos têm um único formulário, geolocalização e região herdada editável', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => [] });
  try {
    state.config = {
      features: { content: true, contests: true, opportunity: true },
      ai: { interactive: true },
    };
    state.profile = { country: 'BR', state: 'SP', city: 'Franca' };
    state.filters = { content: { type: 'Piso salarial' } };
    for (const kind of ['content', 'contests']) {
      const html = await catalog(kind);
      assert.equal((html.match(/<form /g) || []).length, 1);
      assert.equal((html.match(/name="state"/g) || []).length, 1);
      assert.match(html, /Usar minha localização/);
      assert.match(html, /value="Franca"/);
    }
    state.filters.content = { state: 'MG', city: 'Uberaba' };
    assert.equal(locationFilters('content').city, 'Uberaba');
    assert.equal(locationFilters('contests').city, 'Franca');
    assert.match(assistantPanel('jobs'), /value="Privada" selected/);
  } finally {
    globalThis.fetch = oldFetch;
    clearLocal();
  }
});
test('favorito conserva cópia local e remoção elimina cópia', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  try {
    clearLocal();
    state.records.set('n', { id: 'n', title: 'Notícia', kind: 'content' });
    toggleFavorite('n');
    saveLocal();
    state.savedRecords = [];
    restoreLocal();
    assert.equal(state.savedRecords[0].title, 'Notícia');
    toggleFavorite('n');
    assert.equal(state.savedRecords.length, 0);
  } finally {
    delete globalThis.localStorage;
    clearLocal();
  }
});
test('cidade é aproximada localmente sem enviar GPS', () => {
  const rows = JSON.parse(readFileSync('public/data/municipios.json'));
  const found = nearestCity(rows, -20.5386, -47.4009);
  assert.equal(found.city, 'Franca');
  assert.equal(found.state, 'SP');
  assert.equal(nearestCity(rows, 50, 10), null);
});
test('proxy só é confiável na configuração explícita e exige endereço válido', () => {
  const previous = process.env.TRUST_ALWAYS_DATA_PROXY;
  try {
    const req = { socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-real-ip': '203.0.113.1' } };
    process.env.TRUST_ALWAYS_DATA_PROXY = 'false';
    assert.equal(clientAddress(req), '127.0.0.1');
    process.env.TRUST_ALWAYS_DATA_PROXY = 'true';
    assert.equal(clientAddress(req), '203.0.113.1');
    req.headers['x-real-ip'] = '203.0.113.1, 10.0.0.1';
    assert.equal(clientAddress(req), '127.0.0.1');
  } finally {
    if (previous === undefined) delete process.env.TRUST_ALWAYS_DATA_PROXY;
    else process.env.TRUST_ALWAYS_DATA_PROXY = previous;
  }
});
test('trinta consultas por conexão não alteram teto financeiro nem afetam outra conexão', () => {
  const db = openDatabase(':memory:');
  const c = {
    enabled: true,
    key: 'test',
    model: 'gemini-3.5-flash-lite',
    billingMode: 'paid',
    paidConfirmed: true,
    budgetUsd: 4.5,
    daily: 60,
    reserve: 3,
    perMinute: 6,
    perConnection: 30,
  };
  const start = Date.parse('2026-10-27T14:00Z');
  for (let i = 0; i < 30; i++) {
    const id = reserveRequest(db, c, 'interactive', 'a', start + i * 61000);
    db.prepare('UPDATE ai_usage SET cost_microusd=1000,measured=1 WHERE id=?').run(id);
  }
  assert.throws(
    () => reserveRequest(db, c, 'interactive', 'a', start + 31 * 61000),
    /30 consultas/,
  );
  assert.ok(reserveRequest(db, c, 'interactive', 'b', start + 31 * 61000));
  db.prepare('UPDATE ai_usage SET cost_microusd=4500000 WHERE client=?').run('b');
  assert.throws(() => reserveRequest(db, c, 'interactive', 'c', start + 32 * 61000), /orçamento/);
  db.close();
});
test('reconstrução só substitui notícias e leis após validar resposta, preservando relatos e uso', async () => {
  const db = openDatabase(':memory:');
  const insert = db.prepare(
    "INSERT INTO records(id,kind,data,status,updated_at) VALUES(?,?,?,'published',?)",
  );
  insert.run(
    'old-news',
    'content',
    JSON.stringify({ title: 'Notícia antiga', type: 'Notícia' }),
    '2026-10-20',
  );
  insert.run('story', 'story', JSON.stringify({ title: 'Relato autorizado' }), '2026-10-20');
  db.prepare(
    "INSERT INTO ai_usage(id,day,at,purpose,client,status,billing_mode,cost_microusd) VALUES('u','2026-10-27',1,'daily','','completed','paid',1000)",
  ).run();
  let fails = true;
  const gemini = {
    status: () => ({ enabled: true }),
    generate: async (prompt) => {
      if (fails) throw new Error('offline');
      if (!prompt.includes('Dados: '))
        return {
          text: JSON.stringify({
            summary: 'Há publicações no catálogo. A cobertura depende das fontes.',
          }),
          model: 'test',
        };
      const data = JSON.parse(prompt.split('Dados: ')[1]);
      return {
        text: JSON.stringify({
          items: data.map((i) => ({
            id: i.id,
            summary:
              'Resumo dos dados fornecidos pela fonte oficial, com referência para conferência.',
          })),
        }),
        model: 'test',
      };
    },
  };
  const feed =
    '<rss><channel><item><title>Educação nas escolas de Franca</title><link>https://www.agenciasp.sp.gov.br/educacao/franca/</link><pubDate>Mon, 26 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>';
  const daily = createDailyAI(db, gemini, {
    clock: () => Date.parse('2026-10-27T12:00Z'),
    fetcher: async (url) =>
      url === 'https://www.agenciasp.sp.gov.br/feed/'
        ? new Response(feed)
        : new Response('', { status: 503 }),
  });
  assert.equal((await daily.run({ rebuild: true })).failed, true);
  assert.ok(db.prepare("SELECT id FROM records WHERE id='old-news'").get());
  fails = false;
  const result = await daily.run({ rebuild: true });
  assert.equal(result.removed, 1);
  assert.equal(result.updated, 4);
  assert.equal(records(db, 'content').length, 4);
  assert.equal(records(db, 'story').length, 1);
  assert.equal(db.prepare('SELECT SUM(cost_microusd) n FROM ai_usage').get().n, 1000);
  db.close();
});
