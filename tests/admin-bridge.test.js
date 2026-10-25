import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readdir, unlink, rmdir, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  startAdminBridge,
  relayAdminRequest,
  privateDirectory,
  validateBridgeRequest,
  REQUEST_LIMIT,
} from '../server/modules/admin-bridge.js';
import { openDatabase, records } from '../server/db.js';
import { createAdminApp, createApp } from '../server/app.js';
import { passwordHash } from '../server/security.js';
import { defaultFeatures } from '../shared/features.js';

test('ponte permite apenas rotas conhecidas e rejeita destinos, traversal, métodos e cargas inválidas', () => {
  for (const url of [
    'http://example.com/',
    '//example.com/',
    '/voz-do-professor/../api/admin/settings',
    '/voz-do-professor/%2e%2e/',
    '/voz-do-professor/api/admin/settings?x=1',
    '/voz-do-professor/assets/a.js/other',
    '/voz-do-professor/api/records/story',
  ])
    assert.throws(() => validateBridgeRequest({ method: 'GET', url }, '/voz-do-professor'));
  assert.throws(() => validateBridgeRequest({ method: 'DELETE', url: '/api/admin/settings' }));
  assert.throws(() =>
    validateBridgeRequest({
      method: 'POST',
      url: '/api/admin/auth/login',
      body: Buffer.alloc(REQUEST_LIMIT + 1).toString('base64'),
    }),
  );
  assert.throws(() =>
    validateBridgeRequest({
      method: 'GET',
      url: '/api/admin/settings',
      headers: { cookie: 'a\r\nb' },
    }),
  );
  assert.equal(
    validateBridgeRequest({
      method: 'GET',
      url: '/assets/admin-abc123.js',
      headers: { authorization: 'discarded' },
    }).headers.authorization,
    undefined,
  );
});

test('ponte mantém autenticação, origem e CSRF; publica/retira relato e alterna ferramentas em banco temporário', async () => {
  const directory = await privateDirectory(await mkdtemp(join(tmpdir(), 'voz-bridge-test-')));
  const db = openDatabase(':memory:');
  const socketPath =
    process.platform === 'win32'
      ? `\\\\.\\pipe\\voz-admin-test-${process.pid}`
      : join(directory, 'admin-test.sock');
  const admin = createAdminApp(db).listen(socketPath);
  const publicServer = createApp(db).listen(0, '127.0.0.1');
  await Promise.all([once(admin, 'listening'), once(publicServer, 'listening')]);
  const stop = await startAdminBridge({ directory, socketPath, interval: 10 });
  const password = 'SenhaSomenteTeste2026!';
  await db
    .prepare('INSERT INTO admin_users VALUES(?,?,?)')
    .run('owner', 'Proprietário teste', await passwordHash(password));
  const send = async (url, body, headers = {}, method = body === undefined ? 'GET' : 'POST') => {
    const result = await relayAdminRequest(
      directory,
      {
        method,
        url,
        headers: { 'content-type': 'application/json', ...headers },
        body: body === undefined ? '' : Buffer.from(JSON.stringify(body)).toString('base64'),
      },
      { basePath: '' },
    );
    return { ...result, json: JSON.parse(Buffer.from(result.body, 'base64').toString()) };
  };
  try {
    assert.equal((await send('/api/admin/settings')).status, 403);
    assert.equal(
      (await send('/api/admin/auth/login', { password }, { origin: 'https://evil.example' }))
        .status,
      403,
    );
    assert.equal((await send('/api/admin/auth/login', { password: 'wrong' })).status, 401);
    const login = await send(
      '/api/admin/auth/login',
      { password },
      { origin: 'http://127.0.0.1:3002' },
    );
    assert.equal(login.status, 200);
    assert.match(login.headers['set-cookie'][0], /HttpOnly/);
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const headers = { cookie, origin: 'http://127.0.0.1:3002', 'x-csrf-token': login.json.csrf };
    assert.equal(
      (await send('/api/admin/settings', { features: defaultFeatures() }, { cookie }, 'PUT'))
        .status,
      403,
    );
    const story = await send(
      '/api/admin/records/story',
      {
        title: 'Relato de teste da ponte',
        body: 'Texto fictício autorizado.',
        consent: true,
        anonymous: true,
      },
      headers,
    );
    assert.equal(story.status, 201);
    assert.equal(
      (await send(`/api/admin/records/${story.json.id}/publish`, { attestation: true }, headers))
        .status,
      200,
    );
    assert.equal(records(db, 'story').length, 1);
    const features = Object.fromEntries(Object.keys(defaultFeatures()).map((key) => [key, false]));
    assert.equal((await send('/api/admin/settings', { features }, headers, 'PUT')).status, 200);
    const publicUrl = `http://127.0.0.1:${publicServer.address().port}`;
    assert.deepEqual(await (await fetch(publicUrl + '/api/records/story')).json(), []);
    await send('/api/admin/settings', { features: defaultFeatures() }, headers, 'PUT');
    assert.equal((await (await fetch(publicUrl + '/api/records/story')).json()).length, 1);
    assert.equal(
      (await send(`/api/admin/records/${story.json.id}/archive`, {}, headers)).status,
      200,
    );
    assert.equal(records(db, 'story').length, 0);
    await send('/api/admin/auth/logout', {}, headers);
    assert.equal((await send('/api/admin/settings', undefined, { cookie })).status, 403);
    assert.deepEqual(
      (await readdir(directory)).filter((name) => !name.endsWith('.sock')),
      [],
    );
    const stale = join(directory, 'a'.repeat(32) + '.res');
    await writeFile(stale, '{}', { mode: 0o600 });
    await utimes(stale, new Date(0), new Date(0));
    await sleep(100);
    assert.deepEqual(
      (await readdir(directory)).filter((name) => !name.endsWith('.sock')),
      [],
    );
  } finally {
    await stop();
    await Promise.all(
      [admin, publicServer].map((server) => new Promise((resolve) => server.close(resolve))),
    );
    db.close();
    for (const name of await readdir(directory)) await unlink(join(directory, name));
    await rmdir(directory);
  }
});
