const fs = require('fs');
const path = require('path');
const pg = require('../backend/node_modules/pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL requerida');
  process.exit(1);
}

const sql033 = fs.readFileSync(
  path.join(__dirname, '..', 'backend', 'migrations', '033_pmv_sync_target_enum.sql'),
  'utf8',
);
const sql034 = fs.readFileSync(
  path.join(__dirname, '..', 'backend', 'migrations', '034_pmv_sync_target_assign.sql'),
  'utf8',
);

async function main() {
  const client = new pg.Client({
    connectionString: url.replace(/^postgres:\/\//, 'postgresql://'),
  });
  await client.connect();
  try {
    await client.query(sql033);
    await client.query(sql034);
    console.log('[OK] Migraciones 033-034 aplicadas');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[ERROR]', e.message);
  process.exit(1);
});
