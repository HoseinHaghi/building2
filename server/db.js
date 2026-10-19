import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function openDatabase(filename) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  if (filename !== ':memory:') fs.chmodSync(filename, 0o600);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY);');
  if (!db.prepare('SELECT 1 FROM schema_versions WHERE version=1').get()) db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL,username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
    CREATE INDEX session_expiry ON sessions(expires_at);
    CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,parent_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      root_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,owner_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
    CREATE INDEX project_parent ON projects(parent_id);
    CREATE INDEX project_root ON projects(root_id);
    CREATE TABLE project_members(project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(project_id,user_id));
    CREATE TABLE works(id TEXT PRIMARY KEY,title TEXT NOT NULL,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      floor_num INTEGER NOT NULL CHECK(floor_num BETWEEN 1 AND 7),number INTEGER NOT NULL,
      summary TEXT NOT NULL DEFAULT '',prerequisite TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('in_progress','done')),creator_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(project_id,floor_num,number));
    CREATE INDEX work_project ON works(project_id,status);
    CREATE TABLE work_sequences(project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      floor_num INTEGER NOT NULL,last_number INTEGER NOT NULL,PRIMARY KEY(project_id,floor_num));
    CREATE TABLE work_assignees(work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(work_id,user_id));
    CREATE INDEX assignee_user ON work_assignees(user_id);
    CREATE TABLE reports(id TEXT PRIMARY KEY,work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id),text TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE INDEX report_work ON reports(work_id,created_at);
    CREATE TABLE files(id TEXT PRIMARY KEY,work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('cover','attachment')),filename TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,UNIQUE(work_id,kind));
    INSERT INTO schema_versions VALUES(1);
    COMMIT;
  `);
  if (!db.prepare('SELECT 1 FROM schema_versions WHERE version=2').get()) {
    db.exec(`
      PRAGMA foreign_keys=OFF;
      BEGIN IMMEDIATE;
      CREATE TABLE users_next(id TEXT PRIMARY KEY,name TEXT NOT NULL,username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT UNIQUE COLLATE NOCASE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
      INSERT INTO users_next SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE users_next RENAME TO users;
      INSERT INTO schema_versions VALUES(2);
      COMMIT;
      PRAGMA foreign_keys=ON;
    `);
  }
  if (!db.prepare('SELECT 1 FROM schema_versions WHERE version=3').get()) db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE request_keys(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,
      created_at TEXT NOT NULL,PRIMARY KEY(user_id,request_key));
    INSERT INTO schema_versions VALUES(3);
    COMMIT;
  `);
  return db;
}
export function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = action(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
