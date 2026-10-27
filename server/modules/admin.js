import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../security.js';
import { records, unpack, now } from '../db.js';
import { saveRecord, publishRecord, audit, qualityReport } from '../domain.js';
import { settings, setFeatures } from './settings.js';
import { FEATURES } from '../../shared/features.js';
import { releaseInfo } from './releases.js';
export function admin(db, { automation } = {}) {
  const r = Router();
  r.use(requireAdmin);
  r.get('/changelog', (req, res) => res.json(releaseInfo()));
  r.delete('/stories/:id', (req, res) => {
    z.object({ confirmation: z.literal('EXCLUIR') })
      .strict()
      .parse(req.body);
    const row = db.prepare("SELECT id FROM records WHERE id=? AND kind='story'").get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Relato não encontrado.' });
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM revisions WHERE record_id=?').run(row.id);
      db.prepare("DELETE FROM records WHERE id=? AND kind='story'").run(row.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    res.json({ ok: true });
  });
  r.get('/settings', (req, res) => res.json(settings(db)));
  r.put('/settings', (req, res) => {
    const schema = z
      .object(Object.fromEntries(Object.keys(FEATURES).map((k) => [k, z.boolean()])))
      .strict();
    res.json(setFeatures(db, schema.parse(req.body.features)));
  });
  r.get('/automation', (req, res) =>
    res.json({
      jobs: db.prepare('SELECT * FROM imports ORDER BY started_at DESC LIMIT 30').all(),
      sources: automation?.sources || [],
      ai: automation?.gemini?.status() || null,
      daily: db.prepare('SELECT * FROM ai_daily_runs ORDER BY day DESC LIMIT 30').all(),
    }),
  );
  r.post('/automation/run', (req, res) => {
    if (!automation) return res.status(503).json({ error: 'Sincronização indisponível.' });
    void automation.run();
    res.status(202).json({ ok: true });
  });
  r.post('/automation/pause', (req, res) => {
    const { paused } = z.object({ paused: z.boolean() }).strict().parse(req.body);
    db.prepare(
      "INSERT INTO metadata VALUES('ai-owner-paused',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    ).run(String(paused));
    res.json({ paused });
  });
  r.get('/records/:kind', (req, res) => res.json(records(db, req.params.kind, false)));
  r.post('/records/:kind', (req, res) =>
    res.status(201).json(saveRecord(db, req.params.kind, req.body, req.user.name)),
  );
  r.put('/records/:kind/:id', (req, res) => {
    if (!db.prepare('SELECT 1 FROM records WHERE id=?').get(req.params.id))
      return res.status(404).json({ error: 'Registro não encontrado.' });
    res.json(saveRecord(db, req.params.kind, req.body, req.user.name, req.params.id));
  });
  r.post('/records/:id/publish', (req, res) => {
    z.object({ attestation: z.literal(true) }).parse(req.body);
    res.json(publishRecord(db, req.params.id, req.user.name));
  });
  r.post('/records/:id/archive', (req, res) => {
    const record = unpack(db.prepare('SELECT * FROM records WHERE id=?').get(req.params.id));
    if (!record) return res.status(404).json({ error: 'Registro não encontrado.' });
    db.prepare("UPDATE records SET status='archived',updated_at=? WHERE id=?").run(
      now(),
      record.id,
    );
    audit(db, record.id, req.user.name, 'archived', record);
    res.json({ ok: true });
  });
  r.get('/quality', (req, res) => res.json(qualityReport(db)));
  return r;
}
