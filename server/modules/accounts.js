import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  token,
  hash,
  passwordHash,
  passwordMatches,
  publicUser,
  requireUser,
  limiter,
} from '../security.js';
import { now, unpack, visible } from '../db.js';
import { profileSchema, preferencesSchema, generateAlerts } from '../domain.js';
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(12).max(128),
});
export function accounts(db) {
  const r = Router();
  async function login(res, user) {
    const raw = token(),
      csrf = token();
    db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(
      hash(raw),
      user.id,
      Date.now() + 7 * 86400000,
      csrf,
    );
    res.cookie('voz_session', raw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 86400000,
    });
    res.json({ user: publicUser(user), csrf });
  }
  r.get('/session', (req, res) =>
    res.json({ user: publicUser(req.user), csrf: req.session?.csrf || null }),
  );
  r.post('/register', limiter(8), async (req, res) => {
    const input = credentials
      .extend({ name: z.string().trim().min(2).max(120), consent: z.literal(true) })
      .parse(req.body);
    if (db.prepare('SELECT id FROM users WHERE email=?').get(input.email))
      return res
        .status(409)
        .json({ error: 'Não foi possível cadastrar este e-mail. Tente entrar.' });
    const id = randomUUID();
    db.prepare(
      'INSERT INTO users(id,email,name,password,consent_at,created_at) VALUES(?,?,?,?,?,?)',
    ).run(id, input.email, input.name, await passwordHash(input.password), now(), now());
    await login(res, db.prepare('SELECT * FROM users WHERE id=?').get(id));
  });
  r.post('/login', limiter(10), async (req, res) => {
    const input = credentials.parse(req.body),
      user = db.prepare('SELECT * FROM users WHERE email=?').get(input.email);
    const dummy = '0'.repeat(64) + ':' + '0'.repeat(128);
    const valid = await passwordMatches(input.password, user?.password || dummy);
    if (!user || !valid) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    if (req.session) db.prepare('DELETE FROM sessions WHERE token=?').run(req.session.token);
    await login(res, user);
  });
  r.post('/logout', requireUser, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token=?').run(req.session.token);
    res.clearCookie('voz_session', { path: '/' }).json({ ok: true });
  });
  r.put('/profile', requireUser, (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(2).max(120),
        profile: profileSchema,
        preferences: preferencesSchema,
      })
      .parse(req.body);
    db.prepare('UPDATE users SET name=?,profile=?,preferences=? WHERE id=?').run(
      input.name,
      JSON.stringify(input.profile),
      JSON.stringify(input.preferences),
      req.user.id,
    );
    for (const row of db.prepare("SELECT id FROM records WHERE status='published'").all())
      generateAlerts(db, row.id);
    res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
  });
  r.put('/password', requireUser, async (req, res) => {
    const input = z
      .object({ current: z.string().max(128), password: z.string().min(12).max(128) })
      .parse(req.body);
    if (!(await passwordMatches(input.current, req.user.password)))
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    db.prepare('UPDATE users SET password=? WHERE id=?').run(
      await passwordHash(input.password),
      req.user.id,
    );
    db.prepare('DELETE FROM sessions WHERE user_id=? AND token<>?').run(
      req.user.id,
      req.session.token,
    );
    res.json({ ok: true });
  });
  r.get('/favorites', requireUser, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT r.* FROM favorites f JOIN records r ON r.id=f.record_id WHERE f.user_id=? AND r.status='published' ORDER BY r.updated_at DESC",
        )
        .all(req.user.id)
        .map(unpack)
        .filter(visible),
    ),
  );
  r.post('/favorites/:id', requireUser, (req, res) => {
    if (
      !visible(
        unpack(
          db.prepare("SELECT * FROM records WHERE id=? AND status='published'").get(req.params.id),
        ),
      )
    )
      return res.status(404).json({ error: 'Registro indisponível.' });
    db.prepare('INSERT OR IGNORE INTO favorites VALUES(?,?)').run(req.user.id, req.params.id);
    res.json({ ok: true });
  });
  r.delete('/favorites/:id', requireUser, (req, res) => {
    db.prepare('DELETE FROM favorites WHERE user_id=? AND record_id=?').run(
      req.user.id,
      req.params.id,
    );
    res.json({ ok: true });
  });
  r.get('/notifications', requireUser, (req, res) =>
    res.json(
      db
        .prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 500')
        .all(req.user.id),
    ),
  );
  r.post('/notifications/read', requireUser, (req, res) => {
    const id = z.object({ id: z.string().optional() }).parse(req.body).id;
    db.prepare(`UPDATE notifications SET read_at=? WHERE user_id=? ${id ? 'AND id=?' : ''}`).run(
      ...[now(), req.user.id, ...(id ? [id] : [])],
    );
    res.json({ ok: true });
  });
  r.get('/privacy/export', requireUser, (req, res) =>
    res.json({
      user: publicUser(req.user),
      favorites: db.prepare('SELECT record_id FROM favorites WHERE user_id=?').all(req.user.id),
      notifications: db
        .prepare('SELECT title,created_at,read_at FROM notifications WHERE user_id=?')
        .all(req.user.id),
      requests: db
        .prepare('SELECT kind,body,status,created_at FROM privacy_requests WHERE user_id=?')
        .all(req.user.id),
    }),
  );
  r.post('/privacy/request', requireUser, (req, res) => {
    const p = z
      .object({
        kind: z.enum(['Acesso', 'Correção', 'Revogação', 'Outro']),
        body: z.string().trim().min(5).max(3000),
      })
      .parse(req.body);
    const id = randomUUID();
    db.prepare(
      'INSERT INTO privacy_requests(id,user_id,kind,body,created_at) VALUES(?,?,?,?,?)',
    ).run(id, req.user.id, p.kind, p.body, now());
    res.json({ id });
  });
  r.delete('/account', requireUser, async (req, res) => {
    const { password } = z.object({ password: z.string().max(128) }).parse(req.body);
    if (!(await passwordMatches(password, req.user.password)))
      return res.status(400).json({ error: 'Senha incorreta.' });
    if (
      req.user.role === 'admin' &&
      db.prepare("SELECT count(*) n FROM users WHERE role='admin'").get().n < 2
    )
      return res
        .status(409)
        .json({ error: 'Crie outro administrador antes de excluir o último responsável.' });
    db.prepare('DELETE FROM users WHERE id=?').run(req.user.id);
    res.clearCookie('voz_session', { path: '/' }).json({ ok: true });
  });
  return r;
}
