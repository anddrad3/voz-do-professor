import { Router, json } from 'express';
import { limiter } from '../security.js';
import { settings } from './settings.js';
import { questionSchema, aiConfig } from './gemini.js';
import { recordQuery } from './statistics.js';
const feature = {
  jobs: 'opportunity',
  news: 'content',
  law: 'content',
  salary: 'content',
  contests: 'contests',
  search: 'search',
};
export function assistantRouter(db, gemini) {
  const r = Router();
  r.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  r.get('/status', (req, res) =>
    res.json({
      enabled: !!gemini?.status().interactiveEnabled,
      schedule: '08:00',
      timezone: 'America/Sao_Paulo',
    }),
  );
  r.post(
    '/ask',
    limiter(12),
    (req, res, next) => {
      if (
        req.headers.origin !== aiConfig().origin ||
        req.headers['sec-fetch-site'] === 'cross-site'
      )
        return res.status(403).json({ error: 'Origem não autorizada.' });
      if (!req.is('application/json')) return res.sendStatus(415);
      next();
    },
    json({ limit: '6kb' }),
    async (req, res) => {
      const question = questionSchema.parse(req.body);
      if (!settings(db).features[feature[question.topic]])
        return res.status(403).json({ error: 'Esta ferramenta está desativada.' });
      if (!gemini) return res.status(503).json({ error: 'A IA ainda não foi ativada.' });
      const answer = await gemini.ask(question, req.socket.remoteAddress || 'unknown');
      recordQuery(db, question);
      const sources = (answer.grounding?.groundingChunks || [])
        .map((c) => c.web)
        .filter((c) => {
          try {
            const u = new URL(c?.uri);
            return u.protocol === 'https:' && !u.username && !u.password;
          } catch {
            return false;
          }
        })
        .map((c) => ({ title: String(c.title || 'Fonte consultada').slice(0, 240), url: c.uri }));
      res.json({
        text: answer.text,
        sources,
        searchSuggestions: answer.grounding.searchEntryPoint.renderedContent,
        generatedAt: answer.generatedAt,
        model: answer.model,
      });
    },
  );
  return r;
}
