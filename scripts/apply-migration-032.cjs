const fs = require('fs');
const path = require('path');
const pg = require('../backend/node_modules/pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL requerida');
  process.exit(1);
}

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'backend', 'migrations', '032_pmv_socrata_query_fix.sql'),
  'utf8',
);

async function main() {
  const client = new pg.Client({
    connectionString: url.replace(/^postgres:\/\//, 'postgresql://'),
  });
  await client.connect();
  try {
    const r = await client.query(sql);
    console.log('[OK] Migración 032 aplicada', r.rowCount ?? '');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[ERROR]', e.message);
  process.exit(1);
});
