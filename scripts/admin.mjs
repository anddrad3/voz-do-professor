import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { randomUUID } from 'node:crypto';
import { openDatabase, now } from '../server/db.js';
import { passwordHash } from '../server/security.js';
if (existsSync('.env')) process.loadEnvFile('.env');
const rl = createInterface({ input: process.stdin, output: process.stdout });
const email = (await rl.question('E-mail do administrador: ')).trim().toLowerCase();
const name = (await rl.question('Nome público do responsável pela curadoria: ')).trim();
console.log(
  'A senha será criada automaticamente e exibida uma única vez. Guarde-a em um gerenciador de senhas.',
);
rl.close();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || name.length < 2)
  throw new Error('E-mail ou nome inválido.');
const db = openDatabase();
if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email))
  throw new Error(
    'Conta já existe. Use o comando SQL documentado para promover uma conta sob controle do operador.',
  );
const password = randomUUID() + randomUUID().slice(0, 8);
db.prepare(
  "INSERT INTO users(id,email,name,password,role,consent_at,created_at) VALUES(?,?,?,?,'admin',?,?)",
).run(randomUUID(), email, name, await passwordHash(password), now(), now());
db.close();
console.log(`Administrador criado. Senha inicial: ${password}`);
