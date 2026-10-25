import { spawn } from 'node:child_process';
const env = {
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_PATH: process.env.DATABASE_PATH || 'data/demo-v2.sqlite',
  DEMO_MODE: process.env.DEMO_MODE ?? 'true',
};
const children = [
  spawn(process.execPath, ['--watch', 'server/index.js'], { stdio: 'inherit', env }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit', env }),
];
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    children.forEach((p) => p.kill());
    process.exit(0);
  });
for (const child of children)
  child.on('exit', (code) => {
    if (code) {
      children.forEach((p) => p.kill());
      process.exit(code);
    }
  });
