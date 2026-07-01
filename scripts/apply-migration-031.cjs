const fs = require('fs');
const path = require('path');
const pg = require('../backend/node_modules/pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL requerida');
  process.exit(1);
}

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'backend', 'migrations', '031_precios_pmv_integration.sql'),
  'utf8',
);

async function main() {
  const client = new pg.Client({
    connectionString: url.replace(/^postgres:\/\//, 'postgresql://'),
  });
  await client.connect();
  await client.query(sql);
  const check = await client.query(
    `SELECT name, is_active, socrata_dataset_id,
            auth_secret_enc IS NOT NULL AS has_token
     FROM external_integrations
     WHERE name ILIKE 'PRECIOS PMV'`,
  );
  console.log('Integracion PRECIOS PMV:', check.rows[0] ?? 'no encontrada');
  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
