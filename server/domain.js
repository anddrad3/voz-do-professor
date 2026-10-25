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
  city: short.default(''),
  state: z.string().max(2).default(''),
  sourceUrl: url,
  sourceName: short.default(''),
  sourceDate: date,
  tags: z.array(short).max(20).default([]),
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
      (v) => v.opens && v.closes && v.opens <= v.closes,
      'Informe início e fim válidos para as inscrições.',
    ),
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
export const profileSchema = z
  .object({
    city: short.default(''),
    state: z.string().max(2).default(''),
    cities: z.array(short).max(30).default([]),
    discipline: short.default(''),
    education: short.default(''),
    levels: z.array(short).max(10).default([]),
    radius: z
      .union([z.literal(0), z.literal(5), z.literal(10), z.literal(25), z.literal(50)])
      .default(0),
    lat: coordinate.refine((v) => v === null || Math.abs(v) <= 90),
    lng: coordinate.refine((v) => v === null || Math.abs(v) <= 180),
  })
  .strict();
export const preferencesSchema = z
  .object({
    opportunities: z.boolean().default(true),
    legislation: z.boolean().default(true),
    news: z.boolean().default(false),
  })
  .strict();
export function distanceKm(a, b, c, d) {
  const r = Math.PI / 180;
  const s =
    Math.sin(((c - a) * r) / 2) ** 2 +
    Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
export const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function opportunityStatus(
  item,
  today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }),
) {
  if (item.stage && item.stage !== 'Automático') return item.stage;
  if (today < item.opens) return 'Futuro';
  if (today <= item.closes) return 'Inscrições abertas';
  return 'Encerrado';
}
export function filterRecords(items, q) {
  return items
    .flatMap((item) => {
      if (
        q.q &&
        !normalize(
          [
            item.title,
            item.body,
            item.summary,
            item.sourceName,
            item.city,
            item.state,
            item.discipline,
            item.education,
            item.topic,
            ...(item.tags || []),
          ].join(' '),
        ).includes(normalize(q.q))
      )
        return [];
      for (const key of ['type', 'city', 'state', 'network', 'discipline', 'education', 'topic'])
        if (q[key] && normalize(item[key]) !== normalize(q[key])) return [];
      if (q.level && item.level !== 'Todos' && normalize(item.level) !== normalize(q.level))
        return [];
      if (q.status && opportunityStatus(item) !== q.status) return [];
      let result = { ...item };
      if (q.radius && Number(q.radius) > 0) {
        const [lat, lng, radius] = [q.lat, q.lng, q.radius].map(Number);
        if (
          q.lat == null ||
          q.lat === '' ||
          q.lng == null ||
          q.lng === '' ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180 ||
          !Number.isFinite(radius) ||
          radius > 500
        )
          throw Object.assign(
            new Error('Informe coordenadas válidas para pesquisar por distância.'),
            { status: 400 },
          );
        if (item.lat == null || item.lng == null) return [];
        const distance = distanceKm(lat, lng, item.lat, item.lng);
        if (distance > radius) return [];
        result.distance = Math.round(distance * 10) / 10;
      }
      if (item.kind === 'opportunity') result.situation = opportunityStatus(item);
      return [result];
    })
    .sort((a, b) => (q.radius ? a.distance - b.distance : 0));
}
export function saveRecord(db, kind, input, actor, id = randomUUID(), demo = false) {
  if (!Object.hasOwn(recordSchemas, kind))
    throw Object.assign(new Error('Tipo inválido.'), { status: 400 });
  const data = recordSchemas[kind].parse(input);
  const old = db.prepare('SELECT * FROM records WHERE id=?').get(id);
  if (old && old.kind !== kind)
    throw Object.assign(new Error('Tipo não pode ser alterado.'), { status: 400 });
  if (
    old &&
    kind === 'survey' &&
    db.prepare('SELECT 1 FROM responses WHERE survey_id=? LIMIT 1').get(id) &&
    JSON.stringify(JSON.parse(old.data).questions) !== JSON.stringify(data.questions)
  )
    throw Object.assign(
      new Error('Uma pesquisa com respostas não permite alterar perguntas. Crie outra pesquisa.'),
      { status: 409 },
    );
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
  if (record.kind !== 'survey' && (!record.sourceUrl || !record.sourceName || !record.sourceDate))
    throw Object.assign(new Error('Informe fonte, link e data de conferência antes de publicar.'), {
      status: 400,
    });
  if (record.kind === 'content' && record.type !== 'Notícia' && !record.summary)
    throw Object.assign(new Error('Inclua o explicador em linguagem simples.'), { status: 400 });
  db.prepare(
    "UPDATE records SET status='published',reviewer=?,reviewed_at=?,updated_at=? WHERE id=?",
  ).run(reviewer, now(), now(), id);
  audit(db, id, reviewer, 'published', record);
  generateAlerts(db, id);
  return unpack(db.prepare('SELECT * FROM records WHERE id=?').get(id));
}
export function generateAlerts(db, id) {
  const r = unpack(db.prepare("SELECT * FROM records WHERE id=? AND status='published'").get(id));
  if (!visible(r) || !['content', 'opportunity'].includes(r.kind)) return;
  for (const u of db.prepare('SELECT id,profile,preferences FROM users').all()) {
    const p = JSON.parse(u.profile),
      prefs = JSON.parse(u.preferences);
    let match =
      r.kind === 'opportunity'
        ? prefs.opportunities !== false
        : r.type === 'Notícia'
          ? prefs.news === true
          : prefs.legislation !== false;
    if (r.state && p.state && normalize(r.state) !== normalize(p.state)) match = false;
    const cities = [p.city, ...(p.cities || [])].filter(Boolean);
    if (r.city && cities.length && !cities.some((c) => normalize(c) === normalize(r.city)))
      match = false;
    if (r.kind === 'opportunity') {
      if (
        p.discipline &&
        r.discipline !== 'Todas' &&
        normalize(p.discipline) !== normalize(r.discipline)
      )
        match = false;
      if (p.education && normalize(p.education) !== normalize(r.education)) match = false;
      if (p.levels?.length && r.level !== 'Todos' && !p.levels.includes(r.level)) match = false;
      if (
        p.radius > 0 &&
        (p.lat == null ||
          p.lng == null ||
          r.lat == null ||
          r.lng == null ||
          distanceKm(p.lat, p.lng, r.lat, r.lng) > p.radius)
      )
        match = false;
    }
    if (match)
      db.prepare(
        'INSERT OR IGNORE INTO notifications(id,user_id,record_id,revision,title,created_at) VALUES(?,?,?,?,?,?)',
      ).run(randomUUID(), u.id, id, r.revision, r.title, now());
  }
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
