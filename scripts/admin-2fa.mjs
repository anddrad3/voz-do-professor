import { existsSync } from 'node:fs';
import { openDatabase } from '../server/db.js';
import { provisionSecondFactor } from '../server/modules/totp.js';
if (existsSync('.env')) process.loadEnvFile('.env');
const output = process.argv[2];
if (!output) throw new Error('Informe um arquivo privado fora da pasta pública.');
const db = openDatabase();
try {
  provisionSecondFactor(db, output);
  console.log(
    'Segundo fator configurado; sessões antigas encerradas. Chave e recuperação salvas no arquivo privado informado.',
  );
} finally {
  db.close();
}
