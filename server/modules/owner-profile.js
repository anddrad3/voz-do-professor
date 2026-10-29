import { z } from 'zod';
export const ownerProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    avatar: z
      .string()
      .max(90000)
      .refine((value) => {
        if (!value) return true;
        if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value)) return false;
        const bytes = Buffer.from(value.split(',')[1], 'base64');
        return (
          bytes.length < 67500 &&
          bytes[0] === 255 &&
          bytes[1] === 216 &&
          bytes.at(-2) === 255 &&
          bytes.at(-1) === 217
        );
      }, 'Foto inválida. Use o seletor de imagens do painel.'),
  })
  .strict();
export function ownerProfile(db, user) {
  return {
    name: user.name,
    avatar:
      db.prepare('SELECT value FROM metadata WHERE key=?').get('owner-avatar:' + user.id)?.value ||
      '',
  };
}
export function saveOwnerProfile(db, user, data) {
  const profile = ownerProfileSchema.parse(data);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE admin_users SET name=? WHERE id=?').run(profile.name, user.id);
    db.prepare(
      'INSERT INTO metadata VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    ).run('owner-avatar:' + user.id, profile.avatar);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return profile;
}
