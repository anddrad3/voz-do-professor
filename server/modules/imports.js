import { parse } from 'csv-parse';
import { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { saveRecord, normalize, recordSchemas } from '../domain.js';
import { now, records } from '../db.js';
const number = (value) =>
  value == null || String(value).trim() === '' ? null : Number(String(value).replace(',', '.'));
function normalizeRow(row) {
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
  if (
    options.format !== 'normalized' ||
    !['content', 'opportunity', 'survey'].includes(options.kind)
  )
    throw new Error(
      'Importação antiga do Radar removida. Use apenas CSV normalizado de publicações.',
    );
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
  const recordKey = (r) => `${r.sourceUrl}|${normalize(r.title)}`;
  const bySource = new Map(
    records(db, options.kind, false)
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
            'firstPublishedAt',
            'revision',
            'demo',
          ].includes(key),
      ),
    );
  try {
    const stream = typeof input === 'string' ? Readable.from([input]) : input;
    const parser = parse({
      delimiter: options.delimiter || ';',
      columns: true,
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
        const kind = options.kind;
        const previous = data.sourceUrl && bySource.get(recordKey(data));
        if (previous) {
          const parsed = recordSchemas[kind].parse(data);
          if (JSON.stringify(parsed) === JSON.stringify(clean(previous))) {
            summary.skipped++;
            continue;
          }
        }
        const saved = saveRecord(db, kind, data, actor, previous?.id);
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
    results.push(
      await importData(
        db,
        createReadStream(item.path, {
          encoding: item.encoding || 'utf8',
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
