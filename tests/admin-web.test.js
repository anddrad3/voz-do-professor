import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/db.js';
import { createApp } from '../server/app.js';
import { passwordHash, hash } from '../server/security.js';
import {
  base32,
  totp,
  consumeSecondFactor,
  loginBudget,
  provisionSecondFactor,
} from '../server/modules/totp.js';

const secret = base32(Buffer.from('12345678901234567890'));
test('provisioning revokes old sessions, stores only recovery hashes and refuses replacement/public files', () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO admin_users VALUES(?,?,?)').run('owner', 'Admin', 'unused');
    db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?)').run(
      'old',
      'owner',
      Date.now() + 60000,
      'csrf',
    );
    assert.throws(() => provisionSecondFactor(db, 'dist/secret.json'), /pasta pública/);
    const output = join(mkdtempSync(join(tmpdir(), 'voz-2fa-')), 'factor.json');
    provisionSecondFactor(db, output);
    const credentials = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM admin_sessions').get().n, 0);
    assert.equal(credentials.recoveryCodes.length, 10);
    assert.ok(
      db
        .prepare('SELECT code_hash FROM admin_recovery')
        .all()
        .every((r) => !credentials.recoveryCodes.includes(r.code_hash)),
    );
    assert.equal(consumeSecondFactor(db, 'owner', totp(credentials.secret)), true);
    assert.throws(() => provisionSecondFactor(db, output), /já configurado/);
  } finally {
    db.close();
  }
});
test('TOTP matches all SHA-1 RFC 6238 vectors, including dates beyond 2038', () => {
  for (const [time, code] of [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])
    assert.equal(totp(secret, Math.floor(time / 30), 8), code);
});
test('second factor rejects expired, future and replayed codes; recovery works only once', () => {
  const db = openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO admin_users VALUES(?,?,?)').run('owner', 'Admin', 'unused');
    db.prepare('INSERT INTO admin_factors(user_id,secret) VALUES(?,?)').run('owner', secret);
    const at = 1234567890000,
      step = Math.floor(at / 30000);
    assert.equal(consumeSecondFactor(db, 'owner', totp(secret, step - 2), at), false);
    assert.equal(consumeSecondFactor(db, 'owner', totp(secret, step + 2), at), false);
    assert.equal(consumeSecondFactor(db, 'owner', totp(secret, step), at), true);
    assert.equal(consumeSecondFactor(db, 'owner', totp(secret, step), at), false);
    assert.equal(consumeSecondFactor(db, 'owner', totp(secret, step - 1), at), false);
    const recovery = 'ABCDEF1234567890ABCDEF12';
    db.prepare('INSERT INTO admin_recovery VALUES(?,?)').run('owner', hash(recovery));
    assert.equal(consumeSecondFactor(db, 'owner', recovery, at), true);
    assert.equal(consumeSecondFactor(db, 'owner', recovery, at), false);
    for (let i = 0; i < 6; i++) assert.equal(loginBudget(db, at).allowed, true);
    assert.equal(loginBudget(db, at).allowed, false);
    assert.equal(loginBudget(db, at + 15 * 60000).allowed, true);
  } finally {
    db.close();
  }
});
test('web admin fails closed, requires password plus factor, keeps visitors read-only and protects owner writes', async () => {
  const saved = { ...process.env };
  const db = openDatabase(':memory:');
  let server;
  try {
    process.env.ADMIN_WEB_ENABLED = 'true';
    process.env.ADMIN_HTTPS = 'true';
    process.env.ADMIN_ORIGIN = 'https://example.test';
    process.env.BASE_PATH = '/voz-do-professor';
    assert.throws(() => createApp(db), /segundo fator/);
    db.prepare('INSERT INTO admin_users VALUES(?,?,?)').run(
      'owner',
      'Admin',
      await passwordHash('FixtureOnlyPassword!'),
    );
    db.prepare('INSERT INTO admin_factors(user_id,secret) VALUES(?,?)').run('owner', secret);
    server = createApp(db).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/voz-do-professor`;
    const request = (path, body, headers = {}, method = 'POST') =>
      fetch(url + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
    assert.equal((await fetch(url + '/api/health')).status, 200);
    assert.equal((await fetch(url + '/painel')).status, 200);
    const state = await fetch(url + '/api/admin/auth/session');
    assert.equal(state.headers.get('set-cookie'), null);
    assert.equal((await state.json()).secondFactorRequired, true);
    assert.equal((await fetch(url + '/api/admin/settings')).status, 403);
    assert.equal((await request('/api/research/submissions', {})).status, 405);
    assert.equal(
      (await request('/api/admin/auth/login', { password: 'FixtureOnlyPassword!' })).status,
      401,
    );
    assert.equal(
      (await request('/api/admin/auth/login', { password: 'Wrong', code: totp(secret) })).status,
      401,
    );
    assert.equal(
      (
        await request(
          '/api/admin/auth/login',
          { password: 'FixtureOnlyPassword!', code: totp(secret) },
          { Origin: 'https://evil.test' },
        )
      ).status,
      403,
    );
    const login = await request(
      '/api/admin/auth/login',
      { password: 'FixtureOnlyPassword!', code: totp(secret) },
      { Origin: 'https://example.test' },
    );
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    for (const property of [
      /HttpOnly/,
      /Secure/,
      /SameSite=Strict/,
      /Path=\/voz-do-professor\/api\/admin/,
    ])
      assert.match(cookie, property);
    const { csrf } = await login.json();
    assert.equal(
      (await fetch(url + '/api/admin/settings', { headers: { Cookie: cookie } })).status,
      200,
    );
    const features = (await (await fetch(url + '/api/config')).json()).features;
    assert.equal(
      (await request('/api/admin/settings', { features }, { Cookie: cookie }, 'PUT')).status,
      403,
    );
    assert.equal(
      (
        await request(
          '/api/admin/settings',
          { features },
          { Cookie: cookie, 'X-CSRF-Token': csrf, Origin: 'https://example.test' },
          'PUT',
        )
      ).status,
      200,
    );
    assert.equal(
      (await request('/api/admin/auth/logout', {}, { Cookie: cookie, 'X-CSRF-Token': csrf }))
        .status,
      200,
    );
    assert.equal(
      (await fetch(url + '/api/admin/settings', { headers: { Cookie: cookie } })).status,
      403,
    );
    assert.equal(
      (
        await request('/api/admin/auth/login', {
          password: 'FixtureOnlyPassword!',
          code: totp(secret),
        })
      ).status,
      401,
    );
    // Recreating the app cannot reset the persistent authentication budget.
    for (let i = 0; i < 6; i++) await request('/api/admin/auth/login', { password: 'Wrong' });
    await new Promise((r) => server.close(r));
    server = createApp(db).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const limited = await fetch(
      `http://127.0.0.1:${server.address().port}/voz-do-professor/api/admin/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
        body: JSON.stringify({ password: 'Wrong' }),
      },
    );
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    db.close();
    for (const key of ['ADMIN_WEB_ENABLED', 'ADMIN_HTTPS', 'ADMIN_ORIGIN', 'BASE_PATH']) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
