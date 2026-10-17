import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openDatabase} from '../db.js';
test('optional-email migration preserves existing users, sessions and ownership',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'building-schema-')),filename=path.join(directory,'legacy.sqlite');
 const old=new DatabaseSync(filename);
 old.exec("PRAGMA foreign_keys=ON;CREATE TABLE schema_versions(version INTEGER PRIMARY KEY);INSERT INTO schema_versions VALUES(1);"+
 "CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL,username TEXT UNIQUE NOT NULL COLLATE NOCASE,email TEXT UNIQUE NOT NULL COLLATE NOCASE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);"+
 "CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,csrf TEXT,expires_at INTEGER);"+
 "CREATE TABLE projects(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES users(id));"+
 "INSERT INTO users VALUES('owner','Owner','owner','owner@example.test','unchanged-hash','2026-01-01');"+
 "INSERT INTO sessions VALUES('existing-session','owner','csrf',9999999999999);"+
 "INSERT INTO projects VALUES('existing-project','owner');");
 old.close();
 const upgraded=openDatabase(filename);
 try {
  assert.equal(upgraded.prepare('SELECT password_hash FROM users WHERE id=?').get('owner').password_hash,'unchanged-hash');
  assert.equal(upgraded.prepare('SELECT user_id FROM sessions').get().user_id,'owner');
  assert.equal(upgraded.prepare('SELECT owner_id FROM projects').get().owner_id,'owner');
  assert.deepEqual(upgraded.prepare('PRAGMA foreign_key_check').all(),[]);
  upgraded.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run('new','New','new',null,'hash','2026-01-01');
  assert.equal(upgraded.prepare('SELECT email FROM users WHERE id=?').get('new').email,null);
 }finally{upgraded.close();fs.rmSync(directory,{recursive:true,force:true});}
});
