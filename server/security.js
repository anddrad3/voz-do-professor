import { isIP } from 'node:net';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const token = () => randomBytes(32).toString('hex');
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export async function passwordHash(password) {
  const salt = token();
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
export async function passwordMatches(password, stored) {
  const [salt, key] = String(stored || '').split(':');
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(key || '', 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export function sessionMiddleware(db) {
  return (req, res, next) => {
    const raw = (req.headers.cookie || '')
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('voz_session='))
      ?.slice(12);
    if (raw) {
      const session = db
        .prepare('SELECT * FROM admin_sessions WHERE token=? AND expires>?')
        .get(hash(raw), Date.now());
      if (session) {
        req.session = session;
        req.user = db
          .prepare("SELECT *, 'admin' AS role FROM admin_users WHERE id=?")
          .get(session.user_id);
      }
    }
    next();
  };
}
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Acesso exclusivo da administração.' });
  next();
}
export function csrf(req, res, next) {
  if (
    req.session &&
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    req.headers['x-csrf-token'] !== req.session.csrf
  )
    return res.status(403).json({ error: 'Sessão desatualizada. Recarregue a página.' });
  next();
}
// Enable only behind Alwaysdata's front proxy, which supplies X-Real-IP.
// Keep a finite global monetary budget even if a client evades a connection quota.
export function clientAddress(req) {
  const remote = req.socket?.remoteAddress || '';
  const real = req.headers?.['x-real-ip'];
  if (process.env.TRUST_ALWAYS_DATA_PROXY === 'true' && typeof real === 'string' && isIP(real))
    return real;
  return remote;
}
export function limiter(limit = 30, windowMs = 60000) {
  const entries = new Map();
  const salt = token();
  let nextCleanup = 0;
  return (req, res, next) => {
    const at = Date.now();
    if (at >= nextCleanup) {
      for (const [k, v] of entries) if (v.until < at) entries.delete(k);
      nextCleanup = at + Math.min(10000, windowMs);
    }
    const key = hash(salt + clientAddress(req));
    if (!entries.has(key) && entries.size >= 4096)
      return res
        .set('Retry-After', '60')
        .status(429)
        .json({ error: 'Serviço ocupado. Tente novamente em um minuto.' });
    const saved = entries.get(key);
    const e = saved && saved.until > at ? saved : { n: 0, until: at + windowMs };
    e.n++;
    entries.set(key, e);
    if (e.n > limit)
      return res
        .set('Retry-After', String(Math.max(1, Math.ceil((e.until - at) / 1000))))
        .status(429)
        .json({ error: 'Muitas tentativas. Aguarde um minuto.' });
    next();
  };
}
