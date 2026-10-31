import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import config from '../config/index.js';

// Ensure the directory for the SQLite file exists
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

export const getDatabase = () => {
  if (!dbInstance) {
    dbInstance = new Database(config.databasePath);

    // Enforce foreign key constraints
    dbInstance.pragma('foreign_keys = ON');

    // Enable Write-Ahead Logging (WAL) mode for better concurrency and reliability
    dbInstance.pragma('journal_mode = WAL');

    // Recommended SQLite PRAGMAs for performance and durability
    dbInstance.pragma('synchronous = NORMAL');
  }

  return dbInstance;
};

export const checkDatabaseHealth = () => {
  try {
    const db = getDatabase();
    const journalModeResult = db.pragma('journal_mode', { simple: true });
    const foreignKeysResult = db.pragma('foreign_keys', { simple: true });
    const pingResult = db.prepare('SELECT 1 as is_alive').get();

    return {
      status: 'connected',
      journalMode: journalModeResult,
      foreignKeys: foreignKeysResult === 1 ? 'enabled' : 'disabled',
      alive: pingResult?.is_alive === 1
    };
  } catch (error) {
    return {
      status: 'disconnected',
      error: error.message
    };
  }
};

export const closeDatabase = () => {
  if (dbInstance && dbInstance.open) {
    dbInstance.close();
    dbInstance = null;
  }
};

export const db = getDatabase();
export default db;

