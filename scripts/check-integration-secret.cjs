const pg = require('../backend/node_modules/pg');
const { scryptSync, createDecipheriv } = require('crypto');

const id = process.argv[2] || '6cce35c6-54eb-41d7-bf11-3c7c82b27346';
const url = process.env.DATABASE_URL;
const secretKey =
  process.env.INTEGRATION_SECRET_KEY || process.env.JWT_SECRET || 'dev_integration_secret';

if (!url) {
  console.error('DATABASE_URL requerida');
  process.exit(1);
}

function decrypt(enc) {
  const parts = enc.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Formato inválido');
  const key = scryptSync(secretKey, 'clinica-integration-v1', 32);
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const data = Buffer.from(parts[3], 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

async function main() {
  const client = new pg.Client({
    connectionString: url.replace(/^postgres:\/\//, 'postgresql://'),
  });
  await client.connect();
  const { rows } = await client.query(
    `SELECT id, name, integration_kind, auth_method, auth_secret_enc, socrata_dataset_id
     FROM external_integrations WHERE id = $1`,
    [id],
  );
  if (!rows[0]) {
    console.log('Integración no encontrada:', id);
    await client.end();
    process.exit(1);
  }
  const row = rows[0];
  console.log('Integración:', row.name, `(${row.integration_kind})`);
  console.log('Dataset:', row.socrata_dataset_id ?? '—');
  if (!row.auth_secret_enc) {
    console.log('Estado: SIN token guardado — pegue App Token y guarde');
    await client.end();
    process.exit(1);
  }
  try {
    const plain = decrypt(row.auth_secret_enc);
    console.log('Descifrado: OK (longitud token:', plain.length, 'chars)');
  } catch (e) {
    console.log('Descifrado: FALLO —', e.message);
    console.log(
      'Causa probable: INTEGRATION_SECRET_KEY del backend no coincide con la clave usada al guardar el token.',
    );
    process.exit(1);
  }
  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
