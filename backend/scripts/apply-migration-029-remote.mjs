import { readFileSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const sqlPath = join(import.meta.dirname, '../migrations/029_invima_pmv_registros.sql');
const url =
  process.env.DATABASE_URL ??
  'postgres://postgres:nd5pi6cepi4mktkq02r9@easypanel.clinicamaicao.com:5434/clinica_erp?sslmode=disable';

const client = new Client({ connectionString: url });
await client.connect();
try {
  const exists = await client.query(
    `SELECT to_regclass('public.invima_pmv_registros') AS reg`,
  );
  if (exists.rows[0]?.reg) {
    console.log('Tabla invima_pmv_registros ya existe');
  } else {
    const sql = readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('OK: migracion 029 aplicada');
  }
  const check = await client.query(
    `SELECT COUNT(*)::int AS batches FROM invima_pmv_import_batches`,
  );
  console.log('Lotes PMV:', check.rows[0]?.batches ?? 0);
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
