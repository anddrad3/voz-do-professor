import { parse } from 'csv-parse';
import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { saveRecord, normalize, recordSchemas } from '../domain.js';
import { now, records } from '../db.js';
export const EDUCATION_CNAES = new Set(['8511200', '8512100', '8513900', '8520100']);
const SOURCE_URLS = {
  cnpj: 'https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf',
  census:
    'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar',
};
const number = (value) =>
  value == null || String(value).trim() === '' ? null : Number(String(value).replace(',', '.'));
const digits = (value) => String(value || '').replace(/\D/g, '');
function normalizeRow(row, format, options) {
  if (format === 'cnpj') {
    // RFB: Estabelecimentos, 30 semicolon-separated fields, no header, Latin-1.
    if (![row[11], ...(row[12] || '').split(',')].some((c) => EDUCATION_CNAES.has(c))) return null;
    return {
      title: row[4] || `Estabelecimento ${row[0]}${row[1]}${row[2]}`,
      cnpj: row[0] + row[1] + row[2],
      active: row[5] === '02',
      cnae: row[11],
      city: options.municipalities?.[row[20]] || `Código RFB ${row[20]}`,
      state: row[19],
      address: [row[13], row[14], row[15], row[16], row[17], row[18]].filter(Boolean).join(' '),
      phone: [row[21], row[22]].filter(Boolean).join(' '),
      network: 'Não informada',
      sourceName: 'Receita Federal',
      sourceUrl: SOURCE_URLS.cnpj,
      sourceDate: options.sourceDate,
    };
  }
  if (format === 'census') {
    return {
      title: row.NO_ENTIDADE,
      active: !row.TP_SITUACAO_FUNCIONAMENTO || row.TP_SITUACAO_FUNCIONAMENTO === '1',
      inepCode: row.CO_ENTIDADE,
      cnpj: digits(row.NU_CNPJ_ESCOLA_PRIVADA),
      city: row.NO_MUNICIPIO,
      state: row.SG_UF,
      network:
        { 1: 'Federal', 2: 'Estadual', 3: 'Municipal', 4: 'Privada' }[row.TP_DEPENDENCIA] ||
        'Não informada',
      address: [row.DS_ENDERECO, row.NU_ENDERECO, row.DS_COMPLEMENTO, row.NO_BAIRRO, row.CO_CEP]
        .filter(Boolean)
        .join(' '),
      phone: [row.NU_DDD, row.NU_TELEFONE].filter(Boolean).join(' '),
      lat: number(row.NU_LATITUDE),
      lng: number(row.NU_LONGITUDE),
      sourceName: 'Inep / Censo Escolar',
      sourceUrl: SOURCE_URLS.census,
      sourceDate: options.sourceDate,
    };
  }
  const data = { ...row };
  for (const field of ['lat', 'lng', 'salary', 'hours', 'year'])
    if (field in data) data[field] = number(data[field]);
  for (const field of ['active', 'recruitmentVerified'])
    if (field in data) data[field] = String(data[field]) === 'true';
  for (const field of ['tags', 'history', 'questions', 'provenance'])
    if (field in data) data[field] = JSON.parse(data[field] || '[]');
  return data;
}
export async function importData(db, input, options, actor) {
  const job = randomUUID();
  const source = String(options.format || 'normalized');
  const summary = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    errorCount: 0,
    divergences: 0,
  };
  db.prepare('INSERT INTO imports(id,source,started_at,status,summary) VALUES(?,?,?,?,?)').run(
    job,
    source,
    now(),
    'running',
    '{}',
  );
  const existing = records(db, 'school', false),
    byCnpj = new Map(existing.filter((s) => s.cnpj).map((s) => [s.cnpj, s])),
    byInep = new Map(existing.filter((s) => s.inepCode).map((s) => [s.inepCode, s]));
  const recordKey = (r) =>
    `${r.sourceUrl}|${normalize(r.title)}${(options.kind || 'school') === 'school' ? '|' + normalize(r.city) + '|' + normalize(r.state) : ''}`;
  const bySource = new Map(
    records(db, options.kind || 'school', false)
      .filter((r) => r.sourceUrl)
      .map((r) => [recordKey(r), r]),
  );
  const clean = (r) =>
    Object.fromEntries(
      Object.entries(r).filter(
        ([key]) =>
          ![
            'id',
            'kind',
            'status',
            'reviewer',
            'reviewedAt',
            'updatedAt',
            'revision',
            'demo',
          ].includes(key),
      ),
    );
  try {
    const stream = typeof input === 'string' ? Readable.from([input]) : input;
    const parser = parse({
      delimiter: options.delimiter || ';',
      columns: source !== 'cnpj',
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
      max_record_size: 1024 * 1024,
    });
    stream.on('error', (error) => parser.destroy(error));
    stream.pipe(parser);
    for await (const row of parser) {
      summary.processed++;
      try {
        const data = normalizeRow(row, source, options);
        if (!data) {
          summary.skipped++;
          continue;
        }
        const kind = options.kind || 'school';
        let previous;
        if (kind === 'school') {
          data.cnpj = digits(data.cnpj);
          const cnpjMatch = data.cnpj && byCnpj.get(data.cnpj);
          const inepMatch = data.inepCode && byInep.get(data.inepCode);
          if (cnpjMatch && inepMatch && cnpjMatch.id !== inepMatch.id)
            throw new Error(
              'CNPJ e Inep apontam para registros diferentes. Corrija a duplicidade antes de importar.',
            );
          previous =
            cnpjMatch ||
            inepMatch ||
            (!data.cnpj && !data.inepCode && data.sourceUrl && bySource.get(recordKey(data)));
          if (data.active === false && !previous) {
            summary.skipped++;
            continue;
          }
          if (previous) {
            const {
              id,
              kind: _,
              status,
              reviewer,
              reviewedAt,
              updatedAt,
              revision,
              demo,
              ...old
            } = previous;
            const divergence =
              (old.city && data.city && normalize(old.city) !== normalize(data.city)) ||
              (old.title && data.title && normalize(old.title) !== normalize(data.title));
            const hasOtherBase =
              (source === 'cnpj' && old.inepCode) || (source === 'census' && old.cnpj);
            Object.assign(data, {
              ...old,
              ...data,
              lat: data.lat ?? old.lat,
              lng: data.lng ?? old.lng,
              network: data.network === 'Não informada' ? old.network : data.network,
              phone: data.phone || old.phone,
              cnpj: data.cnpj || old.cnpj,
              inepCode: data.inepCode || old.inepCode,
              crosscheck: divergence
                ? 'Revisão necessária'
                : hasOtherBase
                  ? data.cnpj
                    ? 'Correspondência por CNPJ'
                    : 'Correspondência por INEP'
                  : old.crosscheck,
            });
            if (divergence) summary.divergences++;
          }
          const provenance = {
            source: data.sourceName || 'Importação',
            date: data.sourceDate || options.sourceDate || '',
            url: data.sourceUrl || '',
          };
          data.provenance = [...(previous?.provenance || [])];
          if (!data.provenance.some((p) => JSON.stringify(p) === JSON.stringify(provenance)))
            data.provenance.push(provenance);
          data.provenance = data.provenance.slice(-50);
        } else previous = data.sourceUrl && bySource.get(recordKey(data));
        if (previous) {
          const parsed = recordSchemas[kind].parse(data);
          if (JSON.stringify(parsed) === JSON.stringify(clean(previous))) {
            summary.skipped++;
            continue;
          }
        }
        const saved = saveRecord(db, kind, data, actor, previous?.id);
        if (saved.cnpj) byCnpj.set(saved.cnpj, saved);
        if (saved.inepCode) byInep.set(saved.inepCode, saved);
        if (saved.sourceUrl) bySource.set(recordKey(saved), saved);
        summary[previous ? 'updated' : 'created']++;
      } catch (e) {
        summary.errorCount++;
        if (summary.errors.length < 50)
          summary.errors.push({
            row: summary.processed,
            message:
              e.issues?.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') || e.message,
          });
      }
    }
    const status = summary.errors.length ? 'completed_with_errors' : 'completed';
    db.prepare('UPDATE imports SET finished_at=?,status=?,summary=? WHERE id=?').run(
      now(),
      status,
      JSON.stringify(summary),
      job,
    );
    return { id: job, status, ...summary };
  } catch (e) {
    db.prepare('UPDATE imports SET finished_at=?,status=?,summary=? WHERE id=?').run(
      now(),
      'failed',
      JSON.stringify({ ...summary, error: e.message }),
      job,
    );
    throw e;
  }
}
export async function runManifest(db, path) {
  const config = JSON.parse(await readFile(path, 'utf8'));
  const results = [];
  for (const item of config.sources || []) {
    if (!item.path)
      throw new Error(
        'Manifesto deve apontar para arquivos locais oficiais previamente baixados e descompactados.',
      );
    const options = { ...item };
    if (item.municipalitiesPath) {
      const mapping = {};
      for await (const row of createReadStream(item.municipalitiesPath, {
        encoding: 'latin1',
      }).pipe(parse({ delimiter: ';', skip_empty_lines: true })))
        mapping[row[0]] = row[1];
      options.municipalities = mapping;
    }
    results.push(
      await importData(
        db,
        createReadStream(item.path, {
          encoding: item.encoding || (item.format === 'cnpj' ? 'latin1' : 'utf8'),
        }),
        options,
        'Rotina de importação',
      ),
    );
  }
  return results;
}
export function scheduleImports(db) {
  const path = process.env.IMPORT_MANIFEST;
  if (!path) return () => {};
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      await runManifest(db, path);
    } catch (e) {
      console.error('Falha de importação:', e.message);
    } finally {
      busy = false;
    }
  };
  void run();
  const timer = setInterval(
    run,
    Math.max(1, Number(process.env.IMPORT_INTERVAL_HOURS) || 24) * 3600000,
  );
  timer.unref();
  return () => clearInterval(timer);
}
