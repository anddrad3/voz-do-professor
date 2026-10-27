import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { saveRecord, publishRecord } from '../server/domain.js';
import { defaultFeatures } from '../shared/features.js';
import { setFeatures } from '../server/modules/settings.js';
import {
  statistics,
  recordQuery,
  periodSchema,
  defaultPeriod,
  updateStatisticsInsight,
} from '../server/modules/statistics.js';
const at = Date.parse('2026-10-27T12:00Z');
const period = { from: '2026-10', to: '2026-10' };
const q = {
  statisticsConsent: true,
  topic: 'jobs',
  state: 'SP',
  city: 'Franca',
  query: 'vaga docente',
};

test('estatísticas de consultas são opt-in, agregadas e não guardam textos ou localização precisa', () => {
  const db = openDatabase(':memory:');
  recordQuery(db, { ...q, statisticsConsent: false }, at);
  assert.equal(db.prepare('SELECT count(*) n FROM statistics_queries').get().n, 0);
  for (let i = 0; i < 4; i++) recordQuery(db, q, at);
  assert.deepEqual(statistics(db, period).queryTopics, []);
  assert.deepEqual(statistics(db, period).queryPlaces, []);
  recordQuery(db, q, at);
  assert.equal(statistics(db, period).queryTopics[0].value, 5);
  assert.deepEqual(statistics(db, period).queryPlaces, [{ label: 'SP', value: 5 }]);
  const stored = JSON.stringify(db.prepare('SELECT * FROM statistics_queries').all());
  assert.ok(!stored.includes('Franca') && !stored.includes('vaga docente'));
  assert.equal(db.prepare('SELECT count(*) n FROM statistics_queries').get().n, 1);
  setFeatures(db, { ...defaultFeatures(), statistics: false });
  recordQuery(db, q, at);
  assert.equal(db.prepare('SELECT total FROM statistics_queries').get().total, 5);
  db.close();
});
test('períodos validam meses, ordem e máximo de 24 meses', () => {
  for (const invalid of [
    { from: '2026-13', to: '2026-14' },
    { from: '2026-11', to: '2026-10' },
    { from: '2023-01', to: '2026-10' },
    { ...period, city: 'Franca' },
  ])
    assert.throws(() => periodSchema.parse(invalid));
  assert.deepEqual(defaultPeriod(at), { from: '2025-11', to: '2026-10' });
});
test('catálogo estatístico não inclui rascunhos, exemplos, arquivados ou ferramentas desativadas', () => {
  const db = openDatabase(':memory:');
  const draft = saveRecord(
    db,
    'story',
    { title: 'Rascunho', body: 'Texto reservado', consent: true },
    'Admin',
  );
  const published = saveRecord(
    db,
    'story',
    { title: 'Público', body: 'Relato público', consent: true },
    'Admin',
  );
  publishRecord(db, published.id, 'Admin');
  db.prepare('UPDATE records SET first_published_at=? WHERE id=?').run(
    '2026-10-20T12:00Z',
    published.id,
  );
  assert.equal(statistics(db, period).stories, 1);
  assert.equal(statistics(db, { from: '2026-09', to: '2026-09' }).stories, 0);
  setFeatures(db, { ...defaultFeatures(), voice: false });
  assert.equal(statistics(db, period).total, 0);
  setFeatures(db, defaultFeatures());
  db.prepare("UPDATE records SET status='archived' WHERE id=?").run(published.id);
  assert.equal(statistics(db, period).total, 0);
  assert.ok(draft.id);
  db.close();
});
test('IA recebe apenas contagens, não relatos; interpretação antiga não é exibida para números diferentes', async () => {
  const db = openDatabase(':memory:');
  const story = saveRecord(
    db,
    'story',
    { title: 'Título privado no prompt', body: 'Texto que nunca deve ser enviado', consent: true },
    'Admin',
  );
  publishRecord(db, story.id, 'Admin');
  db.prepare('UPDATE records SET first_published_at=? WHERE id=?').run(
    '2026-10-20T12:00Z',
    story.id,
  );
  let calls = 0;
  const gemini = {
    generate: async (prompt, opts) => {
      calls++;
      assert.ok(!prompt.includes('Texto que nunca') && !prompt.includes('Título privado'));
      assert.ok(!opts.grounded);
      return {
        model: 'gemini-3.5-flash-lite',
        text: JSON.stringify({
          summary:
            'O catálogo tem um relato publicado. A amostra é parcial e não representa todos os professores.',
        }),
      };
    },
  };
  assert.equal((await updateStatisticsInsight(db, gemini, at)).updated, true);
  assert.ok(statistics(db, defaultPeriod(at)).insight);
  assert.equal(statistics(db, period).insight, null);
  await updateStatisticsInsight(db, gemini, at);
  assert.equal(calls, 1);
  db.prepare("UPDATE records SET status='archived' WHERE id=?").run(story.id);
  assert.equal(statistics(db, defaultPeriod(at)).insight, null);
  db.close();
});
