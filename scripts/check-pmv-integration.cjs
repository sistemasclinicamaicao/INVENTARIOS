const { Client } = require('../backend/node_modules/pg');

async function main() {
  const url =
    process.env.DATABASE_URL ||
    'postgresql://clinica:clinica_secret@localhost:5434/clinica_erp';
  const c = new Client({ connectionString: url });
  await c.connect();
  const r = await c.query(`
    SELECT id, name, sync_target, socrata_query,
           auth_secret_enc IS NOT NULL AS has_token
    FROM external_integrations
    WHERE name ILIKE 'PRECIOS PMV'
  `);
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
