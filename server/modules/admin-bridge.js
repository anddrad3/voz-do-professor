import { mkdir, chmod, lstat, readdir, open, rename, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';

export const REQUEST_LIMIT = 100 * 1024;
const FILE_LIMIT = 150 * 1024,
  RESPONSE_LIMIT = 4 * 1024 * 1024;
const TTL = 60000,
  ID = /^[a-f0-9]{32}$/;
const kinds = '(?:story|content|school|opportunity|survey)';
const recordId = '[A-Za-z0-9_-]{1,100}';

export function validateBridgeRequest(request, basePath = '') {
  if (!request || typeof request !== 'object') throw new Error('Invalid request');
  const { method, url, body = '', headers = {} } = request;
  if (
    typeof url !== 'string' ||
    !url.startsWith(`${basePath}/`) ||
    /[%?\\\r\n]/.test(url) ||
    url.includes('..')
  )
    throw new Error('Invalid path');
  const path = url.slice(basePath.length);
  const read = ['GET', 'HEAD'].includes(method);
  const allowed =
    (read &&
      (/^\/$|^\/logo\.png$|^\/assets\/[A-Za-z0-9_-]+\.(?:js|css)$/.test(path) ||
        /^\/api\/admin\/(?:auth\/session|settings|automation|quality)$/.test(path) ||
        new RegExp(`^/api/admin/records/${kinds}$`).test(path))) ||
    (method === 'POST' &&
      (/^\/api\/admin\/(?:auth\/(?:login|logout)|automation\/run)$/.test(path) ||
        new RegExp(`^/api/admin/records/(?:${kinds}|${recordId}/(?:publish|archive))$`).test(
          path,
        ))) ||
    (method === 'PUT' &&
      (path === '/api/admin/settings' ||
        new RegExp(`^/api/admin/records/${kinds}/${recordId}$`).test(path)));
  if (!allowed) throw new Error('Route not allowed');
  if (
    typeof body !== 'string' ||
    body.length > 140000 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body)
  )
    throw new Error('Invalid body');
  const bytes = Buffer.from(body, 'base64');
  if (bytes.length > REQUEST_LIMIT || (read && bytes.length)) throw new Error('Body limit');
  const safeHeaders = {};
  for (const name of ['content-type', 'cookie', 'origin', 'x-csrf-token']) {
    if (headers[name] === undefined) continue;
    if (
      typeof headers[name] !== 'string' ||
      headers[name].length > 8192 ||
      /[\r\n]/.test(headers[name])
    )
      throw new Error('Invalid header');
    safeHeaders[name] = headers[name];
  }
  return { method, url, headers: safeHeaders, bytes };
}

export async function privateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (typeof process.getuid === 'function' && info.uid !== process.getuid())
  )
    throw new Error('Unsafe bridge directory');
  await chmod(directory, 0o700);
  return resolve(directory);
}
async function readPrivate(path, maxBytes) {
  // Opening before stat revalidates NFS metadata after another host writes a response.
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const info = await file.stat();
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.size > maxBytes ||
      (typeof process.getuid === 'function' && (info.uid !== process.getuid() || info.mode & 0o077))
    )
      throw new Error('Unsafe bridge file');
    return JSON.parse(await file.readFile('utf8'));
  } finally {
    await file.close();
  }
}
async function writeAtomic(directory, id, extension, value) {
  const path = join(directory, `${id}.${extension}.tmp`);
  const file = await open(path, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(value));
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(path, join(directory, `${id}.${extension}`));
}
const remove = (path) => unlink(path).catch(() => {});

export async function relayAdminRequest(
  directory,
  request,
  { timeout = 35000, basePath = '/voz-do-professor' } = {},
) {
  validateBridgeRequest(request, basePath);
  const id = randomBytes(16).toString('hex');
  const reqPath = join(directory, `${id}.req`),
    resPath = join(directory, `${id}.res`);
  try {
    await writeAtomic(directory, id, 'req', { expires: Date.now() + timeout, request });
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      try {
        return await readPrivate(resPath, RESPONSE_LIMIT * 1.4);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await sleep(100);
    }
    throw new Error('Bridge timeout');
  } finally {
    await Promise.all([reqPath, resPath, join(directory, `${id}.req.tmp`)].map(remove));
  }
}

// Both hosts share private storage. Only the HTTP host accesses the database.
export async function startAdminBridge({
  directory,
  port,
  socketPath,
  basePath = '',
  interval = 750,
}) {
  if (!directory) return async () => {};
  directory = await privateDirectory(directory);
  let active = null,
    stopped = false;
  async function poll() {
    const files = await readdir(directory);
    const pending = [];
    for (const name of files) {
      if (!/^[a-f0-9]{32}\.(?:req|res)(?:\.tmp)?$/.test(name)) continue;
      const path = join(directory, name);
      const info = await lstat(path).catch(() => null);
      if (!info) continue;
      if (Date.now() - info.mtimeMs > TTL) {
        await remove(path);
        continue;
      }
      if (name.endsWith('.req') && pending.length < 8) pending.push(name);
    }
    await Promise.all(
      pending.map(async (name) => {
        const id = name.slice(0, 32),
          path = join(directory, name);
        if (!ID.test(id)) return;
        let result,
          stage = 'read';
        try {
          const envelope = await readPrivate(path, FILE_LIMIT);
          await remove(path);
          if (
            !Number.isFinite(envelope.expires) ||
            envelope.expires < Date.now() ||
            envelope.expires > Date.now() + TTL
          )
            return;
          stage = 'validate';
          const request = validateBridgeRequest(envelope.request, basePath);
          stage = 'local-request';
          result = await new Promise((done, reject) => {
            const local = httpRequest(
              {
                ...(socketPath ? { socketPath } : { hostname: '127.0.0.1', port }),
                path: request.url,
                method: request.method,
                headers: request.headers,
                agent: false,
              },
              async (response) => {
                try {
                  let size = 0;
                  const chunks = [];
                  for await (const chunk of response) {
                    size += chunk.length;
                    if (size > RESPONSE_LIMIT) throw new Error('Response limit');
                    chunks.push(chunk);
                  }
                  const headers = { ...response.headers };
                  for (const name of [
                    'content-length',
                    'content-encoding',
                    'transfer-encoding',
                    'connection',
                  ])
                    delete headers[name];
                  headers['cache-control'] = 'no-store';
                  done({
                    status: response.statusCode,
                    headers,
                    body: Buffer.concat(chunks).toString('base64'),
                  });
                } catch (error) {
                  response.destroy();
                  reject(error);
                }
              },
            );
            local.on('error', reject);
            local.setTimeout(Math.max(1, Math.min(25000, envelope.expires - Date.now())), () =>
              local.destroy(new Error('Local timeout')),
            );
            local.end(request.bytes);
          });
        } catch (error) {
          const code = String(error.cause?.code || error.code || error.name || 'Error')
            .replace(/[^A-Za-z0-9_]/g, '')
            .slice(0, 40);
          console.error(`[admin-bridge] Falha na etapa ${stage} (${code}); conteúdo omitido.`);
          await remove(path);
          result = {
            status: 502,
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
            body: Buffer.from(JSON.stringify({ error: 'Conexão privada indisponível.' })).toString(
              'base64',
            ),
          };
        }
        await writeAtomic(directory, id, 'res', result);
      }),
    );
  }
  const timer = setInterval(() => {
    if (active || stopped) return;
    active = poll()
      .catch(() => {
        console.error('[admin-bridge] Falha de acesso ao diretório privado.');
      })
      .finally(() => {
        active = null;
      });
  }, interval);
  timer.unref();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await active;
  };
}
