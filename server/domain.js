import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { now, unpack, records, visible } from './db.js';
const text = z.string().trim().max(12000);
const short = z.string().trim().max(240);
const url = z
  .union([
    z.literal(''),
    z
      .string()
      .url()
      .max(2000)
      .refine((v) => /^https?:\/\//.test(v), 'Use um link HTTP ou HTTPS.'),
  ])
  .default('');
const date = z
  .union([
    z.literal(''),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s)),
  ])
  .default('');
const base = {
  title: short.min(3),
  body: text.default(''),
  country: short.default('BR'),
  automatic: z.boolean().default(false),
  aiGenerated: z.boolean().default(false),
  editorialPriority: z.number().int().min(0).max(3).default(2),
  aiModel: short.default(''),
  summaryBasis: short.default(''),
  attribution: short.default(''),
  locationBasis: short.default(''),
  city: short.default(''),
  state: z.string().max(2).default(''),
  sourceUrl: url,
  sourceName: short.default(''),
  sourceDate: date,
  tags: z.array(short).max(20).default([]),
  scope: z.enum(['', 'Nacional', 'Estadual', 'Distrital']).default(''),
  checkedAt: date,
  sourceHash: z.string().max(64).default(''),
  excerpt: text.default(''),
  excerptCredit: short.default(''),
  image: z
    .string()
    .regex(/^(?:|[a-f0-9]{40}\.jpg)$/)
    .default(''),
  imageCredit: short.default(''),
};
const coordinate = z.number().finite().nullable().default(null);
export const recordSchemas = {
  content: z
    .object({
      ...base,
      type: z.enum([
        'Notícia',
        'Legislação',
        'Piso salarial',
        'Plano de carreira',
        'Conselho de educação',
      ]),
      summary: text.default(''),
      level: short.default('Todos'),
      salary: z.number().nonnegative().nullable().default(null),
      year: z.number().int().min(1900).max(2200).nullable().default(null),
      hours: z.number().positive().max(80).nullable().default(null),
      history: z
        .array(z.object({ date: date, description: text, sourceUrl: url }))
        .max(100)
        .default([]),
    })
    .strict(),
  school: z
    .object({
      ...base,
      cnpj: z.string().max(14).default(''),
      inepCode: short.default(''),
      cnae: short.default(''),
      network: z.enum(['Municipal', 'Estadual', 'Federal', 'Privada', 'Não informada']),
      address: short.default(''),
      phone: short.default(''),
      website: url,
      recruitmentUrl: url,
      recruitmentVerified: z.boolean().default(false),
      lat: coordinate.refine((v) => v === null || Math.abs(v) <= 90),
      lng: coordinate.refine((v) => v === null || Math.abs(v) <= 180),
      active: z.boolean().default(true),
      crosscheck: z
        .enum([
          'Não cruzado',
          'Correspondência por CNPJ',
          'Correspondência por INEP',
          'Revisão necessária',
        ])
        .default('Não cruzado'),
      provenance: z
        .array(z.object({ source: short, date: date, url: url }))
        .max(50)
        .default([]),
    })
    .strict(),
  opportunity: z
    .object({
      ...base,
      company: short.default(''),
      type: z.enum([
        'Concurso público',
        'Processo simplificado',
        'Seleção privada',
        'Cadastro de reserva',
      ]),
      discipline: short,
      level: short,
      education: short,
      salary: z.number().nonnegative().nullable().default(null),
      hours: z.number().positive().max(80).nullable().default(null),
      opens: date,
      closes: date,
      examDate: date,
      stage: z.enum(['Automático', 'Em andamento', 'Suspenso', 'Finalizado']).default('Automático'),
      registrationUrl: url,
      requirements: text,
      documents: text.default(''),
      lat: coordinate.refine((v) => v === null || Math.abs(v) <= 90),
      lng: coordinate.refine((v) => v === null || Math.abs(v) <= 180),
    })
    .strict()
    .refine(
      (v) => !v.opens || !v.closes || v.opens <= v.closes,
      'Informe início e fim válidos para as inscrições.',
    ),
  story: z
    .object({
      ...base,
      anonymous: z.boolean().default(true),
      author: short.default(''),
      consent: z.literal(true),
    })
    .strict(),
  survey: z
    .object({
      ...base,
      topic: z.enum([
        'Enquete',
        'Jornada',
        'Vínculos',
        'Remuneração',
        'Infraestrutura',
        'Materiais didáticos',
        'Inteligência artificial',
      ]),
      purpose: text.min(10),
      closes: date,
      questions: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z0-9_-]+$/),
            label: short.min(3),
            options: z
              .array(short.min(1))
              .min(2)
              .max(10)
              .refine((a) => new Set(a).size === a.length, 'Opções repetidas.'),
          }),
        )
        .min(1)
        .max(15)
        .refine((a) => new Set(a.map((q) => q.id)).size === a.length, 'IDs repetidos.'),
    })
    .strict(),
};
export { distanceKm, normalize, opportunityStatus, filterRecords } from '../shared/filter.js';
import { normalize } from '../shared/filter.js';
export function saveRecord(db, kind, input, actor, id = randomUUID(), demo = false) {
  if (!Object.hasOwn(recordSchemas, kind))
    throw Object.assign(new Error('Tipo inválido.'), { status: 400 });
  const data = recordSchemas[kind].parse(input);
  if (kind === 'story' && data.anonymous) data.author = '';
  const old = db.prepare('SELECT * FROM records WHERE id=?').get(id);
  if (old && old.kind !== kind)
    throw Object.assign(new Error('Tipo não pode ser alterado.'), { status: 400 });
  db.prepare(
    `INSERT INTO records(id,kind,data,status,updated_at,demo) VALUES(?,?,?,'draft',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,status='draft',reviewer=NULL,reviewed_at=NULL,updated_at=excluded.updated_at,revision=records.revision+1`,
  ).run(id, kind, JSON.stringify(data), now(), demo ? 1 : 0);
  audit(db, id, actor, old ? 'updated' : 'created', data);
  return unpack(db.prepare('SELECT * FROM records WHERE id=?').get(id));
}
export function audit(db, id, actor, action, data) {
  db.prepare('INSERT INTO revisions(record_id,actor,action,data,created_at) VALUES(?,?,?,?,?)').run(
    id,
    actor,
    action,
    JSON.stringify(data),
    now(),
  );
}
export function publishRecord(db, id, reviewer) {
  const record = unpack(db.prepare('SELECT * FROM records WHERE id=?').get(id));
  if (!record) throw Object.assign(new Error('Registro não encontrado.'), { status: 404 });
  if (
    !['survey', 'story'].includes(record.kind) &&
    (!record.sourceUrl || !record.sourceName || !record.sourceDate)
  )
    throw Object.assign(new Error('Informe fonte, link e data de conferência antes de publicar.'), {
      status: 400,
    });
  if (record.kind === 'content' && record.type !== 'Notícia' && !record.summary)
    throw Object.assign(new Error('Inclua o explicador em linguagem simples.'), { status: 400 });
  db.prepare(
    "UPDATE records SET status='published',reviewer=?,reviewed_at=?,updated_at=? WHERE id=?",
  ).run(reviewer, now(), now(), id);
  audit(db, id, reviewer, 'published', record);
  return unpack(db.prepare('SELECT * FROM records WHERE id=?').get(id));
}
export function qualityReport(db) {
  const all = records(db, 'school', false);
  const issues = [];
  const seen = new Map();
  for (const s of all) {
    for (const key of ['cnpj', 'inepCode'])
      if (s[key]) {
        const k = key + s[key];
        if (seen.has(k))
          issues.push({
            id: s.id,
            title: s.title,
            issue: `Duplicidade de ${key}`,
            other: seen.get(k),
          });
        else seen.set(k, s.id);
      }
    if (!s.sourceDate || Date.now() - Date.parse(s.sourceDate) > 180 * 86400000)
      issues.push({ id: s.id, title: s.title, issue: 'Fonte sem data ou com mais de 180 dias' });
    if (s.lat == null || s.lng == null)
      issues.push({ id: s.id, title: s.title, issue: 'Sem coordenadas: fora da busca por raio' });
    if (s.crosscheck === 'Revisão necessária')
      issues.push({ id: s.id, title: s.title, issue: 'Divergência entre CNPJ e Censo Escolar' });
  }
  return issues;
}
