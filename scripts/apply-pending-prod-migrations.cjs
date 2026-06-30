/**
 * Aplica migraciones SQL faltantes en la BD indicada por DATABASE_URL.
 * Uso (desde raíz del repo):
 *   $env:DATABASE_URL="postgresql://..."; node scripts/apply-pending-prod-migrations.cjs
 */
const { readFileSync, readdirSync } = require('fs');
const { join } = require('path');
const pg = require('../backend/node_modules/pg');

const root = join(__dirname, '..');
const migrationsDir = join(root, 'backend', 'migrations');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL requerida');
  process.exit(1);
}

const CHECKS = [
  { file: '022_external_integrations_socrata.sql', column: { table: 'external_integrations', name: 'socrata_dataset_id' } },
  { file: '023_invima_socrata_columns.sql', column: { table: 'external_integrations', name: 'invima_list_type' } },
  { file: '024_rest_query_integration.sql', column: { table: 'external_integrations', name: 'integration_kind' } },
  { file: '026_medicamentos_pos_registros.sql', table: 'medicamentos_pos_registros' },
  { file: '027_medicamentos_pos_widen_columns.sql', table: 'medicamentos_pos_registros' },
  { file: '029_invima_pmv_registros.sql', table: 'invima_pmv_registros' },
  { file: '030_catalog_sync_status.sql', table: 'catalog_sync_status' },
];

async function tableExists(client, table) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return r.rowCount > 0;
}

async function columnExists(client, table, column) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return r.rowCount > 0;
}

async function isApplied(client, check) {
  if (check.table) return tableExists(client, check.table);
  if (check.column) return columnExists(client, check.column.table, check.column.name);
  return true;
}

async function main() {
  const client = new pg.Client({
    connectionString: url.replace(/^postgres:\/\//, 'postgresql://'),
  });
  await client.connect();

  const toApply = [];
  for (const check of CHECKS) {
    const applied = await isApplied(client, check);
    console.log(`${check.file}: ${applied ? 'ya aplicada' : 'PENDIENTE'}`);
    if (!applied) toApply.push(check.file);
  }

  // 027 solo si 026 existe pero columnas estrechas - si 026 pendiente, 027 va después en sort
  const ordered = [...new Set(toApply)].sort();

  if (!ordered.length) {
    console.log('\nNada pendiente en el rango 022-030.');
    await client.end();
    return;
  }

  console.log('\nAplicando:', ordered.join(', '));

  for (const file of ordered) {
    if (file === '027_medicamentos_pos_widen_columns.sql' && toApply.includes('026_medicamentos_pos_registros.sql')) {
      // 027 después de 026 en el mismo run
    }
    const path = join(migrationsDir, file);
    const sql = readFileSync(path, 'utf8');
    process.stdout.write(`→ ${file} ... `);
    try {
      await client.query(sql);
      console.log('OK');
    } catch (e) {
      console.log('ERROR');
      console.error(e.message);
      await client.end();
      process.exit(1);
    }
  }

  console.log('\nMigraciones aplicadas correctamente en producción.');
  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
