import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import {
  privateDirectory,
  relayAdminRequest,
  validateBridgeRequest,
  REQUEST_LIMIT,
} from '../server/modules/admin-bridge.js';

const basePath = '/voz-do-professor';
if (process.argv[2] === '--relay') {
  process.umask(0o077);
  const directory = await privateDirectory('apps/voz-do-professor/shared/admin-bridge');
  let active = 0;
  let waking = null,
    lastWake = 0;
  async function ensureWebAwake() {
    if (Date.now() - lastWake < 20000) return;
    if (!waking)
      waking = (async () => {
        const response = await fetch(
          'https://amerindia.alwaysdata.net/voz-do-professor/api/health',
          {
            signal: AbortSignal.timeout(15000),
            redirect: 'error',
          },
        );
        await response.arrayBuffer();
        if (!response.ok) throw new Error('Site unavailable');
        lastWake = Date.now();
      })().finally(() => {
        waking = null;
      });
    await waking;
  }
  createInterface({ input: process.stdin }).on('line', async (line) => {
    let id;
    try {
      if (line.length > 150 * 1024) return;
      const message = JSON.parse(line);
      id = message.id;
      if (!/^[a-f0-9]{32}$/.test(id)) return;
      if (active >= 12) throw new Error('Busy');
      active++;
      try {
        await ensureWebAwake();
        const response = await relayAdminRequest(directory, message.request, { basePath });
        process.stdout.write(JSON.stringify({ id, response }) + '\n');
      } finally {
        active--;
      }
    } catch {
      if (id)
        process.stdout.write(
          JSON.stringify({
            id,
            response: {
              status: 502,
              headers: { 'content-type': 'application/json' },
              body: Buffer.from('{"error":"Conexão privada indisponível."}').toString('base64'),
            },
          }) + '\n',
        );
    }
  });
} else {
  const [host, key, knownHosts] = process.argv.slice(2);
  if (!host || !key || !knownHosts || host.startsWith('-'))
    throw new Error('Uso: node scripts/admin-bridge.mjs usuario@ssh-host chave known_hosts');
  const child = spawn(
    'ssh',
    [
      '-T',
      '-o',
      'BatchMode=yes',
      '-o',
      'StrictHostKeyChecking=yes',
      '-o',
      'IdentitiesOnly=yes',
      '-o',
      'ServerAliveInterval=30',
      '-o',
      'ServerAliveCountMax=3',
      '-o',
      `UserKnownHostsFile=${knownHosts}`,
      '-i',
      key,
      host,
      'node apps/voz-do-professor/current/scripts/admin-bridge.mjs --relay',
    ],
    { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true },
  );
  const pending = new Map();
  let disconnected = false;
  const fail = (res) => {
    if (!res.writableEnded)
      res
        .writeHead(502, { 'content-type': 'application/json' })
        .end('{"error":"Conexão SSH indisponível."}');
  };
  createInterface({ input: child.stdout }).on('line', (line) => {
    try {
      const { id, response } = JSON.parse(line),
        item = pending.get(id);
      if (!item) return;
      clearTimeout(item.timer);
      pending.delete(id);
      item.res.writeHead(response.status, response.headers);
      item.res.end(Buffer.from(response.body, 'base64'));
    } catch {
      /* Never log passwords, cookies or payloads. */
    }
  });
  const server = createServer(async (req, res) => {
    if (disconnected) return fail(res);
    if (
      req.headers.host !== '127.0.0.1:3002' ||
      (req.headers.origin && req.headers.origin !== 'http://127.0.0.1:3002') ||
      req.headers['sec-fetch-site'] === 'cross-site'
    ) {
      res.writeHead(403).end();
      return;
    }
    if (pending.size >= 12) {
      res.writeHead(429).end();
      return;
    }
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > REQUEST_LIMIT) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const request = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString('base64'),
      };
      const validated = validateBridgeRequest(request, basePath);
      request.headers = validated.headers;
      const id = randomBytes(16).toString('hex');
      const timer = setTimeout(() => {
        pending.delete(id);
        fail(res);
      }, 40000);
      pending.set(id, { res, timer });
      child.stdin.write(JSON.stringify({ id, request }) + '\n');
    } catch {
      if (!res.writableEnded) res.writeHead(400).end();
    }
  });
  const close = () => {
    disconnected = true;
    server.close();
    for (const { res, timer } of pending.values()) {
      clearTimeout(timer);
      fail(res);
    }
    pending.clear();
  };
  child.on('exit', close);
  child.on('error', () => {
    console.error('Não foi possível iniciar SSH.');
    close();
    process.exitCode = 1;
  });
  child.stdin.on('error', close);
  server.on('error', () => {
    console.error('Porta 3002 indisponível. Feche outro painel aberto.');
    child.kill();
    close();
    process.exitCode = 1;
  });
  server.listen(3002, '127.0.0.1', () =>
    console.log('Painel: http://127.0.0.1:3002/voz-do-professor/ — mantenha esta janela aberta.'),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => {
      child.kill();
      close();
    });
}
