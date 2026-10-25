import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
export function scheduleRfb(db) {
  if (process.env.RFB_SYNC !== 'true') return () => {};
  let child = null,
    stopped = false;
  const run = () => {
    if (child || stopped) return;
    const last = db
      .prepare("SELECT started_at FROM imports WHERE source='rfb' ORDER BY started_at DESC LIMIT 1")
      .get();
    if (last && Date.now() - Date.parse(last.started_at) < 24 * 3600000) return;
    child = spawn(
      process.env.PYTHON_BIN || 'python3',
      ['scripts/rfb-sync.py', '--database', process.env.DATABASE_PATH || 'data/public-v2.sqlite'],
      { stdio: ['ignore', 'ignore', 'ignore'] },
    );
    child.on('error', () => {
      const at = new Date().toISOString();
      db.prepare('INSERT INTO imports VALUES(?,?,?,?,?,?)').run(
        randomUUID(),
        'rfb',
        at,
        at,
        'failed',
        JSON.stringify({
          error: 'Python indisponível. Confira PYTHON_BIN na configuração do servidor.',
        }),
      );
      child = null;
    });
    child.on('exit', () => {
      child = null;
    });
  };
  const start = setTimeout(run, 30000),
    timer = setInterval(run, 3600000);
  start.unref();
  timer.unref();
  return () => {
    stopped = true;
    clearTimeout(start);
    clearInterval(timer);
    child?.kill();
  };
}
