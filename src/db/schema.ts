import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../shared/config.js";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const path = config.databasePath();
  mkdirSync(dirname(path), { recursive: true });
  _db = new Database(path);
  _db.pragma("journal_mode = WAL");
  _db.pragma("busy_timeout = 5000");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function columnExists(
  db: Database.Database,
  table: string,
  column: string
): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return cols.some((c) => c.name === column);
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      result TEXT,
      error TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      attempt INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      max_duration_sec INTEGER NOT NULL DEFAULT 3600,
      progress TEXT,
      idempotency_key TEXT,
      lease_owner TEXT,
      lease_until TEXT,
      next_run_at TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      owner_key_hash TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency
      ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
    CREATE INDEX IF NOT EXISTS idx_jobs_claim
      ON jobs(status, next_run_at, lease_until);
    CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cron TEXT NOT NULL,
      job_type TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      max_attempts INTEGER NOT NULL DEFAULT 3,
      max_duration_sec INTEGER NOT NULL DEFAULT 3600,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_enqueued_at TEXT,
      next_run_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_next
      ON schedules(enabled, next_run_at);

    CREATE TABLE IF NOT EXISTS account_tools (
      id TEXT PRIMARY KEY,
      api_key_hash TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      added_at TEXT NOT NULL,
      settings TEXT NOT NULL DEFAULT '{}',
      UNIQUE(api_key_hash, tool_id)
    );

    CREATE INDEX IF NOT EXISTS idx_account_tools_key
      ON account_tools(api_key_hash);

    CREATE TABLE IF NOT EXISTS job_actions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      message TEXT,
      detail TEXT,
      created_at TEXT NOT NULL,
      finished_at TEXT,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_job_actions_job
      ON job_actions(job_id);

    CREATE TABLE IF NOT EXISTS pack_drafts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      manifest_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pack_drafts_updated
      ON pack_drafts(updated_at DESC);
  `);

  // Existing DBs created before settings: ALTER if missing
  if (!columnExists(db, "account_tools", "settings")) {
    db.exec(
      `ALTER TABLE account_tools ADD COLUMN settings TEXT NOT NULL DEFAULT '{}'`
    );
  }

  if (!columnExists(db, "jobs", "owner_key_hash")) {
    db.exec(`ALTER TABLE jobs ADD COLUMN owner_key_hash TEXT`);
  }
}
