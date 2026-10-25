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
test('CSV normalizado importa, cruza CNPJ com Censo e marca divergências sem publicar', async () => {
  const db = openDatabase(':memory:');
  try {
    const csv =
      'title;cnpj;network;city;state;sourceName;sourceUrl;sourceDate;lat;lng\nEscola Alfa;12345678000190;Privada;Franca;SP;RFB;https://example.org;2026-10-01;-20.5;-47.4';
    const first = await importData(
      db,
      csv,
      { format: 'normalized', kind: 'school' },
      'Importadora',
    );
    assert.equal(first.created, 1);
    const census =
      'NO_ENTIDADE;CO_ENTIDADE;NU_CNPJ_ESCOLA_PRIVADA;NO_MUNICIPIO;SG_UF;TP_DEPENDENCIA;TP_SITUACAO_FUNCIONAMENTO\nEscola Alfa;123456;12345678000190;Franca;SP;4;1';
    const second = await importData(
      db,
      census,
      { format: 'census', sourceDate: '2026-10-02' },
      'Importadora',
    );
    assert.equal(second.updated, 1);
    let school = records(db, 'school', false)[0];
    assert.equal(school.inepCode, '123456');
    assert.equal(school.crosscheck, 'Correspondência por CNPJ');
    assert.equal(records(db, 'school').length, 0);
    await importData(
      db,
      census.replace('Escola Alfa', 'Outro nome'),
      { format: 'census', sourceDate: '2026-10-03' },
      'Importadora',
    );
    school = records(db, 'school', false)[0];
    assert.equal(school.crosscheck, 'Revisão necessária');
    assert.ok(qualityReport(db).some((r) => r.issue.includes('Divergência')));
  } finally {
    db.close();
  }
});
test('importador RFB filtra CNAE e situação cadastral e resolve município', async () => {
  const db = openDatabase(':memory:');
  try {
    const row = Array(30).fill('');
    Object.assign(row, {
      0: '12345678',
      1: '0001',
      2: '90',
      4: 'Escola teste',
      5: '02',
      11: '8513900',
      19: 'SP',
      20: '1234',
    });
    const nonSchool = [...row];
    nonSchool[11] = '9999999';
    const inactive = [...row];
    inactive[5] = '08';
    inactive[0] = '87654321';
    const r = await importData(
      db,
      [row, nonSchool, inactive].map((r) => r.map((v) => `"${v}"`).join(';')).join('\n'),
      { format: 'cnpj', sourceDate: '2026-10-01', municipalities: { 1234: 'Franca' } },
      'Importadora',
    );
    assert.equal(r.created, 1);
    assert.equal(r.skipped, 2);
    assert.equal(records(db, 'school', false)[0].city, 'Franca');
  } finally {
    db.close();
  }
});
test('importador registra erros de linha e conserva registros válidos para revisão', async () => {
  const db = openDatabase(':memory:');
  try {
    const r = await importData(
      db,
      'title;network\nEscola válida;Municipal\nX;Inexistente',
      { format: 'normalized', kind: 'school' },
      'Importadora',
    );
    assert.equal(r.status, 'completed_with_errors');
    assert.equal(r.created, 1);
    assert.equal(r.errors[0].row, 2);
    assert.equal(db.prepare('SELECT count(*) n FROM imports').get().n, 1);
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
test('reimportação idêntica preserva publicação e uma inativação posterior retira a escola', async () => {
  const db = openDatabase(':memory:');
  try {
    const row = Array(30).fill('');
    Object.assign(row, {
      0: '12345678',
      1: '0001',
      2: '90',
      4: 'Escola teste',
      5: '02',
      11: '8513900',
      19: 'SP',
      20: '1234',
    });
    const options = {
      format: 'cnpj',
      sourceDate: '2026-10-01',
      municipalities: { 1234: 'Franca' },
    };
    const content = () => row.map((v) => `"${v}"`).join(';');
    await importData(db, content(), options, 'Importadora');
    const school = records(db, 'school', false)[0];
    publishRecord(db, school.id, 'Curadora');
    const same = await importData(db, content(), options, 'Importadora');
    assert.equal(same.skipped, 1);
    assert.equal(records(db, 'school').length, 1);
    row[5] = '08';
    const changed = await importData(db, content(), options, 'Importadora');
    assert.equal(changed.updated, 1);
    assert.equal(records(db, 'school').length, 0);
    assert.equal(records(db, 'school', false)[0].active, false);
  } finally {
    db.close();
  }
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
