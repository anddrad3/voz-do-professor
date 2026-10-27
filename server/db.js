import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function openDatabase(path = process.env.DATABASE_PATH || 'data/public-v2.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',reviewer TEXT,reviewed_at TEXT,updated_at TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,demo INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX IF NOT EXISTS records_kind ON records(kind,status);
  CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY,record_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS imports(id TEXT PRIMARY KEY,source TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL,summary TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS admin_users(id TEXT PRIMARY KEY,name TEXT NOT NULL,password TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS admin_sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES admin_users(id) ON DELETE CASCADE,expires INTEGER NOT NULL,csrf TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS admin_factors(user_id TEXT PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,secret TEXT NOT NULL,last_step INTEGER NOT NULL DEFAULT -1);
  CREATE TABLE IF NOT EXISTS admin_recovery(user_id TEXT REFERENCES admin_users(id) ON DELETE CASCADE,code_hash TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS admin_login_budget(id INTEGER PRIMARY KEY,attempts INTEGER NOT NULL,until INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS ai_usage(id TEXT PRIMARY KEY,day TEXT NOT NULL,at INTEGER NOT NULL,purpose TEXT NOT NULL,client TEXT NOT NULL,status TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS ai_usage_at ON ai_usage(at);
  CREATE TABLE IF NOT EXISTS ai_daily_runs(day TEXT PRIMARY KEY,started_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL,summary TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS statistics_queries(month TEXT NOT NULL,topic TEXT NOT NULL,state TEXT NOT NULL,total INTEGER NOT NULL,PRIMARY KEY(month,topic,state));
  `);
  const usageColumns = db
    .prepare('PRAGMA table_info(ai_usage)')
    .all()
    .map((c) => c.name);
  for (const [name, type] of Object.entries({
    billing_mode: "TEXT NOT NULL DEFAULT 'free'",
    cost_microusd: 'INTEGER NOT NULL DEFAULT 0',
    input_tokens: 'INTEGER NOT NULL DEFAULT 0',
    output_tokens: 'INTEGER NOT NULL DEFAULT 0',
    search_queries: 'INTEGER NOT NULL DEFAULT 0',
    measured: 'INTEGER NOT NULL DEFAULT 0',
  })) {
    if (!usageColumns.includes(name)) db.exec(`ALTER TABLE ai_usage ADD COLUMN ${name} ${type}`);
  }
  const columns = db
    .prepare('PRAGMA table_info(records)')
    .all()
    .map((c) => c.name);
  if (!columns.includes('first_published_at')) {
    db.exec(
      "ALTER TABLE records ADD COLUMN first_published_at TEXT; UPDATE records SET first_published_at=COALESCE(reviewed_at,updated_at) WHERE status='published'",
    );
  }
  db.exec(`CREATE TRIGGER IF NOT EXISTS record_first_publication_insert AFTER INSERT ON records WHEN NEW.status='published' AND NEW.first_published_at IS NULL BEGIN UPDATE records SET first_published_at=NEW.updated_at WHERE id=NEW.id; END;
  CREATE TRIGGER IF NOT EXISTS record_first_publication_update AFTER UPDATE OF status ON records WHEN NEW.status='published' AND NEW.first_published_at IS NULL BEGIN UPDATE records SET first_published_at=NEW.updated_at WHERE id=NEW.id; END;`);
  return db;
}
export const now = () => new Date().toISOString();
export const visible = (record) => record && (!record.demo || process.env.DEMO_MODE === 'true');
export const unpack = (row) =>
  row && {
    id: row.id,
    kind: row.kind,
    ...JSON.parse(row.data),
    status: row.status,
    reviewer: row.reviewer,
    reviewedAt: row.reviewed_at,
    updatedAt: row.updated_at,
    firstPublishedAt: row.first_published_at || row.updated_at,
    revision: row.revision,
    demo: !!row.demo,
  };
export function records(db, kind, published = true) {
  return db
    .prepare(
      `SELECT * FROM records WHERE kind=? ${published ? "AND status='published'" : ''} ORDER BY updated_at DESC`,
    )
    .all(kind)
    .map(unpack);
}
