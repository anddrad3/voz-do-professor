import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function openDatabase(path = process.env.DATABASE_PATH || 'data/voz.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'teacher', profile TEXT NOT NULL DEFAULT '{}', preferences TEXT NOT NULL DEFAULT '{}', consent_at TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL,csrf TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',reviewer TEXT,reviewed_at TEXT,updated_at TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,demo INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX IF NOT EXISTS records_kind ON records(kind,status);
  CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY,record_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS favorites(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,record_id TEXT REFERENCES records(id) ON DELETE CASCADE,PRIMARY KEY(user_id,record_id));
  CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,record_id TEXT REFERENCES records(id) ON DELETE CASCADE,revision INTEGER NOT NULL,title TEXT NOT NULL,created_at TEXT NOT NULL,read_at TEXT,UNIQUE(user_id,record_id,revision));
  CREATE TABLE IF NOT EXISTS responses(id TEXT PRIMARY KEY,survey_id TEXT NOT NULL,territory TEXT NOT NULL,answers TEXT NOT NULL,receipt TEXT UNIQUE NOT NULL,period TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,kind TEXT NOT NULL,territory TEXT NOT NULL,category TEXT NOT NULL,body TEXT NOT NULL,receipt TEXT UNIQUE NOT NULL,period TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending');
  CREATE TABLE IF NOT EXISTS imports(id TEXT PRIMARY KEY,source TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL,summary TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS privacy_requests(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS metrics(day TEXT PRIMARY KEY,requests INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  `);
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
