import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import {
  saveOwnerProfile,
  ownerProfileSchema,
  ownerProfile,
} from '../server/modules/owner-profile.js';
import { saveRecord, publishRecord } from '../server/domain.js';
import { statistics, recordQuery } from '../server/modules/statistics.js';
import { buildStatisticsPdf } from '../src/modules/statistics-pdf.js';
import { assistantPanel } from '../src/modules/assistant.js';
import { defaultFeatures } from '../shared/features.js';
import { state } from '../src/api.js';
import { greeting } from '../src/modules/personalization.js';

test('perfil do proprietário persiste separadamente e não aceita SVG ou campos de credenciais', () => {
  const db = openDatabase(':memory:');
  db.prepare('INSERT INTO admin_users VALUES(?,?,?)').run('a', 'Nome anterior', 'hash inalterado');
  const user = { id: 'a', name: 'Nome anterior' };
  const photo = 'data:image/jpeg;base64,/9j/2Q==';
  assert.equal(saveOwnerProfile(db, user, { name: 'Nome novo', avatar: photo }).name, 'Nome novo');
  assert.equal(ownerProfile(db, { ...user, name: 'Nome novo' }).avatar, photo);
  assert.equal(db.prepare('SELECT password FROM admin_users').get().password, 'hash inalterado');
  for (const value of [
    { name: 'A', avatar: 'data:image/svg+xml,<svg/>' },
    { name: 'A', avatar: '', password: 'outro' },
    { name: 'A', avatar: 'data:image/jpeg;base64,YWJj' },
  ])
    assert.throws(() => ownerProfileSchema.parse(value));
  db.close();
});
test('filtros estatísticos preservam supressão de grupos pequenos e não misturam UF ou categoria', async () => {
  const db = openDatabase(':memory:');
  for (const [title, type, uf] of [
    ['SP notícia', 'Notícia', 'SP'],
    ['MG notícia', 'Notícia', 'MG'],
    ['SP norma', 'Legislação', 'SP'],
  ]) {
    const r = saveRecord(
      db,
      'content',
      {
        title,
        type,
        body: 'Conteúdo público',
        summary: 'Explicação em linguagem simples',
        state: uf,
        sourceUrl: 'https://example.org',
        sourceName: 'Fonte',
        sourceDate: '2026-10-28',
      },
      'Editor',
    );
    publishRecord(db, r.id, 'Editor');
    db.prepare('UPDATE records SET first_published_at=? WHERE id=?').run(
      '2026-10-28T12:00:00Z',
      r.id,
    );
  }
  for (let i = 0; i < 5; i++)
    recordQuery(
      db,
      { topic: 'jobs', state: 'SP', statisticsConsent: true },
      Date.parse('2026-10-28T12:00Z'),
    );
  for (let i = 0; i < 4; i++)
    recordQuery(
      db,
      { topic: 'jobs', state: 'MG', statisticsConsent: true },
      Date.parse('2026-10-28T12:00Z'),
    );
  const report = statistics(db, {
    from: '2026-10',
    to: '2026-10',
    state: 'SP',
    category: 'Notícia',
  });
  assert.equal(report.total, 1);
  assert.deepEqual(report.places, [{ label: 'SP', value: 1 }]);
  assert.equal(report.queryTopics[0].value, 5);
  assert.deepEqual(statistics(db, { from: '2026-10', to: '2026-10', state: 'MG' }).queryTopics, []);
  const pdf = await buildStatisticsPdf(report);
  const bytes = Buffer.from(pdf.output('arraybuffer'));
  assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.getNumberOfPages() >= 2);
  db.close();
});
test('consulta exige três confirmações e personalização escapa texto sem enviar nome ao formulário', () => {
  state.config = { features: defaultFeatures(), ai: { interactive: true } };
  state.profile = { name: '<script>teste</script>', state: 'SP' };
  const html = assistantPanel('jobs');
  assert.equal((html.match(/type="checkbox"[^>]*required/g) || []).length, 3);
  assert.match(html, /#\/termos/);
  assert.ok(!html.includes('<script>'));
  assert.match(greeting(), /&lt;script&gt;/);
  state.profile = {};
});
