import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as dotenv from 'dotenv';
import * as schema from './schema';
import { ensureTablesExist } from './init';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function runSeed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set in environment or .env.local');
    process.exit(1);
  }

  console.log('Connecting to TiDB / MySQL database...');
  const isTiDB = url.includes('tidbcloud.com') || url.includes('ssl=true');
  const pool = mysql.createPool({
    uri: url,
    ssl: isTiDB ? { minVersion: 'TLSv1.2', rejectUnauthorized: false } : undefined,
  });

  console.log('Ensuring tables exist...');
  await ensureTablesExist(pool);

  console.log('Database initialized cleanly without mock data.');
  await pool.end();
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('Database init failed:', err);
  process.exit(1);
});
