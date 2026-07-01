/**
 * Auditoría CLI de las 7 integraciones requeridas por el job diario INVIMA.
 * Uso (desde raíz del repo):
 *   $env:DATABASE_URL="postgresql://..."; node scripts/invima-sync-audit.cjs
 */
const pg = require('../backend/node_modules/pg');

const INVIMA_LIST_TYPES = ['VIGENTE', 'VENCIDO', 'RENOVACION', 'OTRO_ESTADO'];
const INVIMA_LIST_LABELS = {
  VIGENTE: 'INVIMA CUM vigentes',
  VENCIDO: 'INVIMA CUM vencidos',
  RENOVACION: 'INVIMA CUM renovación',
  OTRO_ESTADO: 'INVIMA CUM otros estados',
};
const MEDICAMENTOS_POS_DATASET_ID = 'a7iv-sme8';
const INVIMA_PMV_DATASET_ID = 'nauz-qkjw';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL requerida');
  process.exit(1);
}

async function queryOne(client, sql, params) {
  const r = await client.query(sql, params);
  return r.rows[0] ?? null;
}

function pushItem(items, step, key, label, row, secretLabel) {
  if (!row) {
    items.push({
      step,
      key,
      label,
      ready: false,
      issue: `Sin integración «${label}»`,
    });
    return;
  }
  const hasSecret = !!row.auth_secret_enc;
  const ready = row.is_active && hasSecret;
  let issue = null;
  if (!row.is_active) issue = 'Integración inactiva';
  else if (!hasSecret) issue = `Falta ${secretLabel}`;
  items.push({
    step,
    key,
    label,
    ready,
    integrationName: row.name,
    isActive: row.is_active,
    hasSecret,
    issue,
  });
}

async function main() {
  const client = new pg.Client({
    connectionString: url.replace(/^postgres:\/\//, 'postgresql://'),
  });
  await client.connect();

  const items = [];
  let step = 0;

  for (const listType of INVIMA_LIST_TYPES) {
    step += 1;
    const row = await queryOne(
      client,
      `SELECT name, is_active, auth_secret_enc
       FROM external_integrations
       WHERE integration_kind = 'SOCRATA_OPEN_DATA'
         AND sync_target = 'INVIMA_REGISTROS'
         AND invima_list_type = $1
       ORDER BY is_active DESC, created_at ASC
       LIMIT 1`,
      [listType],
    );
    pushItem(items, step, listType, INVIMA_LIST_LABELS[listType] ?? listType, row, 'App Token');
  }

  step += 1;
  let row = await queryOne(
    client,
    `SELECT name, is_active, auth_secret_enc
     FROM external_integrations
     WHERE integration_kind = 'SOCRATA_OPEN_DATA'
       AND (socrata_dataset_id = $1 OR name ILIKE '%MEDICAMENTOS POS%')
     ORDER BY is_active DESC, updated_at DESC
     LIMIT 1`,
    [MEDICAMENTOS_POS_DATASET_ID],
  );
  pushItem(items, step, 'POS', 'Medicamentos POS', row, 'App Token');

  step += 1;
  row = await queryOne(
    client,
    `SELECT name, is_active, auth_secret_enc
     FROM external_integrations
     WHERE integration_kind = 'SOCRATA_OPEN_DATA'
       AND (socrata_dataset_id = $1 OR name ILIKE '%PMV%')
     ORDER BY is_active DESC, updated_at DESC
     LIMIT 1`,
    [INVIMA_PMV_DATASET_ID],
  );
  pushItem(items, step, 'PMV', 'Precios PMV', row, 'App Token');

  step += 1;
  row = await queryOne(
    client,
    `SELECT name, is_active, auth_secret_enc
     FROM external_integrations
     WHERE integration_kind = 'REST_QUERY'
       AND (base_url ILIKE '%/medicamentos%' OR name ILIKE '%MEDICAMENTOS KRYSTALOS%')
     ORDER BY is_active DESC, updated_at DESC
     LIMIT 1`,
  );
  pushItem(items, step, 'KRYSTALOS', 'Medicamentos Krystalos', row, 'API Key');

  await client.end();

  const allReady = items.every((i) => i.ready);
  console.log('\n=== Auditoría job diario INVIMA (7 integraciones) ===\n');
  for (const item of items) {
    const status = item.ready ? 'OK' : 'FALTA';
    const name = item.integrationName ? ` — ${item.integrationName}` : '';
    const issue = item.issue ? ` (${item.issue})` : '';
    console.log(`${item.step}. [${status}] ${item.label}${name}${issue}`);
  }
  console.log(`\nResultado: ${allReady ? 'LISTO para job diario' : 'INCOMPLETO — el job fallará en el primer paso roto'}`);
  process.exit(allReady ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
