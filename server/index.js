import { existsSync } from 'node:fs';
import { chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { once } from 'node:events';
if (existsSync('.env')) process.loadEnvFile('.env');
const { openDatabase } = await import('./db.js');
const { createApp, createAdminApp } = await import('./app.js');
const { seedDemo } = await import('./seed.js');
const { createDailyAI } = await import('./modules/daily-ai.js');
const { createGemini } = await import('./modules/gemini.js');
const { startAdminBridge, privateDirectory } = await import('./modules/admin-bridge.js');
const db = openDatabase();
// Provision on the HTTP host, which owns SQLite; SSH and HTTP can be separate hosts.
if (
  process.env.ADMIN_WEB_ENABLED === 'true' &&
  process.env.ADMIN_2FA_SETUP_FILE &&
  !db.prepare('SELECT 1 FROM admin_factors LIMIT 1').get()
) {
  const { provisionSecondFactor } = await import('./modules/totp.js');
  provisionSecondFactor(db, process.env.ADMIN_2FA_SETUP_FILE);
}
if (
  process.env.NODE_ENV === 'production' &&
  db.prepare("SELECT 1 FROM metadata WHERE key='demo-seeded-v1'").get()
)
  throw new Error('Use um banco de produção separado da demonstração.');
if (process.env.DEMO_MODE === 'true') seedDemo(db);
const gemini = createGemini(db);
const automation = createDailyAI(db, gemini);
const port = Number(process.env.PORT) || 3001,
  host = process.env.HOST || process.env.IP || '127.0.0.1';
const server = createApp(db, { automation, gemini }).listen(port, host, () =>
  console.log(`Voz do Professor: http://${host}:${port}`),
);
const bridgeDirectory =
  process.env.ADMIN_ENABLED !== 'false' && process.env.ADMIN_BRIDGE_DIR
    ? await privateDirectory(process.env.ADMIN_BRIDGE_DIR)
    : null;
const adminSocket = bridgeDirectory
  ? join(bridgeDirectory, `admin-${randomBytes(6).toString('hex')}.sock`)
  : null;
// A private Unix socket avoids exposing any administrative TCP port on the host.
const adminServer =
  process.env.ADMIN_ENABLED === 'false'
    ? null
    : createAdminApp(db, { automation }).listen(
        adminSocket
          ? { path: adminSocket }
          : { port: Number(process.env.ADMIN_PORT) || 3002, host: '127.0.0.1' },
      );
if (adminServer) {
  await once(adminServer, 'listening');
  if (adminSocket) await chmod(adminSocket, 0o600);
  console.log(
    adminSocket ? 'Gestão privada: socket local protegido.' : 'Gestão privada: somente loopback.',
  );
}
if (process.env.AUTO_SYNC !== 'false') automation.start();
const stopAdminBridge = await startAdminBridge({
  directory: adminServer ? process.env.ADMIN_BRIDGE_DIR : undefined,
  port: Number(process.env.ADMIN_PORT) || 3002,
  socketPath: adminSocket,
  basePath: process.env.BASE_PATH || '',
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    automation.stop();
    await stopAdminBridge();
    adminServer?.close();
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
