import { existsSync } from 'node:fs';
import { openDatabase } from '../server/db.js';
import { runManifest } from '../server/modules/imports.js';
if (existsSync('.env')) process.loadEnvFile('.env');
const path = process.argv[2] || process.env.IMPORT_MANIFEST;
if (!path) throw new Error('Uso: npm run import -- caminho/manifesto.json');
const db = openDatabase();
try {
  console.log(JSON.stringify(await runManifest(db, path), null, 2));
} finally {
  db.close();
}
