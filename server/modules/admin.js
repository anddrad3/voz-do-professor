import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../security.js';
import { records, unpack, now } from '../db.js';
import { saveRecord, publishRecord, audit, qualityReport } from '../domain.js';
import { importData } from './imports.js';
export function admin(db, crypto) {
  const r = Router();
  r.use(requireAdmin);
  r.get('/overview', (req, res) =>
    res.json({
      users: db.prepare('SELECT count(*) n FROM users').get().n,
      records: db
        .prepare('SELECT kind,status,count(*) total FROM records GROUP BY kind,status')
        .all(),
      responses: db.prepare('SELECT count(*) n FROM responses').get().n,
      submissions: db
        .prepare('SELECT status,count(*) total FROM submissions GROUP BY status')
        .all(),
      usage: db.prepare('SELECT * FROM metrics ORDER BY day DESC LIMIT 30').all(),
      imports: db
        .prepare('SELECT * FROM imports ORDER BY started_at DESC LIMIT 30')
        .all()
        .map((i) => ({ ...i, summary: JSON.parse(i.summary) })),
    }),
  );
  r.get('/records/:kind', (req, res) => res.json(records(db, req.params.kind, false)));
  r.post('/records/:kind', (req, res) =>
    res.status(201).json(saveRecord(db, req.params.kind, req.body, req.user.name)),
  );
  r.put('/records/:kind/:id', (req, res) => {
    if (!db.prepare('SELECT id FROM records WHERE id=?').get(req.params.id))
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
      req.params.id,
    );
    audit(db, req.params.id, req.user.name, 'archived', record);
    res.json({ ok: true });
  });
  r.get('/history/:id', (req, res) =>
    res.json(
      db
        .prepare('SELECT * FROM revisions WHERE record_id=? ORDER BY id DESC')
        .all(req.params.id)
        .map((r) => ({ ...r, data: JSON.parse(r.data) })),
    ),
  );
  r.get('/quality', (req, res) => res.json(qualityReport(db)));
  r.post('/imports', async (req, res) => {
    const input = z
      .object({
        csv: z.string().max(10 * 1024 * 1024),
        kind: z.enum(['school', 'content', 'opportunity', 'survey']),
        format: z.enum(['normalized', 'cnpj', 'census']),
        sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        delimiter: z.enum([';', ',']).default(';'),
      })
      .parse(req.body);
    if (input.format !== 'normalized' && input.kind !== 'school')
      return res.status(400).json({ error: 'CNPJ e Censo devem importar instituições.' });
    res.json(await importData(db, input.csv, input, req.user.name));
  });
  r.get('/submissions', (req, res) =>
    res.json(
      db
        .prepare(
          'SELECT id,kind,territory,category,body,period,status FROM submissions ORDER BY rowid DESC LIMIT 200',
        )
        .all()
        .map((s) => ({ ...s, body: crypto.decrypt(s.body) })),
    ),
  );
  r.post('/submissions/:id/review', (req, res) => {
    const input = z.object({ status: z.enum(['reviewed', 'rejected']) }).parse(req.body);
    db.prepare('UPDATE submissions SET status=? WHERE id=?').run(input.status, req.params.id);
    audit(db, req.params.id, req.user.name, 'submission-reviewed', { status: input.status });
    res.json({ ok: true });
  });
  r.get('/privacy-requests', (req, res) =>
    res.json(
      db
        .prepare(
          'SELECT p.*,u.name,u.email FROM privacy_requests p JOIN users u ON u.id=p.user_id ORDER BY created_at DESC',
        )
        .all(),
    ),
  );
  r.post('/privacy-requests/:id/resolve', (req, res) => {
    db.prepare("UPDATE privacy_requests SET status='resolved' WHERE id=?").run(req.params.id);
    audit(db, req.params.id, req.user.name, 'privacy-resolved', {});
    res.json({ ok: true });
  });
  return r;
}
