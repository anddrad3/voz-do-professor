import { Router } from 'express';
import { z } from 'zod';
import { token, hash, passwordMatches, limiter } from '../security.js';
export function adminAuth(db) {
  const r = Router();
  const cookiePath = `${(process.env.BASE_PATH || '').replace(/\/$/, '')}/api/admin`;
  r.get('/session', (req, res) =>
    res.json({
      user: req.user ? { id: req.user.id, name: req.user.name, role: 'admin' } : null,
      csrf: req.session?.csrf || null,
    }),
  );
  r.post('/login', limiter(6, 15 * 60000), async (req, res) => {
    const { password } = z
      .object({ password: z.string().min(1).max(256) })
      .strict()
      .parse(req.body);
    const user = db.prepare('SELECT * FROM admin_users LIMIT 1').get();
    if (!user || !(await passwordMatches(password, user.password)))
      return res.status(401).json({ error: 'Credencial inválida.' });
    const raw = token(),
      csrf = token();
    db.prepare('DELETE FROM admin_sessions WHERE expires<?').run(Date.now());
    db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?)').run(
      hash(raw),
      user.id,
      Date.now() + 8 * 3600000,
      csrf,
    );
    res.cookie('voz_session', raw, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.ADMIN_HTTPS === 'true',
      path: cookiePath,
      maxAge: 8 * 3600000,
    });
    res.json({ user: { id: user.id, name: user.name, role: 'admin' }, csrf });
  });
  r.post('/logout', (req, res) => {
    if (req.session) db.prepare('DELETE FROM admin_sessions WHERE token=?').run(req.session.token);
    res.clearCookie('voz_session', { path: cookiePath });
    res.json({ ok: true });
  });
  return r;
}
