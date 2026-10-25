import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const { openDatabase } = await import('./db.js');
const { createApp, createAdminApp } = await import('./app.js');
const { seedDemo } = await import('./seed.js');
const { createAutomation } = await import('./modules/automation.js');
const { scheduleRfb } = await import('./modules/rfb.js');
const db = openDatabase();
if (
  process.env.NODE_ENV === 'production' &&
  db.prepare("SELECT 1 FROM metadata WHERE key='demo-seeded-v1'").get()
)
  throw new Error('Use um banco de produção separado da demonstração.');
if (process.env.DEMO_MODE === 'true') seedDemo(db);
const automation = createAutomation(db);
const port = Number(process.env.PORT) || 3001,
  host = process.env.HOST || process.env.IP || '127.0.0.1';
const server = createApp(db).listen(port, host, () =>
  console.log(`Voz do Professor: http://${host}:${port}`),
);
// Admin socket is deliberately loopback-only. Reach it remotely through an SSH tunnel.
const adminServer =
  process.env.ADMIN_ENABLED === 'false'
    ? null
    : createAdminApp(db, { automation }).listen(
        Number(process.env.ADMIN_PORT) || 3002,
        '127.0.0.1',
        () => console.log('Gestão privada: http://127.0.0.1:3002 (somente local / túnel SSH)'),
      );
if (process.env.AUTO_SYNC !== 'false') automation.start();
const stopRfb = scheduleRfb(db);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    automation.stop();
    stopRfb();
    adminServer?.close();
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
