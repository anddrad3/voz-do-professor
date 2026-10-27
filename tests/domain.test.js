import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, records, unpack } from '../server/db.js';
import {
  saveRecord,
  publishRecord,
  distanceKm,
  filterRecords,
  opportunityStatus,
  qualityReport,
} from '../server/domain.js';
import { importData } from '../server/modules/imports.js';
import { hash, passwordHash, passwordMatches } from '../server/security.js';
const base = {
  title: 'Publicação de teste',
  sourceName: 'Fonte oficial de teste',
  sourceUrl: 'https://example.org/edital',
  sourceDate: '2026-10-01',
};
test('ciclo editorial exige fonte e resumo, audita publicação e retira edição de circulação', () => {
  const db = openDatabase(':memory:');
  try {
    const draft = saveRecord(
      db,
      'content',
      { title: 'Norma teste', type: 'Legislação' },
      'Editora',
    );
    assert.throws(() => publishRecord(db, draft.id, 'Revisora'), /fonte/);
    saveRecord(db, 'content', { ...base, type: 'Legislação' }, 'Editora', draft.id);
    assert.throws(() => publishRecord(db, draft.id, 'Revisora'), /explicador/);
    saveRecord(
      db,
      'content',
      { ...base, type: 'Legislação', summary: 'Explicação acessível' },
      'Editora',
      draft.id,
    );
    const item = publishRecord(db, draft.id, 'Revisora');
    assert.equal(item.reviewer, 'Revisora');
    assert.equal(records(db, 'content').length, 1);
    saveRecord(
      db,
      'content',
      { ...base, type: 'Legislação', summary: 'Texto atualizado' },
      'Editora',
      draft.id,
    );
    assert.equal(records(db, 'content').length, 0);
    assert.equal(
      db.prepare("SELECT count(*) n FROM revisions WHERE action='published'").get().n,
      1,
    );
  } finally {
    db.close();
  }
});
test('distância, busca sem acentos e filtros acumulados excluem coordenadas ausentes', () => {
  assert.ok(distanceKm(-20.5, -47.4, -20.51, -47.4) < 2);
  const schools = [
    {
      id: 'near',
      kind: 'school',
      title: 'Educação',
      city: 'Franca',
      state: 'SP',
      network: 'Municipal',
      lat: -20.5,
      lng: -47.4,
    },
    {
      id: 'far',
      kind: 'school',
      title: 'Educação',
      city: 'Franca',
      state: 'SP',
      network: 'Municipal',
      lat: -23,
      lng: -47,
    },
    {
      id: 'missing',
      kind: 'school',
      title: 'Educação',
      city: 'Franca',
      state: 'SP',
      network: 'Municipal',
      lat: null,
      lng: null,
    },
  ];
  assert.deepEqual(
    filterRecords(schools, {
      q: 'educacao',
      city: 'franca',
      network: 'Municipal',
      radius: 5,
      lat: -20.5,
      lng: -47.4,
    }).map((s) => s.id),
    ['near'],
  );
  assert.throws(() => filterRecords(schools, { radius: 10 }), /coordenadas/);
  assert.equal(filterRecords(schools, { network: 'Privada' }).length, 0);
});
test('situação do edital trata limites de datas e alterações de estágio', () => {
  const o = { opens: '2026-10-01', closes: '2026-10-20', stage: 'Automático' };
  assert.equal(opportunityStatus(o, '2026-09-30'), 'Futuro');
  assert.equal(opportunityStatus(o, '2026-10-20'), 'Inscrições abertas');
  assert.equal(opportunityStatus(o, '2026-10-21'), 'Encerrado');
  assert.equal(opportunityStatus({ ...o, stage: 'Suspenso' }, '2026-10-10'), 'Suspenso');
});
test('valida URLs perigosas, datas invertidas e objetos com campos inesperados', () => {
  const db = openDatabase(':memory:');
  try {
    assert.throws(() =>
      saveRecord(
        db,
        'content',
        { ...base, type: 'Notícia', sourceUrl: 'javascript:alert(1)' },
        'Teste',
      ),
    );
    assert.throws(() =>
      saveRecord(db, 'content', { ...base, type: 'Notícia', unexpected: 1 }, 'Teste'),
    );
    assert.throws(() =>
      saveRecord(
        db,
        'opportunity',
        {
          ...base,
          type: 'Concurso público',
          discipline: 'História',
          level: 'Todos',
          education: 'Licenciatura',
          requirements: 'Diploma',
          opens: '2026-10-20',
          closes: '2026-10-01',
        },
        'Teste',
      ),
    );
  } finally {
    db.close();
  }
});
test('importação do Radar foi removida e rejeita bases antigas', async () => {
  const db = openDatabase(':memory:');
  try {
    for (const options of [
      { format: 'cnpj' },
      { format: 'census' },
      { format: 'normalized', kind: 'school' },
    ])
      await assert.rejects(importData(db, '', options, 'Admin'), /Radar removida/);
  } finally {
    db.close();
  }
});

test('senha administrativa usa salt e rejeita credenciais incorretas', async () => {
  const a = await passwordHash('senha longa de teste'),
    b = await passwordHash('senha longa de teste');
  assert.notEqual(a, b);
  assert.ok(await passwordMatches('senha longa de teste', a));
  assert.equal(await passwordMatches('senha incorreta', a), false);
  assert.equal(await passwordMatches('senha', 'corrompido'), false);
});
test('editais normalizados reimportados não duplicam e mudanças reais criam revisão', async () => {
  const db = openDatabase(':memory:');
  try {
    const csv =
      'title;type;discipline;level;education;requirements;opens;closes;sourceName;sourceUrl;sourceDate\nEdital teste;Concurso público;História;Ensino Fundamental;Licenciatura;Diploma;2026-10-01;2026-10-30;Fonte;https://example.org/edital;2026-10-01';
    const opts = { kind: 'opportunity', format: 'normalized' };
    await importData(db, csv, opts, 'Importadora');
    const item = records(db, 'opportunity', false)[0];
    publishRecord(db, item.id, 'Curadora');
    assert.equal((await importData(db, csv, opts, 'Importadora')).skipped, 1);
    assert.equal(
      (await importData(db, csv.replace('2026-10-30', '2026-11-30'), opts, 'Importadora')).updated,
      1,
    );
    assert.equal(records(db, 'opportunity', false).length, 1);
    assert.equal(records(db, 'opportunity', false)[0].revision, 2);
  } finally {
    db.close();
  }
});
