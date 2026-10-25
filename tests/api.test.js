import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openDatabase, now, unpack } from '../server/db.js';
import { createApp } from '../server/app.js';
import { saveRecord, publishRecord } from '../server/domain.js';
import { hash } from '../server/security.js';
let db, server, base, teacher, admin, other;
const password = 'Uma senha de teste 123!';
async function request(path, { method = 'GET', body, auth, headers = {} } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { cookie: auth.cookie, 'X-CSRF-Token': auth.csrf } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  return { status: response.status, data, response };
}
async function register(email, name) {
  const r = await request('/account/register', {
    method: 'POST',
    body: { email, name, password, consent: true },
  });
  assert.equal(r.status, 200);
  return {
    cookie: r.response.headers.get('set-cookie').split(';')[0],
    csrf: r.data.csrf,
    user: r.data.user,
  };
}
before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DEMO_MODE = 'false';
  db = openDatabase(':memory:');
  server = createApp(db, { encryptionKey: 'b'.repeat(64) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
  teacher = await register('teacher@example.test', 'Professora teste');
  admin = await register('admin@example.test', 'Curadora teste');
  other = await register('other@example.test', 'Outra professora');
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(admin.user.id);
});
after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
});
test('sessão persistente usa cookie HttpOnly e não retorna hash de senha', async () => {
  const r = await request('/account/session', { auth: teacher });
  assert.equal(r.data.user.name, 'Professora teste');
  assert.equal(r.data.csrf, teacher.csrf);
  assert.equal(r.data.user.password, undefined);
  const raw = teacher.cookie.split('=')[1];
  assert.ok(db.prepare('SELECT 1 FROM sessions WHERE token=?').get(hash(raw)));
  assert.ok(!db.prepare('SELECT 1 FROM sessions WHERE token=?').get(raw));
});
test('autorização, CSRF e origem bloqueiam mutações indevidas', async () => {
  assert.equal((await request('/account/favorites')).status, 401);
  assert.equal((await request('/admin/overview', { auth: teacher })).status, 403);
  assert.equal(
    (
      await request('/account/profile', {
        method: 'PUT',
        auth: teacher,
        body: {},
        headers: { 'X-CSRF-Token': 'wrong' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/account/profile', {
        method: 'PUT',
        auth: teacher,
        body: {},
        headers: { origin: 'https://evil.example' },
      })
    ).status,
    403,
  );
});
let contentId;
test('admin cria e publica com validação explícita; público não vê rascunho', async () => {
  const input = {
    title: 'Direito à informação',
    type: 'Legislação',
    summary: 'Explicação acessível',
    body: 'Conteúdo de teste',
    sourceName: 'Fonte oficial',
    sourceUrl: 'https://example.org/lei',
    sourceDate: '2026-10-01',
  };
  const created = await request('/admin/records/content', {
    method: 'POST',
    auth: admin,
    body: input,
  });
  assert.equal(created.status, 201);
  contentId = created.data.id;
  assert.equal((await request(`/record/${contentId}`)).status, 404);
  assert.equal(
    (
      await request(`/admin/records/${contentId}/publish`, {
        method: 'POST',
        auth: admin,
        body: { attestation: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/admin/records/${contentId}/publish`, {
        method: 'POST',
        auth: admin,
        body: { attestation: true },
      })
    ).status,
    200,
  );
  const visible = await request(`/record/${contentId}`);
  assert.equal(visible.data.reviewer, 'Curadora teste');
  assert.equal((await request(`/history/${contentId}`)).data.length, 1);
});
test('favoritos e notificações são isolados por conta', async () => {
  assert.equal(
    (await request(`/account/favorites/${contentId}`, { method: 'POST', auth: teacher, body: {} }))
      .status,
    200,
  );
  assert.equal((await request('/account/favorites', { auth: teacher })).data.length, 1);
  assert.equal((await request('/account/favorites', { auth: other })).data.length, 0);
  let notes = (await request('/account/notifications', { auth: teacher })).data;
  assert.equal(notes.length, 1);
  await request('/account/notifications/read', {
    method: 'POST',
    auth: other,
    body: { id: notes[0].id },
  });
  notes = (await request('/account/notifications', { auth: teacher })).data;
  assert.equal(notes[0].read_at, null);
  await request('/account/notifications/read', {
    method: 'POST',
    auth: teacher,
    body: { id: notes[0].id },
  });
  assert.ok((await request('/account/notifications', { auth: teacher })).data[0].read_at);
});
test('edição retira publicação até nova revisão, histórico público omite rascunhos', async () => {
  const r = await request(`/admin/records/content/${contentId}`, {
    method: 'PUT',
    auth: admin,
    body: {
      title: 'Revisão pendente',
      type: 'Legislação',
      summary: 'Texto alterado',
      sourceName: 'Fonte',
      sourceUrl: 'https://example.org',
      sourceDate: '2026-10-02',
    },
  });
  assert.equal(r.status, 200);
  assert.equal((await request(`/record/${contentId}`)).status, 404);
  assert.equal((await request(`/history/${contentId}`)).status, 404);
  await request(`/admin/records/${contentId}/publish`, {
    method: 'POST',
    auth: admin,
    body: { attestation: true },
  });
  assert.equal((await request(`/history/${contentId}`)).data.length, 2);
});
let surveyId, receipt;
test('pesquisa anônima valida consentimento/opções e fornece comprovante não vinculado à conta', async () => {
  const s = saveRecord(
    db,
    'survey',
    {
      title: 'Pesquisa de jornada',
      topic: 'Jornada',
      purpose: 'Conhecer condições de jornada docente.',
      questions: [{ id: 'horas', label: 'Sua jornada?', options: ['Até 20', 'Mais de 20'] }],
    },
    'Teste',
  );
  publishRecord(db, s.id, 'Curadora');
  surveyId = s.id;
  const input = { surveyId, territory: 'Franca / SP', answers: { horas: 'Até 20' }, consent: true };
  assert.equal(
    (await request('/research/responses', { method: 'POST', body: { ...input, consent: false } }))
      .status,
    400,
  );
  assert.equal(
    (
      await request('/research/responses', {
        method: 'POST',
        body: { ...input, answers: { horas: 'Livre' } },
      })
    ).status,
    400,
  );
  const r = await request('/research/responses', { method: 'POST', auth: teacher, body: input });
  assert.equal(r.status, 201);
  receipt = r.data.receipt;
  const row = db.prepare('SELECT * FROM responses').get();
  assert.equal(row.receipt, hash(receipt));
  assert.equal(row.territory, 'FRANCA / SP');
  assert.equal(row.user_id, undefined);
  assert.equal(row.ip, undefined);
  assert.equal((await request(`/research/results/${surveyId}`)).data.nationwide.suppressed, true);
});
test('retirada por comprovante exclui a participação e não aceita reutilização', async () => {
  assert.equal(
    (await request('/research/withdraw', { method: 'POST', body: { receipt } })).status,
    200,
  );
  assert.equal(
    (await request('/research/withdraw', { method: 'POST', body: { receipt } })).status,
    404,
  );
  assert.equal(db.prepare('SELECT count(*) n FROM responses').get().n, 0);
});
test('relato criptografado só é legível para administração e nunca no relatório público', async () => {
  const text = 'Relato privado para testar a proteção de dados.';
  const r = await request('/research/submissions', {
    method: 'POST',
    body: {
      kind: 'Relato',
      territory: 'Franca / SP',
      category: 'Jornada',
      body: text,
      consent: true,
    },
  });
  assert.equal(r.status, 201);
  assert.ok(!db.prepare('SELECT body FROM submissions').get().body.includes(text));
  assert.equal((await request('/admin/submissions', { auth: teacher })).status, 403);
  assert.equal((await request('/admin/submissions', { auth: admin })).data[0].body, text);
  assert.ok(!JSON.stringify((await request('/research/report')).data).includes(text));
});
test('exportação da conta exclui senha e participações anônimas; exclusão remove dados pessoais', async () => {
  const u = await register('delete@example.test', 'Conta descartável');
  await request(`/account/favorites/${contentId}`, { method: 'POST', auth: u, body: {} });
  const exported = await request('/account/privacy/export', { auth: u });
  assert.equal(exported.data.user.password, undefined);
  assert.equal(exported.data.responses, undefined);
  assert.equal(exported.data.favorites.length, 1);
  assert.equal(
    (await request('/account/account', { method: 'DELETE', auth: u, body: { password: 'wrong' } }))
      .status,
    400,
  );
  assert.equal(
    (await request('/account/account', { method: 'DELETE', auth: u, body: { password } })).status,
    200,
  );
  assert.equal((await request('/account/session', { auth: u })).data.user, null);
  assert.equal(db.prepare('SELECT count(*) n FROM favorites WHERE user_id=?').get(u.user.id).n, 0);
});
test('dados demonstrativos ficam indisponíveis nas rotas públicas fora do modo demo', async () => {
  const d = saveRecord(
    db,
    'survey',
    {
      title: 'Demo oculta',
      topic: 'Enquete',
      purpose: 'Apenas um instrumento demonstrativo.',
      questions: [{ id: 'q', label: 'Pergunta demo?', options: ['Sim', 'Não'] }],
    },
    'Teste',
    'hidden-demo',
    true,
  );
  publishRecord(db, d.id, 'Curadora');
  assert.equal((await request(`/record/${d.id}`)).status, 404);
  assert.equal((await request(`/research/results/${d.id}`)).status, 404);
  assert.ok(!(await request('/research/report')).data.surveys.some((s) => s.surveyId === d.id));
  assert.equal(
    (
      await request('/research/responses', {
        method: 'POST',
        body: { surveyId: d.id, territory: 'Cidade', answers: { q: 'Sim' }, consent: true },
      })
    ).status,
    404,
  );
});
test('rotas e erros inválidos são JSON sem expor detalhes internos', async () => {
  assert.equal((await request('/unknown')).status, 404);
  assert.equal((await request('/records/not-a-kind')).status, 404);
  const invalid = await request('/account/register', {
    method: 'POST',
    body: { email: 'bad', password: 'short', name: 'A', consent: false },
  });
  assert.equal(invalid.status, 400);
  assert.ok(!invalid.data.stack);
});
