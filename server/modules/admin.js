import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../security.js';
import { records, unpack, now } from '../db.js';
import { saveRecord, publishRecord, audit, qualityReport } from '../domain.js';
import { settings, setFeatures } from './settings.js';
import { FEATURES } from '../../shared/features.js';
export function admin(db, { automation } = {}) {
  const r = Router();
  r.use(requireAdmin);
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
    }),
  );
  r.post('/automation/run', (req, res) => {
    if (!automation) return res.status(503).json({ error: 'Sincronização indisponível.' });
    void automation.run();
    res.status(202).json({ ok: true });
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
