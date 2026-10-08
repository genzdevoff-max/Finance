import mysql from 'mysql2/promise';

async function testAll() {
  const configs = [
    {
      label: 'Standard connection to lonetracker',
      params: {
        host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
        port: 4000,
        user: '2jfg5VSYFYCSWGr.root',
        password: 'fbKhrByYkqOlhF6S',
        database: 'lonetracker',
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false },
      },
    },
    {
      label: 'Connection with rejectUnauthorized: true',
      params: {
        host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
        port: 4000,
        user: '2jfg5VSYFYCSWGr.root',
        password: 'fbKhrByYkqOlhF6S',
        database: 'lonetracker',
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      },
    },
    {
      label: 'Connection without database specified',
      params: {
        host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
        port: 4000,
        user: '2jfg5VSYFYCSWGr.root',
        password: 'fbKhrByYkqOlhF6S',
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false },
      },
    },
    {
      label: 'Connection via URI string',
      uri: 'mysql://2jfg5VSYFYCSWGr.root:fbKhrByYkqOlhF6S@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/lonetracker?ssl={"rejectUnauthorized":true}',
    },
  ];

  console.log('Testing TiDB Cloud Connection with:');
  console.log('Host: gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000');
  console.log('User: 2jfg5VSYFYCSWGr.root');
  console.log('Password: fbKhrByYkqOlhF6S');
  console.log('Database: lonetracker\n');

  for (const cfg of configs) {
    try {
      const conn = await mysql.createConnection(cfg.params || { uri: cfg.uri });
      console.log(`✅ [SUCCESS] ${cfg.label}`);
      const [rows] = await conn.query('SELECT 1 as val');
      console.log('   Query result:', rows);
      await conn.end();
      return;
    } catch (err) {
      console.log(`❌ [FAILED] ${cfg.label}`);
      console.log(`   Error Code: ${err.code}`);
      console.log(`   SQL Message: ${err.sqlMessage || err.message}\n`);
    }
  }
}

testAll();
