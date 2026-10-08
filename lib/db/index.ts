import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import { ensureTablesExist } from './init';

export type DrizzleDb = MySql2Database<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var _mysqlPool: mysql.Pool | undefined;
  // eslint-disable-next-line no-var
  var _drizzleDb: DrizzleDb | undefined;
  // eslint-disable-next-line no-var
  var _tablesInitialized: boolean | undefined;
}

export function isDbConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return !!url && url.trim().length > 0 && !url.includes('<PASSWORD>');
}

export function getDb(): DrizzleDb {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is not set. Please configure your MySQL / TiDB connection string in .env.local.'
    );
  }

  if (global._drizzleDb) {
    return global._drizzleDb;
  }

  const isTiDB = connectionString.includes('tidbcloud.com') || connectionString.includes('ssl=true');

  const pool =
    global._mysqlPool ||
    mysql.createPool({
      uri: connectionString,
      ssl: isTiDB ? { minVersion: 'TLSv1.2', rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: process.env.NODE_ENV === 'production' ? 10 : 3,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });

  if (process.env.NODE_ENV !== 'production') {
    global._mysqlPool = pool;
  }

  // Auto-create tables once in background if not already initialized
  if (!global._tablesInitialized) {
    global._tablesInitialized = true;
    ensureTablesExist(pool).catch((e) => {
      console.warn('ensureTablesExist non-blocking notice:', e?.message || e);
    });
  }

  const dbInstance = drizzle(pool, { schema, mode: 'default' });

  if (process.env.NODE_ENV !== 'production') {
    global._drizzleDb = dbInstance;
  }

  return dbInstance;
}

// Proxied db instance for direct imports
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const instance = getDb();
    const value = instance[prop as keyof DrizzleDb];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
  },
});

export * from './schema';
