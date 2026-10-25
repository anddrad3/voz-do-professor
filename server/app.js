import express from 'express';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import { encryption, sessionMiddleware, csrf, limiter } from './security.js';
import { records, unpack } from './db.js';
import { filterRecords } from './domain.js';
import { accounts } from './modules/accounts.js';
import { research } from './modules/research.js';
import { admin } from './modules/admin.js';
export function createApp(db, { staticDir = resolve('dist'), encryptionKey } = {}) {
  const app = express(),
    crypto = encryption(db, encryptionKey);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      strictTransportSecurity: process.env.NODE_ENV === 'production',
    }),
  );
  app.use('/api', limiter(300));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const allowed = new Set([process.env.APP_ORIGIN || 'http://localhost:3001']);
      if (process.env.NODE_ENV !== 'production') {
        allowed.add('http://localhost:5173');
        allowed.add('http://127.0.0.1:5173');
        allowed.add('http://127.0.0.1:3001');
      }
      if (req.headers.origin && !allowed.has(req.headers.origin))
        return res.status(403).json({ error: 'Origem não autorizada.' });
      if (!req.is('application/json')) return res.status(415).json({ error: 'Envie JSON.' });
    }
    next();
  });
  app.use(express.json({ limit: '12mb' }), sessionMiddleware(db), csrf);
  app.get('/api/health', (req, res) =>
    res.json({ ok: true, database: db.prepare('SELECT 1 n').get().n === 1 }),
  );
  app.get('/api/config', (req, res) =>
    res.json({
      demo: process.env.DEMO_MODE === 'true',
      privacyContact: process.env.PRIVACY_CONTACT || '',
      minimumGroup: 10,
    }),
  );
  app.use('/api/account', accounts(db));
  app.use('/api/research', research(db, crypto));
  app.use('/api/admin', admin(db, crypto));
  app.get('/api/records/:kind', (req, res) => {
    if (!['content', 'school', 'opportunity', 'survey'].includes(req.params.kind))
      return res.status(404).json({ error: 'Área não encontrada.' });
    const all = records(db, req.params.kind)
      .filter((r) => !r.demo || process.env.DEMO_MODE === 'true')
      .filter((r) => r.kind !== 'school' || r.active);
    res.json(filterRecords(all, req.query));
  });
  app.get('/api/record/:id', (req, res) => {
    const item = unpack(
      db.prepare("SELECT * FROM records WHERE id=? AND status='published'").get(req.params.id),
    );
    if (!item || (item.demo && process.env.DEMO_MODE !== 'true'))
      return res.status(404).json({ error: 'Registro não encontrado ou aguardando revisão.' });
    res.json(filterRecords([item], {})[0]);
  });
  app.get('/api/history/:id', (req, res) => {
    const visible = db
      .prepare("SELECT * FROM records WHERE id=? AND status='published'")
      .get(req.params.id);
    if (!visible || (visible.demo && process.env.DEMO_MODE !== 'true'))
      return res.status(404).json({ error: 'Registro indisponível.' });
    res.json(
      db
        .prepare(
          "SELECT actor,action,created_at,data FROM revisions WHERE record_id=? AND action='published' ORDER BY id DESC",
        )
        .all(req.params.id)
        .map((r) => ({
          reviewer: r.actor,
          date: r.created_at,
          title: JSON.parse(r.data).title,
          sourceUrl: JSON.parse(r.data).sourceUrl,
          summary: JSON.parse(r.data).summary || '',
        })),
    );
  });
  app.get('/api/territories', (req, res) =>
    res.json(
      [
        ...new Set(
          records(db, 'school')
            .filter((s) => s.active && (!s.demo || process.env.DEMO_MODE === 'true'))
            .map((s) => `${s.city} / ${s.state}`),
        ),
      ].sort(),
    ),
  );
  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.use(express.static(staticDir, { index: false }));
  app.get('/{*path}', (req, res, next) => {
    const day = new Date().toISOString().slice(0, 10);
    db.prepare(
      'INSERT INTO metrics(day,requests) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET requests=requests+1',
    ).run(day);
    res.sendFile(resolve(staticDir, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
  app.use((error, req, res, next) => {
    if (error instanceof ZodError)
      return res
        .status(400)
        .json({ error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    const status = error.status || 500;
    if (status >= 500) console.error('Falha interna:', error.message);
    res.status(status).json({
      error: status >= 500 ? 'Não foi possível concluir. Tente novamente.' : error.message,
    });
  });
  return app;
}
