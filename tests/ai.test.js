import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, records } from '../server/db.js';
import {
  createGemini,
  reserveRequest,
  providerDay,
  questionSchema,
} from '../server/modules/gemini.js';
import { createDailyAI, brazilClock } from '../server/modules/daily-ai.js';
import {
  regionalNews,
  REGIONAL_SOURCES,
  selectDailyNews,
  newsPriority,
} from '../server/modules/regional-news.js';
const config = {
  enabled: true,
  freeConfirmed: true,
  key: 'test-secret',
  model: 'gemini-3.5-flash-lite',
  daily: 10,
  reserve: 3,
  perMinute: 2,
};
test('IA falha fechada e não chama rede sem plano gratuito confirmado, modelo permitido ou busca gratuita', async () => {
  const db = openDatabase(':memory:');
  let network = 0;
  const fetcher = () => {
    network++;
    throw Error();
  };
  for (const extra of [
    { enabled: false },
    { freeConfirmed: false },
    { key: '' },
    { model: 'paid-model' },
  ])
    await assert.rejects(
      createGemini(db, { config: { ...config, ...extra }, fetcher }).generate('Teste'),
    );
  await assert.rejects(
    createGemini(db, { config, fetcher }).generate('Teste', { grounded: true }),
    /gratuitamente/,
  );
  assert.equal(network, 0);
  assert.equal(db.prepare('SELECT count(*) n FROM ai_usage').get().n, 0);
  db.close();
});
test('cota persistente reserva catálogo, conta falhas, limita minuto e protege mudança de dia', () => {
  const db = openDatabase(':memory:');
  const start = Date.parse('2026-10-27T06:55:00Z');
  for (let i = 0; i < 7; i++) reserveRequest(db, config, 'interactive', '', start + i * 61000);
  assert.throws(() => reserveRequest(db, config, 'interactive', '', start + 8 * 61000), /esgotada/);
  for (let i = 7; i < 10; i++) reserveRequest(db, config, 'daily', '', start + i * 61000);
  assert.throws(() => reserveRequest(db, config, 'daily', '', start + 10 * 61000), /esgotada/);
  assert.notEqual(providerDay(start), providerDay(start + 10 * 61000));
  assert.equal(createGemini(db, { config, clock: () => start + 10 * 61000 }).status().used, 10);
  db.close();
  const minuteDb = openDatabase(':memory:');
  reserveRequest(minuteDb, config, 'daily', '', start);
  reserveRequest(minuteDb, config, 'daily', '', start);
  assert.throws(() => reserveRequest(minuteDb, config, 'daily', '', start), /minuto/);
  minuteDb.close();
});
test('falha do provedor consome uma chamada e bloqueia novas requisições sem repetir', async () => {
  const db = openDatabase(':memory:');
  let calls = 0;
  const ai = createGemini(db, {
    config,
    fetcher: async () => {
      calls++;
      return new Response('{}', { status: 429 });
    },
  });
  await assert.rejects(ai.generate('Teste'));
  await assert.rejects(ai.generate('Teste'), /pausada/);
  assert.equal(calls, 1);
  assert.equal(ai.status().used, 1);
  assert.equal(db.prepare('SELECT status FROM ai_usage').get().status, 'failed');
  db.close();
});
const paidConfig = {
  ...config,
  freeConfirmed: false,
  billingMode: 'paid',
  paidConfirmed: true,
  interactiveEnabled: true,
  budgetUsd: 0.2,
};
test('plano pago exige confirmação, preço conhecido e reserva orçamento antes da rede', async () => {
  const db = openDatabase(':memory:');
  let calls = 0;
  const fetcher = async () => {
    calls++;
    throw new Error('timeout');
  };
  for (const extra of [{ paidConfirmed: false }, { model: 'gemini-3.8-flash' }, { budgetUsd: 0 }]) {
    await assert.rejects(
      createGemini(db, { config: { ...paidConfig, ...extra }, fetcher }).generate('Teste', {
        grounded: true,
      }),
    );
  }
  assert.equal(calls, 0);
  const ai = createGemini(db, { config: paidConfig, fetcher });
  await assert.rejects(ai.generate('Teste', { grounded: true }));
  assert.equal(ai.status().spending.estimatedUsd, 0.15);
  await assert.rejects(ai.generate('Teste', { grounded: true }), /orçamento/);
  assert.equal(calls, 1);
  // Reopening the adapter and advancing a month must not replenish the budget.
  await assert.rejects(
    createGemini(db, {
      config: paidConfig,
      fetcher,
      clock: () => Date.now() + 40 * 86400000,
    }).generate('Teste', { grounded: true }),
    /orçamento/,
  );
  db.close();
});
test('contabiliza tokens de raciocínio e buscas; pausa do proprietário impede chamadas', async () => {
  const db = openDatabase(':memory:');
  let calls = 0;
  const fetcher = async (url, opts) => {
    calls++;
    const body = JSON.parse(opts.body);
    assert.deepEqual(body.tools, [{ google_search: {} }]);
    assert.equal(body.generationConfig.maxOutputTokens, 4096);
    return Response.json({
      usageMetadata: { promptTokenCount: 4000, totalTokenCount: 5500 },
      candidates: [
        {
          finishReason: 'STOP',
          content: { parts: [{ text: 'Resposta com fontes.' }] },
          groundingMetadata: {
            webSearchQueries: ['educação Franca', 'educação SP'],
            groundingChunks: [{ web: { uri: 'https://www.gov.br/mec/', title: 'MEC' } }],
            searchEntryPoint: { renderedContent: '<div>Google</div>' },
          },
        },
      ],
    });
  };
  const ai = createGemini(db, { config: paidConfig, fetcher });
  assert.equal(ai.status().interactiveEnabled, true);
  await ai.generate('Teste', { grounded: true });
  assert.equal(ai.status().spending.estimatedUsd, 0.03295);
  assert.equal(ai.status().spending.outputTokens, 1500);
  assert.equal(ai.status().spending.uncertainUsd, 0);
  db.prepare("INSERT INTO metadata VALUES('ai-owner-paused','true')").run();
  await assert.rejects(ai.generate('Teste', { grounded: true }), /administrador/);
  assert.equal(calls, 1);
  db.close();
});
test('migração de contabilidade mantém uso antigo e é idempotente', () => {
  const db = openDatabase(':memory:');
  const columns = db
    .prepare('PRAGMA table_info(ai_usage)')
    .all()
    .map((c) => c.name);
  assert.ok(columns.includes('cost_microusd'));
  assert.ok(columns.includes('billing_mode'));
  db.close();
});
test('perguntas não aceitam coordenadas, email, dados arbitrários ou ausência de consentimento', () => {
  const q = {
    topic: 'news',
    consent: true,
    eligible: true,
    statisticsConsent: true,
    termsVersion: '2026-10-29',
    state: 'SP',
    city: 'Franca',
  };
  assert.equal(questionSchema.parse(q).city, 'Franca');
  for (const extra of [
    { lat: 20 },
    { email: 'test@example.org' },
    { consent: false },
    { eligible: false },
    { statisticsConsent: false },
    { termsVersion: '2026-01-01' },
    { query: 'escola 12345678900' },
    { query: 'https://other.invalid' },
    { model: 'paid' },
  ])
    assert.throws(() => questionSchema.parse({ ...q, ...extra }));
});
const news = (title, state = 'SP', country = 'BR', day = '2026-10-26') => ({
  kind: 'content',
  sourceId: 'test',
  data: {
    title,
    type: 'Notícia',
    sourceUrl: 'https://example.org/' + encodeURIComponent(title),
    sourceName: 'Fonte',
    sourceDate: day,
    state,
    country,
  },
});
test('seleção prioriza Franca e região, SP, Brasil, exterior; limita 20 e não repete notícias', () => {
  const items = [
    news('Exterior', '', 'GB'),
    news('Nacional', ''),
    news('São Paulo', 'SP'),
    news('Escolas em Franca'),
    news('Docentes em Batatais'),
  ];
  const sorted = selectDailyNews(items, new Set(), Date.parse('2026-10-27T12:00Z'));
  assert.deepEqual(
    sorted.map((i) => newsPriority(i.data)),
    [0, 0, 1, 2, 3],
  );
  const many = Array.from({ length: 30 }, (_, i) => news('Escola ' + i));
  assert.equal(selectDailyNews(many, new Set(), Date.parse('2026-10-27')).length, 20);
  assert.equal(
    selectDailyNews(
      [items[0], items[0]],
      new Set([items[0].data.sourceUrl]),
      Date.parse('2026-10-27'),
    ).length,
    0,
  );
  assert.equal(newsPriority(news('Escolas da França', '', 'FR').data), 3);
});
test('feed regional recusa destino inesperado e não replica corpo protegido', () => {
  const rss =
    '<rss><channel><item><title>Escolas em Franca</title><link>https://www.agenciasp.sp.gov.br/educacao/franca/</link><pubDate>Mon, 26 Oct 2026 12:00:00 GMT</pubDate><description>PROTECTED ARTICLE</description></item></channel></rss>';
  const result = regionalNews(rss, REGIONAL_SOURCES[1], Date.parse('2026-10-27'));
  assert.equal(result[0].data.city, 'Franca');
  assert.ok(!JSON.stringify(result).includes('PROTECTED'));
  assert.deepEqual(
    regionalNews(
      rss.replace('https://www.agenciasp.sp.gov.br', 'http://127.0.0.1'),
      REGIONAL_SOURCES[1],
      Date.parse('2026-10-27'),
    ),
    [],
  );
});
test('catálogo inicia às 08h de Brasília uma vez por dia e publica apenas IDs com fonte', async () => {
  const db = openDatabase(':memory:');
  let at = Date.parse('2026-10-27T10:59Z'),
    calls = 0;
  assert.deepEqual(brazilClock(at), { day: '2026-10-27', hour: 7 });
  const gemini = {
    status: () => ({ enabled: true }),
    generate: async (prompt, opts) => {
      calls++;
      assert.equal(opts.json, true);
      assert.ok(!opts.grounded);
      const data = JSON.parse(prompt.split('Dados: ')[1]);
      if (!Array.isArray(data))
        return {
          model: config.model,
          text: JSON.stringify({
            summary:
              'Há quatro referências no catálogo. Os números não representam todos os professores.',
          }),
        };
      return {
        model: config.model,
        text: JSON.stringify({
          items: [
            ...data.map((i) => ({
              id: i.id,
              summary:
                'Resumo limitado ao comunicado oficial disponível. Consulte a referência original para conferir informações e eventuais alterações.',
            })),
            { id: '999', summary: 'Este item não existe nas fontes e não deve ser publicado.' },
          ],
        }),
      };
    },
  };
  const feed =
    '<rss><channel><item><title>Escolas em Franca</title><link>https://www.agenciasp.sp.gov.br/educacao/franca/</link><pubDate>Mon, 26 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>';
  const daily = createDailyAI(db, gemini, {
    clock: () => at,
    fetcher: async (url) =>
      url === 'https://www.agenciasp.sp.gov.br/feed/'
        ? new Response(feed)
        : new Response('', { status: 503 }),
  });
  assert.equal((await daily.run()).skipped, true);
  assert.equal(calls, 0);
  at += 60000;
  assert.equal((await daily.run()).updated, 4);
  assert.equal(calls, 2);
  assert.equal((await daily.run()).skipped, true);
  assert.equal(records(db, 'content').length, 4);
  assert.ok(records(db, 'content').every((r) => r.aiGenerated && r.sourceUrl));
  db.close();
});
