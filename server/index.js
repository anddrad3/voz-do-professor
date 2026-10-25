import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const { openDatabase } = await import('./db.js');
const { createApp } = await import('./app.js');
const { seedDemo } = await import('./seed.js');
const { scheduleImports } = await import('./modules/imports.js');
const db = openDatabase();
if (
  process.env.NODE_ENV === 'production' &&
  db.prepare("SELECT 1 FROM metadata WHERE key='demo-seeded-v1'").get()
)
  throw new Error(
    'Banco demonstrativo não pode ser usado em produção. Configure DATABASE_PATH para um banco separado.',
  );
if (process.env.DEMO_MODE === 'true') seedDemo(db);
const server = createApp(db).listen(
  Number(process.env.PORT) || 3001,
  process.env.HOST || '127.0.0.1',
  () =>
    console.log(
      `Voz do Professor: http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3001}`,
    ),
);
const stopImports = scheduleImports(db);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopImports();
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
