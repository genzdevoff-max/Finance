import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function runMigrate() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set in environment or .env.local');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  console.log('Running migrations from lib/db/migrations...');
  await migrate(db, { migrationsFolder: './lib/db/migrations' });
  console.log('Migrations applied successfully!');

  await sql.end();
  process.exit(0);
}

runMigrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
