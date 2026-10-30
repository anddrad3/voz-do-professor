import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/db.js';
import { limiter } from '../server/security.js';
test('arquivos privados acidentalmente copiados para o build não são servidos', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'voz-assets-'));
  writeFileSync(join(directory, 'index.html'), '<p>Site público</p>');
  writeFileSync(join(directory, '.env'), 'PRIVATE_SENTINEL');
  mkdirSync(join(directory, 'data'));
  writeFileSync(join(directory, 'data', 'private.sqlite'), 'PRIVATE_SENTINEL');
  writeFileSync(join(directory, 'data', 'municipios.json'), '[]');
  mkdirSync(join(directory, 'assets'));
  writeFileSync(join(directory, 'assets', 'main.map'), 'PRIVATE_SENTINEL');
  writeFileSync(join(directory, 'assets', 'jspdf.es.min-test.js'), 'export default true;');
  const db = openDatabase(':memory:'),
    server = createApp(db, { staticDir: directory }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of [
      '/.env',
      '/.git/config',
      '/data/private.sqlite',
      '/server/build-info.json',
      '/assets/main.map',
      '/assets/missing.js',
    ]) {
      const response = await fetch(base + path);
      const body = await response.text();
      assert.equal(response.status, 404);
      assert.ok(!body.includes('PRIVATE_SENTINEL'));
      assert.ok(!body.includes(directory));
    }
    const response = await fetch(base + '/');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('permissions-policy'), /camera=\(\)/);
    assert.equal((await fetch(base + '/data/municipios.json')).status, 200);
    assert.equal((await fetch(base + '/assets/jspdf.es.min-test.js')).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('limitador tem memória limitada mesmo com milhares de origens e preserva limite por conexão', () => {
  const guard = limiter(2),
    response = {
      code: 200,
      set() {
        return this;
      },
      status(code) {
        this.code = code;
        return this;
      },
      json() {
        return this;
      },
    };
  const call = (id) => {
    response.code = 200;
    guard({ socket: { remoteAddress: `client-${id}` }, headers: {} }, response, () => {});
    return response.code;
  };
  for (let i = 0; i < 4096; i++) assert.equal(call(i), 200);
  assert.equal(call(4096), 429);
  assert.equal(call(0), 200);
  assert.equal(call(0), 429);
});
