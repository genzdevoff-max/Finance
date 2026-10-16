import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('❌ DATABASE_URL is not set in .env.local');
  process.exit(1);
}

try {
  const isTiDB = url.includes('tidbcloud.com') || url.includes('ssl=true');
  const conn = await mysql.createConnection({
    uri: url,
    ssl: isTiDB ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  });

  console.log('✅ Connected to database.');

  // Create users table if not exists
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(191) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX users_username_idx (username)
    );
  `);
  console.log('✅ "users" table verified / created successfully.');

  // Check if users exist or seed from env
  const [userRows] = await conn.query('SELECT COUNT(*) as count FROM users');
  const count = Number(userRows[0]?.count || 0);

  if (count === 0 && process.env.AUTH_USERNAME && process.env.AUTH_PASSWORD_HASH) {
    const id = crypto.randomUUID();
    await conn.query(
      'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
      [id, process.env.AUTH_USERNAME.trim(), process.env.AUTH_PASSWORD_HASH.trim()]
    );
    console.log(`✅ Seeded initial user "${process.env.AUTH_USERNAME}" from environment into users table.`);
  }

  const [tables] = await conn.query('SHOW TABLES');
  console.log('Current tables in DB:', tables.map((t) => Object.values(t)[0]));

  const [usersInDb] = await conn.query('SELECT id, username, created_at FROM users');
  console.log('Users in DB:', usersInDb);

  await conn.end();
  console.log('✅ Verification completed successfully.');
} catch (err) {
  console.error('❌ Error verifying database:', err.message);
  process.exit(1);
}
