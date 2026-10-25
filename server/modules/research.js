import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hash, token, limiter } from '../security.js';
import { unpack, visible } from '../db.js';
export const MIN_GROUP = 10;
// Suppress the entire partition when any territory/category is too small.
// No raw text, precise timestamp, user ID or IP is included in public results.
export function aggregate(db, surveyId) {
  const survey = unpack(
    db
      .prepare("SELECT * FROM records WHERE id=? AND kind='survey' AND status='published'")
      .get(surveyId),
  );
  if (!visible(survey)) return null;
  const rows = db
    .prepare('SELECT territory,answers FROM responses WHERE survey_id=?')
    .all(surveyId);
  const territories = [...new Set(rows.map((r) => r.territory))];
  function group(selected) {
    if (selected.length < MIN_GROUP) return { suppressed: true, minimum: MIN_GROUP };
    const questions = survey.questions.map((q) => {
      const counts = q.options.map((option) => ({
        option,
        count: selected.filter((r) => JSON.parse(r.answers)[q.id] === option).length,
      }));
      return counts.some((c) => c.count > 0 && c.count < MIN_GROUP)
        ? { id: q.id, label: q.label, suppressed: true }
        : { id: q.id, label: q.label, counts };
    });
    return {
      suppressed: false,
      total: rows.length >= MIN_GROUP ? selected.length : null,
      questions,
    };
  }
  const territorialSafe = territories.every(
    (t) => rows.filter((r) => r.territory === t).length >= MIN_GROUP,
  );
  const nationwide = group(rows);
  const territoryResults = territorialSafe
    ? territories.map((t) => ({ territory: t, ...group(rows.filter((r) => r.territory === t)) }))
    : [];
  // Complementary suppression prevents deriving a hidden territorial cell by subtraction.
  for (const question of survey.questions) {
    const partition = [nationwide, ...territoryResults];
    if (partition.some((g) => g.questions?.find((q) => q.id === question.id)?.suppressed)) {
      for (const g of partition) {
        const q = g.questions?.find((q) => q.id === question.id);
        if (q) {
          delete q.counts;
          q.suppressed = true;
        }
      }
    }
  }
  return {
    surveyId,
    title: survey.title,
    minimum: MIN_GROUP,
    nationwide,
    territories: territoryResults,
    territoriesSuppressed: !territorialSafe,
    notice:
      'Amostra voluntária e não representativa. Grupos pequenos são ocultados e a supressão é complementar entre os recortes.',
  };
}
export function research(db, crypto) {
  const r = Router();
  r.post('/responses', limiter(12), (req, res) => {
    const input = z
      .object({
        surveyId: z.string(),
        territory: z.string().trim().min(2).max(160),
        answers: z.record(z.string().max(80), z.string().max(240)),
        consent: z.literal(true),
      })
      .strict()
      .parse(req.body);
    const survey = unpack(
      db
        .prepare("SELECT * FROM records WHERE id=? AND kind='survey' AND status='published'")
        .get(input.surveyId),
    );
    if (!visible(survey)) return res.status(404).json({ error: 'Pesquisa indisponível.' });
    if (
      survey.closes &&
      survey.closes < new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    )
      return res.status(400).json({ error: 'Esta pesquisa foi encerrada.' });
    if (
      Object.keys(input.answers).length !== survey.questions.length ||
      survey.questions.some((q) => !q.options.includes(input.answers[q.id]))
    )
      return res
        .status(400)
        .json({ error: 'Responda todas as perguntas com as opções disponíveis.' });
    const receipt = token();
    db.prepare('INSERT INTO responses VALUES(?,?,?,?,?,?)').run(
      randomUUID(),
      survey.id,
      input.territory.normalize('NFC').replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR'),
      JSON.stringify(input.answers),
      hash(receipt),
      new Date().toISOString().slice(0, 7),
    );
    res.status(201).json({ receipt });
  });
  r.post('/submissions', limiter(6), (req, res) => {
    const input = z
      .object({
        kind: z.enum(['Relato', 'Sugestão']),
        territory: z.string().trim().min(2).max(160),
        category: z.enum([
          'Jornada',
          'Vínculos',
          'Remuneração',
          'Infraestrutura',
          'Materiais didáticos',
          'Inteligência artificial',
          'Outros',
        ]),
        body: z.string().trim().min(20).max(6000),
        consent: z.literal(true),
      })
      .strict()
      .parse(req.body);
    const receipt = token();
    db.prepare(
      'INSERT INTO submissions(id,kind,territory,category,body,receipt,period) VALUES(?,?,?,?,?,?,?)',
    ).run(
      randomUUID(),
      input.kind,
      input.territory,
      input.category,
      crypto.encrypt(input.body),
      hash(receipt),
      new Date().toISOString().slice(0, 7),
    );
    res.status(201).json({ receipt });
  });
  r.post('/withdraw', limiter(10), (req, res) => {
    const input = z.object({ receipt: z.string().regex(/^[a-f0-9]{64}$/) }).parse(req.body);
    const key = hash(input.receipt);
    const count =
      db.prepare('DELETE FROM responses WHERE receipt=?').run(key).changes +
      db.prepare('DELETE FROM submissions WHERE receipt=?').run(key).changes;
    if (!count) return res.status(404).json({ error: 'Comprovante não encontrado.' });
    res.json({ ok: true });
  });
  r.get('/results/:id', (req, res) => {
    const result = aggregate(db, req.params.id);
    if (!result) return res.status(404).json({ error: 'Pesquisa não encontrada.' });
    res.json(result);
  });
  r.get('/report', (req, res) => {
    const surveys = db
      .prepare("SELECT id FROM records WHERE kind='survey' AND status='published'")
      .all()
      .map((s) => aggregate(db, s.id))
      .filter(Boolean);
    const all = db
      .prepare(
        "SELECT territory,category FROM submissions WHERE kind='Relato' AND status='reviewed'",
      )
      .all();
    const categories = [...new Set(all.map((s) => s.category))].map((category) => ({
      category,
      count: all.filter((s) => s.category === category).length,
    }));
    res.json({
      generatedAt: new Date().toISOString().slice(0, 10),
      minimum: MIN_GROUP,
      surveys,
      submissions:
        categories.some((c) => c.count < MIN_GROUP) || all.length < MIN_GROUP
          ? { suppressed: true }
          : { total: all.length, categories },
      methodology:
        'Participação voluntária; não representa toda a população docente. Relatos individuais nunca são publicados. Supressão integral e complementar de distribuições com células positivas menores que 10.',
    });
  });
  return r;
}
