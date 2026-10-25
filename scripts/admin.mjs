import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { openDatabase } from '../server/db.js';
import { passwordHash } from '../server/security.js';
if (existsSync('.env')) process.loadEnvFile('.env');
const db = openDatabase();
if (db.prepare('SELECT 1 FROM admin_users').get())
  throw new Error('Já existe um proprietário. Nenhuma segunda conta foi criada.');
const rl = createInterface({ input: process.stdin, output: process.stdout });
const name =
  (await rl.question('Nome público do responsável (ou Administração): ')).trim() || 'Administração';
rl.close();
const password = randomBytes(24).toString('base64url');
db.prepare('INSERT INTO admin_users VALUES(?,?,?)').run(
  randomUUID(),
  name,
  await passwordHash(password),
);
db.close();
console.log(
  `Painel local: http://127.0.0.1:3002\nSenha: ${password}\nGuarde no seu gerenciador de senhas. Não há cadastro de visitantes.`,
);
