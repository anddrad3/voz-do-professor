import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLegislation } from '../server/modules/legislation.js';
import { ebcExcerpt, ebcPhoto } from '../server/modules/news-media.js';
import { openDatabase, records } from '../server/db.js';
import { saveAutomatic } from '../server/modules/automation.js';
import { filterRecords } from '../shared/filter.js';

test('legislação aceita normas federais/estaduais; não apresenta projeto ou norma municipal como lei estadual', () => {
  const xml = (urn) =>
    `<record><recordData><dc><identifier>${urn}</identifier><title>Lei de educação</title><description>Educação pública</description></dc></recordData></record>`;
  const rows = parseLegislation(
    'lexml',
    `<searchRetrieveResponse><records>${xml('urn:lex:br;pernambuco:estadual:lei:2026-01-01;12')}${xml('urn:lex:br:federal:lei:1996-12-20;9394')}${xml('urn:lex:br;pernambuco;recife:municipal:lei:2026-01-01;12')}${xml('urn:lex:br:federal:projeto.lei:2026-01-01;12')}</records></searchRetrieveResponse>`,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].data.state, 'PE');
  assert.equal(rows[1].data.scope, 'Nacional');
  assert.equal(
    filterRecords(
      rows.map((x) => x.data),
      { scope: 'Estadual', state: 'PE' },
    ).length,
    1,
  );
  assert.throws(() =>
    parseLegislation('lexml', '<!DOCTYPE html><title>Verificação de segurança</title>'),
  );
});

test('trecho EBC remove HTML/pixels e não reaproveita conteúdo com autoria/licença incerta', () => {
  const content =
    '<p><img src="https://tracker.invalid">Este é um parágrafo jornalístico suficientemente longo para testar a reprodução permitida com atribuição.</p><p>Segundo parágrafo não incluído.</p>';
  const item = ebcExcerpt({ 'dc:creator': 'Repórter / Agência Brasil', description: content });
  assert.ok(item.excerpt.startsWith('Este é'));
  assert.ok(!item.excerpt.includes('Segundo'));
  assert.ok(!item.excerpt.includes('tracker'));
  assert.deepEqual(ebcExcerpt({ 'dc:creator': 'Reuters', description: content }), {});
});

test('foto precisa do crédito da imagem principal e de domínio permitido', () => {
  const page = (credit, url = 'https://imagens.ebc.com.br/foto.jpg') =>
    `<meta property="og:image" content="${url}"><figcaption class="credito-foto">${credit}</figcaption>`;
  assert.ok(ebcPhoto(page('© Pessoa/Agência Brasil')));
  assert.equal(ebcPhoto(page('Pessoa/MEC')), null);
  assert.equal(ebcPhoto(page('Pessoa/Reuters')), null);
  assert.equal(ebcPhoto(page('Pessoa/Agência Brasil', 'https://tracker.invalid/x')), null);
});

test('nova consulta não altera a data em que a publicação entrou no site', () => {
  const db = openDatabase(':memory:');
  try {
    const data = {
      title: 'Norma educacional',
      type: 'Legislação',
      sourceUrl: 'https://example.test/norma',
      sourceName: 'Fonte oficial',
      sourceDate: '1990-01-01',
    };
    saveAutomatic(db, 'content', data, 'test');
    db.prepare("UPDATE records SET first_published_at='2026-01-01T00:00:00Z'").run();
    saveAutomatic(db, 'content', { ...data, checkedAt: '2026-10-25' }, 'test');
    assert.equal(records(db, 'content')[0].firstPublishedAt, '2026-01-01T00:00:00Z');
  } finally {
    db.close();
  }
});
