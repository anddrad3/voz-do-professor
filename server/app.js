import express from 'express';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import { sessionMiddleware, csrf, limiter } from './security.js';
import { records, unpack } from './db.js';
import { filterRecords } from '../shared/filter.js';
import { featureForKind } from '../shared/features.js';
import { settings } from './modules/settings.js';
import { admin } from './modules/admin.js';
import { adminAuth } from './modules/admin-auth.js';
import { mediaDirectory } from './modules/news-media.js';
import { assistantRouter } from './modules/assistant.js';
import { statistics, defaultPeriod, periodSchema } from './modules/statistics.js';
function foundation() {
  const app = express();
  app.disable('x-powered-by');
  const prefix = (process.env.BASE_PATH || '').replace(/\/$/, '');
  if (prefix)
    app.use((req, res, next) => {
      if (req.url === prefix) return res.redirect(308, prefix + '/');
      if (req.url.startsWith(prefix + '/')) req.url = req.url.slice(prefix.length);
      next();
    });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'"],
          imgSrc: [
            "'self'",
            'data:',
            'https://*.tile.openstreetmap.org',
            'https://www.google.com',
            'https://www.gstatic.com',
          ],
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
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  return app;
}
function errors(app) {
  app.use((error, req, res, next) => {
    if (error instanceof ZodError)
      return res
        .status(400)
        .json({ error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: status >= 500 ? 'Não foi possível concluir a operação.' : error.message });
  });
  return app;
}
export function createApp(db, { staticDir = resolve('dist'), automation, gemini } = {}) {
  const app = foundation();
  if (process.env.ADMIN_WEB_ENABLED === 'true') {
    if (
      process.env.ADMIN_HTTPS !== 'true' ||
      !/^https:\/\/[^/]+$/.test(process.env.ADMIN_ORIGIN || '') ||
      !db.prepare('SELECT 1 FROM admin_factors LIMIT 1').get()
    )
      throw new Error('Painel web exige HTTPS, ADMIN_ORIGIN e segundo fator provisionado.');
    const management = createAdminApp(db, { staticDir, automation });
    app.use((req, res, next) => {
      if (
        req.path === '/painel' ||
        req.path === '/painel/' ||
        req.path === '/api/admin' ||
        req.path.startsWith('/api/admin/')
      )
        return management(req, res, next);
      next();
    });
  }
  if (gemini) app.use('/api/assistant', assistantRouter(db, gemini));
  // Only the bounded AI router accepts public POSTs; no visitor accounts or uploads.
  app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method))
      return res.status(405).json({ error: 'Este site não recebe dados de visitantes.' });
    next();
  });
  const allowed = (r) =>
    r &&
    settings(db).features[
      r.kind === 'opportunity' && ['Concurso público', 'Processo simplificado'].includes(r.type)
        ? 'contests'
        : featureForKind(r.kind)
    ] &&
    (!r.demo || process.env.DEMO_MODE === 'true') &&
    r.kind !== 'school' &&
    !(
      r.kind === 'opportunity' && !['Concurso público', 'Processo simplificado'].includes(r.type)
    ) &&
    !(r.kind === 'content' && r.type === 'Piso salarial');
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/statistics', (req, res) => {
    if (!settings(db).features.statistics) return res.sendStatus(404);
    const period = Object.keys(req.query).length ? periodSchema.parse(req.query) : defaultPeriod();
    const { digest, ...report } = statistics(db, period);
    res.json(report);
  });
  app.get('/media/:file', (req, res) => {
    if (
      !settings(db).features.content ||
      !/^[a-f0-9]{40}\.jpg$/.test(req.params.file) ||
      !db
        .prepare(
          "SELECT 1 FROM records WHERE status='published' AND kind='content' AND demo=0 AND json_extract(data,'$.image')=?",
        )
        .get(req.params.file)
    )
      return res.sendStatus(404);
    res.set('Cache-Control', 'public, max-age=3600');
    res.sendFile(resolve(mediaDirectory(), req.params.file));
  });
  app.get('/api/config', (req, res) =>
    res.json({
      ...settings(db),
      demo: process.env.DEMO_MODE === 'true',
      ai: {
        catalog: !!gemini?.status().enabled,
        interactive: !!gemini?.status().interactiveEnabled,
      },
    }),
  );
  app.get('/api/records/:kind', (req, res) => {
    if (req.params.kind === 'school') return res.json([]);
    if (req.params.kind === 'contests')
      return res.json(
        settings(db).features.contests
          ? filterRecords(
              records(db, 'opportunity').filter(
                (r) =>
                  (!r.demo || process.env.DEMO_MODE === 'true') &&
                  ['Concurso público', 'Processo simplificado'].includes(r.type),
              ),
              {},
            )
          : [],
      );
    if (!['content', 'school', 'opportunity', 'survey', 'story'].includes(req.params.kind))
      return res.status(404).json({ error: 'Área não encontrada.' });
    // Same public dataset for everyone; preferences and coordinates are never needed here.
    res.json(filterRecords(records(db, req.params.kind).filter(allowed), {}));
  });
  app.get('/api/record/:id', (req, res) => {
    const r = unpack(
      db.prepare("SELECT * FROM records WHERE id=? AND status='published'").get(req.params.id),
    );
    if (!allowed(r)) return res.status(404).json({ error: 'Publicação indisponível.' });
    res.json(filterRecords([r], {})[0]);
  });
  app.get('/api/history/:id', (req, res) => {
    const r = unpack(
      db.prepare("SELECT * FROM records WHERE id=? AND status='published'").get(req.params.id),
    );
    if (!allowed(r)) return res.status(404).json({ error: 'Publicação indisponível.' });
    res.json(
      db
        .prepare(
          "SELECT actor,created_at,data FROM revisions WHERE record_id=? AND action='published' ORDER BY id DESC LIMIT 20",
        )
        .all(r.id)
        .map((v) => ({
          reviewer: v.actor,
          date: v.created_at,
          title: JSON.parse(v.data).title,
          sourceUrl: JSON.parse(v.data).sourceUrl,
          summary: JSON.parse(v.data).summary || '',
        })),
    );
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.use((req, res, next) => {
    if (/^\/(admin(?:\.html)?|gestao)(\/|$)/.test(req.path)) return res.sendStatus(404);
    if (
      req.path.startsWith('/formularios/') &&
      !settings(db).features.voice &&
      !settings(db).features.survey
    )
      return res.sendStatus(404);
    next();
  });
  app.use(express.static(staticDir, { index: false }));
  app.get('/{*path}', (req, res) => res.sendFile(resolve(staticDir, 'index.html')));
  return errors(app);
}
export function createAdminApp(db, { staticDir = resolve('dist'), automation } = {}) {
  const app = foundation();
  app.use((req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    });
    next();
  });
  app.use('/api/admin', limiter(120));
  app.use('/api/admin', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = process.env.ADMIN_ORIGIN || 'http://127.0.0.1:3002';
      if (
        (req.headers.origin && req.headers.origin !== origin) ||
        req.headers['sec-fetch-site'] === 'cross-site'
      )
        return res.status(403).json({ error: 'Origem não autorizada.' });
      if (!req.is('application/json')) return res.sendStatus(415);
    }
    next();
  });
  app.use(express.json({ limit: '100kb' }), sessionMiddleware(db), csrf);
  app.use('/api/admin/auth', adminAuth(db));
  app.use('/api/admin', admin(db, { automation }));
  app.use('/api', (req, res) => res.sendStatus(404));
  app.use('/assets', express.static(resolve(staticDir, 'assets')));
  app.get('/logo.png', (req, res) => res.sendFile(resolve(staticDir, 'logo.png')));
  app.get('/', (req, res) => res.sendFile(resolve(staticDir, 'admin.html')));
  app.get(['/painel', '/painel/'], (req, res) => res.sendFile(resolve(staticDir, 'admin.html')));
  return errors(app);
}
