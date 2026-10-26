import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { hash } from '../security.js';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function provisionSecondFactor(db, output) {
  const owner = db.prepare('SELECT id FROM admin_users LIMIT 1').get();
  if (!owner) throw new Error('Crie o proprietário primeiro com npm run admin.');
  if (db.prepare('SELECT 1 FROM admin_factors').get())
    throw new Error('Segundo fator já configurado.');
  const location = resolve(output);
  const fromPublic = relative(resolve('dist'), location);
  if (!fromPublic || (!fromPublic.startsWith('..') && !isAbsolute(fromPublic)))
    throw new Error('Use um arquivo fora da pasta pública.');
  const secret = base32(randomBytes(20));
  const recoveryCodes = Array.from({ length: 10 }, () =>
    randomBytes(12).toString('hex').toUpperCase(),
  );
  const uri = `otpauth://totp/Voz%20do%20Professor:Proprietario?secret=${secret}&issuer=Voz%20do%20Professor&algorithm=SHA1&digits=6&period=30`;
  writeFileSync(location, JSON.stringify({ secret, uri, recoveryCodes }, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO admin_factors(user_id,secret) VALUES(?,?)').run(owner.id, secret);
    for (const code of recoveryCodes)
      db.prepare('INSERT INTO admin_recovery VALUES(?,?)').run(owner.id, hash(code));
    db.prepare('DELETE FROM admin_sessions').run();
    db.prepare('DELETE FROM admin_login_budget').run();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
export function base32(bytes) {
  let bits = 0,
    value = 0,
    output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += alphabet[(value >>> bits) & 31];
    }
  }
  if (bits) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}
function decode(secret) {
  if (!/^[A-Z2-7]{32}$/.test(secret)) throw new Error('Chave TOTP inválida.');
  let bits = 0,
    value = 0;
  const bytes = [];
  for (const char of secret) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  return Buffer.from(bytes);
}
// RFC 6238: SHA-1, 30-second steps, six digits (authenticator defaults).
export function totp(secret, step = Math.floor(Date.now() / 30000), digits = 6) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', decode(secret)).update(counter).digest();
  const offset = digest[19] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).padStart(digits, '0');
}
export function consumeSecondFactor(db, userId, code, at = Date.now()) {
  const factor = db.prepare('SELECT * FROM admin_factors WHERE user_id=?').get(userId);
  if (!factor) return false;
  const value = String(code || '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
  if (/^\d{6}$/.test(value)) {
    const step = Math.floor(at / 30000);
    for (const candidate of [step, step - 1, step + 1]) {
      if (candidate < 0 || candidate <= factor.last_step) continue;
      if (timingSafeEqual(Buffer.from(value), Buffer.from(totp(factor.secret, candidate)))) {
        return (
          db
            .prepare('UPDATE admin_factors SET last_step=? WHERE user_id=? AND last_step<?')
            .run(candidate, userId, candidate).changes === 1
        );
      }
    }
    return false;
  }
  if (!/^[A-F0-9]{24}$/.test(value)) return false;
  return (
    db
      .prepare('DELETE FROM admin_recovery WHERE user_id=? AND code_hash=?')
      .run(userId, hash(value)).changes === 1
  );
}

// Single-owner budget is persisted, so spoofed proxy headers/restarts cannot reset it.
export function loginBudget(db, at = Date.now()) {
  db.prepare('DELETE FROM admin_login_budget WHERE until<=?').run(at);
  db.prepare(
    'INSERT INTO admin_login_budget VALUES(1,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1',
  ).run(at + 15 * 60000);
  const row = db.prepare('SELECT * FROM admin_login_budget WHERE id=1').get();
  return { allowed: row.attempts <= 6, retryAfter: Math.ceil((row.until - at) / 1000) };
}
