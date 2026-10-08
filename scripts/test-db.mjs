import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.DATABASE_URL;

console.log('--- TiDB Cloud / MySQL Connection Tester ---');

if (!url) {
  console.error('❌ Error: DATABASE_URL is not set in .env.local');
  process.exit(1);
}

const maskedUrl = url.replace(/:([^:@]+)@/, ':****@');
console.log(`Connecting to: ${maskedUrl}`);

try {
  const isTiDB = url.includes('tidbcloud.com') || url.includes('ssl=true');
  const conn = await mysql.createConnection({
    uri: url,
    ssl: isTiDB ? { minVersion: 'TLSv1.2', rejectUnauthorized: false } : undefined,
  });

  console.log('✅ Connection established successfully!');

  const [dbs] = await conn.query('SELECT DATABASE() as currentDb, VERSION() as version');
  console.log('Database Info:', dbs[0]);

  const [tables] = await conn.query('SHOW TABLES');
  console.log('Tables in database:', tables);

  await conn.end();
  console.log('✅ Database is ready and operational.');
} catch (err) {
  console.error('❌ Connection failed:', err.message);
  if (err.message.includes('Access denied')) {
    console.log('\n👉 Tip: TiDB Cloud rejected the username or password.');
    console.log('In the TiDB Cloud console, click "Reset Password", copy the new password, and update it in .env.local');
  } else if (err.message.includes('Missing user name prefix')) {
    console.log('\n👉 Tip: Your TiDB Cloud username requires the prefix: <prefix>.root');
  }
  process.exit(1);
}
