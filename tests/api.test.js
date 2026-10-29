import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase, records } from '../server/db.js';
import { createApp, createAdminApp } from '../server/app.js';
import { saveRecord, publishRecord } from '../server/domain.js';
import { passwordHash } from '../server/security.js';
import { setFeatures } from '../server/modules/settings.js';
import { defaultFeatures } from '../shared/features.js';
async function fixture() {
  const db = openDatabase(':memory:');
  const a = createApp(db).listen(0, '127.0.0.1');
  const b = createAdminApp(db).listen(0, '127.0.0.1');
  await Promise.all([once(a, 'listening'), once(b, 'listening')]);
  return {
    db,
    publicUrl: `http://127.0.0.1:${a.address().port}`,
    adminUrl: `http://127.0.0.1:${b.address().port}`,
    async close() {
      await Promise.all([new Promise((r) => a.close(r)), new Promise((r) => b.close(r))]);
      db.close();
    },
  };
}
const request = (url, body, headers = {}) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

test('changelog é privado e exclusão de relato exige sessão, CSRF e confirmação, removendo revisões', async () => {
  const f = await fixture();
  try {
    f.db
      .prepare('INSERT INTO admin_users VALUES(?,?,?)')
      .run('owner', 'Admin', await passwordHash('FixtureDelete!'));
    const story = saveRecord(
      f.db,
      'story',
      { title: 'Relato temporário', body: 'Texto autorizado', consent: true, anonymous: true },
      'Admin',
    );
    publishRecord(f.db, story.id, 'Admin');
    assert.equal((await fetch(f.adminUrl + '/api/admin/changelog')).status, 403);
    const login = await request(f.adminUrl + '/api/admin/auth/login', {
      password: 'FixtureDelete!',
    });
    const cookie = login.headers.get('set-cookie'),
      auth = await login.json();
    const headers = {
      'Content-Type': 'application/json',
      Cookie: cookie,
      'X-CSRF-Token': auth.csrf,
    };
    const history = await (await fetch(f.adminUrl + '/api/admin/changelog', { headers })).json();
    assert.ok(history.history.some((v) => v.commits.includes('1454b5f')));
    const profileUrl = f.adminUrl + '/api/admin/profile';
    assert.equal((await fetch(profileUrl)).status, 403);
    const profileBody = JSON.stringify({ name: 'Nome privado', avatar: '' });
    assert.equal(
      (
        await fetch(profileUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: profileBody,
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(profileUrl, { method: 'PUT', headers, body: profileBody })).status,
      200,
    );
    assert.equal((await (await fetch(profileUrl, { headers })).json()).name, 'Nome privado');
    const versions = await (await fetch(f.publicUrl + '/api/versions')).json();
    assert.ok(versions.history.length > 0);
    assert.ok(!JSON.stringify(versions).includes('Nome privado'));
    const pause = f.adminUrl + '/api/admin/automation/pause';
    assert.equal((await request(pause, { paused: true })).status, 403);
    assert.equal((await request(pause, { paused: true }, { Cookie: cookie })).status, 403);
    assert.equal((await request(pause, { paused: true, budget: 500 }, headers)).status, 400);
    assert.equal((await request(pause, { paused: true }, headers)).status, 200);
    assert.equal(
      f.db.prepare("SELECT value FROM metadata WHERE key='ai-owner-paused'").get().value,
      'true',
    );
    assert.equal((await request(pause, { paused: false }, headers)).status, 200);
    const url = f.adminUrl + '/api/admin/stories/' + story.id;
    assert.equal((await fetch(url, { method: 'DELETE', headers, body: '{}' })).status, 400);
    assert.equal(
      (
        await fetch(url, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ confirmation: 'EXCLUIR' }),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(url, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ confirmation: 'EXCLUIR' }),
        })
      ).status,
      200,
    );
    assert.equal(
      f.db.prepare('SELECT COUNT(*) n FROM revisions WHERE record_id=?').get(story.id).n,
      0,
    );
    assert.equal((await fetch(f.publicUrl + '/api/record/' + story.id)).status, 404);
    assert.deepEqual(await (await fetch(f.publicUrl + '/api/records/school')).json(), []);
  } finally {
    await f.close();
  }
});
test('subpasta mantém API pública e caminho do cookie privado corretos', async () => {
  const previous = process.env.BASE_PATH;
  process.env.BASE_PATH = '/voz-do-professor';
  const f = await fixture();
  try {
    f.db
      .prepare('INSERT INTO admin_users VALUES(?,?,?)')
      .run('owner', 'Admin', await passwordHash('TesteSubpasta2026!'));
    assert.equal((await fetch(f.publicUrl + '/voz-do-professor/api/health')).status, 200);
    assert.equal((await fetch(f.publicUrl + '/voz-do-professor/admin.html')).status, 404);
    const login = await request(f.adminUrl + '/voz-do-professor/api/admin/auth/login', {
      password: 'TesteSubpasta2026!',
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /Path=\/voz-do-professor\/api\/admin/);
  } finally {
    await f.close();
    if (previous === undefined) delete process.env.BASE_PATH;
    else process.env.BASE_PATH = previous;
  }
});
test('serviço público não aceita contas, relatos, uploads, localização ou qualquer escrita', async () => {
  const f = await fixture();
  try {
    for (const path of [
      '/api/account/register',
      '/api/account/login',
      '/api/research/submissions',
      '/api/admin/auth/login',
      '/api/anything',
    ]) {
      const r = await request(f.publicUrl + path, {
        name: 'Não guardar',
        lat: -20,
        email: 'fixture@example.test',
      });
      assert.equal(r.status, 405);
      assert.equal(r.headers.get('set-cookie'), null);
    }
    const tables = f.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((x) => x.name);
    for (const table of [
      'users',
      'sessions',
      'responses',
      'submissions',
      'favorites',
      'notifications',
      'privacy_requests',
      'metrics',
    ])
      assert.ok(!tables.includes(table), table);
    for (const path of [
      '/api/account/session',
      '/api/admin/settings',
      '/admin',
      '/admin.html',
      '/gestao',
    ])
      assert.equal((await fetch(f.publicUrl + path)).status, 404);
    const config = await fetch(f.publicUrl + '/api/config');
    assert.equal(config.headers.get('set-cookie'), null);
    assert.match((await config.json()).contactEmail, /invalid$/);
  } finally {
    await f.close();
  }
});
test('painel privado exige senha, sessão HttpOnly, CSRF e origem correta', async () => {
  const f = await fixture();
  try {
    f.db
      .prepare('INSERT INTO admin_users VALUES(?,?,?)')
      .run('owner', 'Responsável', await passwordHash('SenhaSomenteTeste!2026'));
    assert.equal((await fetch(f.adminUrl + '/api/admin/settings')).status, 403);
    assert.equal(
      (await request(f.adminUrl + '/api/admin/auth/login', { password: 'errada' })).status,
      401,
    );
    const login = await request(f.adminUrl + '/api/admin/auth/login', {
      password: 'SenhaSomenteTeste!2026',
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    const { csrf } = await login.json();
    const features = Object.fromEntries(Object.keys(defaultFeatures()).map((k) => [k, false]));
    const opts = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ features }),
    };
    assert.equal((await fetch(f.adminUrl + '/api/admin/settings', opts)).status, 403);
    opts.headers['X-CSRF-Token'] = csrf;
    opts.headers.Origin = 'https://evil.example';
    assert.equal((await fetch(f.adminUrl + '/api/admin/settings', opts)).status, 403);
    delete opts.headers.Origin;
    assert.equal((await fetch(f.adminUrl + '/api/admin/settings', opts)).status, 200);
    assert.ok(
      Object.values((await (await fetch(f.publicUrl + '/api/config')).json()).features).every(
        (v) => v === false,
      ),
    );
    const stored = f.db.prepare('SELECT token FROM admin_sessions').get();
    assert.ok(!cookie.includes(stored.token));
  } finally {
    await f.close();
  }
});
test('desabilitar ferramentas bloqueia catálogo, detalhe, histórico e PDFs; reativação recupera conteúdo', async () => {
  const f = await fixture();
  try {
    const r = saveRecord(
      f.db,
      'story',
      {
        title: 'Relato de teste',
        body: 'Texto público autorizado.',
        anonymous: true,
        consent: true,
      },
      'Responsável',
    );
    publishRecord(f.db, r.id, 'Responsável');
    assert.equal((await fetch(f.publicUrl + '/api/record/' + r.id)).status, 200);
    setFeatures(f.db, Object.fromEntries(Object.keys(defaultFeatures()).map((k) => [k, false])));
    assert.deepEqual(await (await fetch(f.publicUrl + '/api/records/story')).json(), []);
    for (const path of [
      '/api/record/' + r.id,
      '/api/history/' + r.id,
      '/formularios/voz-do-professor.pdf',
    ])
      assert.equal((await fetch(f.publicUrl + path)).status, 404);
    setFeatures(f.db, defaultFeatures());
    assert.equal((await fetch(f.publicUrl + '/api/record/' + r.id)).status, 200);
  } finally {
    await f.close();
  }
});
test('relato exige autorização e rejeita contato privado no esquema', () => {
  const db = openDatabase(':memory:');
  try {
    assert.throws(() =>
      saveRecord(db, 'story', { title: 'Relato sem autorização', body: 'Não publicar' }, 'Admin'),
    );
    assert.throws(() =>
      saveRecord(
        db,
        'story',
        { title: 'Relato teste', consent: true, email: 'private@example.test' },
        'Admin',
      ),
    );
    const r = saveRecord(
      db,
      'story',
      { title: 'Relato teste', body: 'Texto autorizado', consent: true, anonymous: true },
      'Admin',
    );
    assert.equal(r.status, 'draft');
    publishRecord(db, r.id, 'Admin');
    assert.equal(records(db, 'story').length, 1);
  } finally {
    db.close();
  }
});
