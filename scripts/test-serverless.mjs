import { connect } from '@tidbcloud/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const url = process.env.DATABASE_URL;
console.log('Testing @tidbcloud/serverless connect with URL:', url?.replace(/:([^:@]+)@/, ':****@'));

try {
  const conn = connect({ url });
  const result = await conn.execute('SELECT 1 + 1 as result');
  console.log('✅ Serverless test success:', result);
} catch (err) {
  console.error('❌ Serverless connection failed:', err.message);
}
