const pg = require('../backend/node_modules/pg');
const { scryptSync, createDecipheriv } = require('crypto');

const secretKey =
  process.env.INTEGRATION_SECRET_KEY || 'Zx8cV4bN2mK7jH5gF1dS0aQ9wE3rT6yU1iO4pL7kM0n';

function decrypt(enc) {
  const parts = enc.split(':');
  const key = scryptSync(secretKey, 'clinica-integration-v1', 32);
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64'));
  d.setAuthTag(Buffer.from(parts[2], 'base64'));
  return Buffer.concat([d.update(Buffer.from(parts[3], 'base64')), d.final()]).toString();
}

async function main() {
  const client = new pg.Client({
    connectionString: 'postgresql://clinica:clinica_secret@localhost:5434/clinica_erp',
  });
  await client.connect();
  const { rows } = await client.query(
    "SELECT auth_secret_enc FROM external_integrations WHERE name ILIKE 'PRECIOS PMV' LIMIT 1",
  );
  const token = decrypt(rows[0].auth_secret_enc);
  const res = await fetch('https://www.datos.gov.co/api/views/nauz-qkjw/columns.json', {
    headers: { 'X-App-Token': token },
  });
  const cols = await res.json();
  console.log(
    'columns:',
    cols.map((c) => c.fieldName || c.name).join('\n'),
  );
  await client.end();
}

main().catch(console.error);
