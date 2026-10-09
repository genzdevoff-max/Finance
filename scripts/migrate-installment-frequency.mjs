import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set in the environment or .env.local');
}

const isTiDB = url.includes('tidbcloud.com') || url.includes('ssl=true');
const connection = await mysql.createConnection({
  uri: url,
  ssl: isTiDB ? { minVersion: 'TLSv1.2', rejectUnauthorized: false } : undefined,
});

try {
  const [columns] = await connection.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'loans'
       AND COLUMN_NAME = 'installment_frequency'`
  );

  if (columns.length > 0) {
    console.log('Loan installment frequency is already configured.');
  } else {
    await connection.query(
      `ALTER TABLE loans
       ADD COLUMN installment_frequency VARCHAR(10) NOT NULL DEFAULT 'DAILY'`
    );
    console.log('Added installment_frequency to loans; existing loans default to DAILY.');
  }
} finally {
  await connection.end();
}
