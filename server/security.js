import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const token = () => randomBytes(32).toString('hex');
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export async function passwordHash(password) {
  const salt = token();
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
export async function passwordMatches(password, stored) {
  const [salt, key] = stored.split(':');
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(key, 'hex'));
}
export function encryption(db, provided = process.env.DATA_ENCRYPTION_KEY) {
  if (process.env.NODE_ENV === 'production' && !provided)
    throw new Error('DATA_ENCRYPTION_KEY é obrigatória em produção.');
  let key =
    provided ||
    db.prepare("SELECT value FROM metadata WHERE key='dev-encryption-key'").get()?.value;
  if (!key) {
    key = token();
    db.prepare('INSERT INTO metadata VALUES(?,?)').run('dev-encryption-key', key);
  }
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw new Error('DATA_ENCRYPTION_KEY deve ter 64 caracteres hexadecimais.');
  const binary = Buffer.from(key, 'hex');
  return {
    encrypt(text) {
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', binary, iv);
      const data = Buffer.concat([c.update(text, 'utf8'), c.final()]);
      return `${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${data.toString('hex')}`;
    },
    decrypt(text) {
      const [iv, tag, data] = text.split(':');
      const c = createDecipheriv('aes-256-gcm', binary, Buffer.from(iv, 'hex'));
      c.setAuthTag(Buffer.from(tag, 'hex'));
      return Buffer.concat([c.update(Buffer.from(data, 'hex')), c.final()]).toString('utf8');
    },
  };
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
        .prepare('SELECT * FROM sessions WHERE token=? AND expires>?')
        .get(hash(raw), Date.now());
      if (session) {
        req.session = session;
        req.user = db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id);
      }
    }
    next();
  };
}
export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Entre na sua conta para continuar.' });
  next();
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
export function limiter(limit = 30, windowMs = 60000) {
  const entries = new Map();
  const salt = token();
  return (req, res, next) => {
    const at = Date.now();
    for (const [k, v] of entries) if (v.until < at) entries.delete(k);
    const key = hash(salt + (req.socket.remoteAddress || ''));
    const e = entries.get(key) || { n: 0, until: at + windowMs };
    e.n++;
    entries.set(key, e);
    if (e.n > limit)
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto.' });
    next();
  };
}
export const publicUser = (u) =>
  u
    ? {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        profile: JSON.parse(u.profile),
        preferences: JSON.parse(u.preferences),
        consentAt: u.consent_at,
      }
    : null;
