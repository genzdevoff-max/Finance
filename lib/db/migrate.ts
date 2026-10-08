import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function runMigrate() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set in environment or .env.local');
    process.exit(1);
  }

  console.log('Connecting to TiDB / MySQL database...');
  const isTiDB = url.includes('tidbcloud.com') || url.includes('ssl=true');
  const conn = await mysql.createConnection({
    uri: url,
    ssl: isTiDB ? { minVersion: 'TLSv1.2', rejectUnauthorized: false } : undefined,
  });

  const db = drizzle(conn);

  console.log('Running migrations from lib/db/migrations...');
  try {
    await migrate(db, { migrationsFolder: './lib/db/migrations' });
    console.log('Migrations applied successfully!');
  } catch (e: unknown) {
    console.warn('Migration step notice:', e instanceof Error ? e.message : String(e));
  }

  await conn.end();
  process.exit(0);
}

runMigrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
