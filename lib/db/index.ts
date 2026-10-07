import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type DrizzleDb = PostgresJsDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var _postgresClient: postgres.Sql | undefined;
  // eslint-disable-next-line no-var
  var _drizzleDb: DrizzleDb | undefined;
}

export function getDb(): DrizzleDb {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is not set. Please configure your Supabase connection string in .env.local.'
    );
  }

  if (global._drizzleDb) {
    return global._drizzleDb;
  }

  const client =
    global._postgresClient ||
    postgres(connectionString, {
      prepare: false, // Required for Supabase PgBouncer transaction mode pooler
      max: process.env.NODE_ENV === 'production' ? 10 : 2,
      idle_timeout: 20,
      connect_timeout: 10,
    });

  if (process.env.NODE_ENV !== 'production') {
    global._postgresClient = client;
  }

  const dbInstance = drizzle(client, { schema });

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
