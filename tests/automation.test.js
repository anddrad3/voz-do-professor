import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, records } from '../server/db.js';
import {
  parseSource,
  locateTitle,
  saveAutomatic,
  createAutomation,
  boundedFetch,
  SOURCES,
} from '../server/modules/automation.js';
import { filterRecords, opportunityStatus } from '../shared/filter.js';
import { readFileSync } from 'node:fs';
test('RSS publica metadados com fonte sem corpo HTML ou pixels', () => {
  const items = parseSource(
    'ebc',
    '<rss><channel><item><title>Recife abre novas escolas</title><link>https://agenciabrasil.ebc.com.br/noticia</link><pubDate>Sat, 24 Oct 2026 12:00:00 GMT</pubDate><description><![CDATA[<script>secret</script><img src="https://tracker.invalid">FULL BODY]]></description></item></channel></rss>',
    [{ name: 'Recife', state: 'PE' }],
  );
  assert.equal(items[0].data.city, 'Recife');
  assert.equal(items[0].data.state, 'PE');
  assert.equal(items[0].data.country, 'BR');
  assert.ok(!JSON.stringify(items).includes('FULL BODY'));
  assert.ok(!JSON.stringify(items).includes('tracker'));
  assert.throws(() => parseSource('ebc', '<!DOCTYPE rss><rss/>'));
});
test('localidade ambígua não é atribuída', () => {
  const recife = locateTitle('Recife abrirá creches para facilitar o voto', [
    { name: 'Recife', state: 'PE' },
  ]);
  assert.equal(recife.city, 'Recife');
  assert.equal(recife.state, 'PE');
  assert.equal(locateTitle('Nova verba para escolas').state, '');
  assert.equal(locateTitle('Novas escolas no Pará').state, 'PA');
  assert.equal(
    locateTitle('Novas escolas em Santa Maria', [
      { name: 'Santa Maria', state: 'RS' },
      { name: 'Santa Maria', state: 'RN' },
    ]).city,
    '',
  );
  const [r] = parseSource(
    'govuk',
    JSON.stringify({
      results: [
        {
          title: 'New education funding',
          link: '/government/news/education',
          public_timestamp: '2026-10-24',
        },
      ],
    }),
  );
  assert.equal(r.data.country, 'GB');
  assert.equal(r.data.city, undefined);
});
test('vagas não inventam prazo, salário em reais ou vínculo CNPJ', () => {
  const list = parseSource(
    'jobicy',
    JSON.stringify({
      jobs: [
        {
          jobTitle: 'Teacher',
          companyName: 'Academy',
          url: 'https://jobicy.com/jobs/1',
          jobGeo: 'Anywhere',
          pubDate: '2026-10-24',
          salaryCurrency: 'USD',
          annualSalaryMin: 90000,
        },
      ],
    }),
  );
  assert.equal(list[0].data.salary, null);
  assert.equal(list[0].data.closes, '');
  assert.equal(opportunityStatus(list[0].data), 'Consultar na fonte');
  assert.equal(list[0].data.cnpj, undefined);
  assert.equal(
    parseSource(
      'remotive',
      JSON.stringify({
        jobs: [
          { title: 'Software Engineer', url: 'https://remotive.com/x' },
          { title: 'English Teacher', url: 'https://remotive.com/y' },
        ],
      }),
    ).length,
    1,
  );
});
test('importação é idempotente e respeita retirada manual', () => {
  const db = openDatabase(':memory:');
  try {
    const [item] = parseSource(
      'govuk',
      JSON.stringify({
        results: [
          { title: 'Education funding test', link: '/news/test', public_timestamp: '2026-10-24' },
        ],
      }),
    );
    assert.equal(saveAutomatic(db, item.kind, item.data, 'govuk'), true);
    assert.equal(saveAutomatic(db, item.kind, item.data, 'govuk'), false);
    assert.equal(records(db, 'content').length, 1);
    db.prepare("UPDATE records SET status='archived'").run();
    assert.equal(
      saveAutomatic(db, item.kind, { ...item.data, title: 'Changed title' }, 'govuk'),
      false,
    );
    assert.equal(records(db, 'content').length, 0);
  } finally {
    db.close();
  }
});
test('falhas preservam cache e respeitam intervalo de fontes', async () => {
  const db = openDatabase(':memory:');
  let calls = 0;
  const automation = createAutomation(db, {
    fetcher: async () => {
      calls++;
      return new Response('unavailable', { status: 503 });
    },
  });
  try {
    await automation.run();
    const initial = calls;
    await automation.run();
    assert.ok(calls <= initial + 1);
    assert.equal(
      db.prepare("SELECT count(*) n FROM imports WHERE status='failed'").get().n,
      SOURCES.length,
    );
  } finally {
    automation.stop();
    db.close();
  }
});
test('respostas externas têm tamanho limitado', async () => {
  await assert.rejects(
    () =>
      boundedFetch('https://example.test', {
        maxBytes: 10,
        fetcher: async () => new Response('12345678901234567890'),
      }),
    /limite/,
  );
});
test('busca, país, estado, cidade, CNAE e distância se combinam', () => {
  const items = [
    {
      id: 'a',
      kind: 'school',
      title: 'Escola São José',
      country: 'BR',
      state: 'SP',
      city: 'Franca',
      cnae: '8512100',
      network: 'Privada',
      lat: -20.5,
      lng: -47.4,
    },
    {
      id: 'b',
      kind: 'school',
      title: 'School London',
      country: 'GB',
      city: 'London',
      cnae: '',
      network: 'Privada',
      lat: 51.5,
      lng: 0,
    },
  ];
  assert.deepEqual(
    filterRecords(items, {
      q: 'sao jose',
      country: 'BR',
      state: 'SP',
      city: 'Franca',
      cnae: '85',
      network: 'Privada',
      radius: 5,
      lat: -20.5,
      lng: -47.4,
    }).map((r) => r.id),
    ['a'],
  );
  assert.deepEqual(
    filterRecords(items, { country: 'GB' }).map((r) => r.id),
    ['b'],
  );
  assert.equal(filterRecords(items, { city: 'Santos' }).length, 0);
  assert.throws(() => filterRecords(items, { radius: 5, lat: '', lng: '' }));
});
test('frontend público não usa contas nem painel e não transmite filtros', () => {
  const app = readFileSync('src/app.js', 'utf8'),
    api = readFileSync('src/api.js', 'utf8');
  assert.ok(!app.includes('/account/'));
  assert.ok(!app.includes("from './modules/admin.js'"));
  assert.ok(!api.includes('URLSearchParams'));
  assert.match(api, /credentials:\s*'omit'/);
});
