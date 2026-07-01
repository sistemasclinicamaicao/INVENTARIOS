const pg = require('../backend/node_modules/pg');
const { scryptSync, createDecipheriv, createCipheriv, randomBytes } = require('crypto');

const plainToken = process.argv[2];
const url = process.env.DATABASE_URL;

if (!plainToken || !url) {
  console.error('Uso: DATABASE_URL=... node scripts/update-socrata-app-token.cjs <app_token>');
  process.exit(1);
}

function deriveKey(secret) {
  return scryptSync(secret, 'clinica-integration-v1', 32);
}

function encrypt(plain, secret) {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decrypt(enc, secret) {
  const parts = enc.split(':');
  const key = deriveKey(secret);
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64'));
  d.setAuthTag(Buffer.from(parts[2], 'base64'));
  return Buffer.concat([d.update(Buffer.from(parts[3], 'base64')), d.final()]).toString();
}

function resolveSecrets() {
  const keys = [];
  if (process.env.INTEGRATION_SECRET_KEY) keys.push(process.env.INTEGRATION_SECRET_KEY);
  if (process.env.JWT_SECRET) keys.push(process.env.JWT_SECRET);
  keys.push('dev_integration_secret');
  return [...new Set(keys)];
}

async function testToken(token) {
  const res = await fetch('https://www.datos.gov.co/api/v3/views/nauz-qkjw/query.json', {
    method: 'POST',
    headers: { 'X-App-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'SELECT no LIMIT 1',
      page: { pageNumber: 1, pageSize: 1 },
    }),
  });
  return { status: res.status, body: (await res.text()).slice(0, 150) };
}

async function main() {
  const token = plainToken.trim();
  const test = await testToken(token);
  console.log('Prueba Socrata PMV:', test.status, test.body);

  const client = new pg.Client({
    connectionString: url.replace(/^postgres:\/\//, 'postgresql://'),
  });
  await client.connect();

  const secrets = resolveSecrets();
  const { rows } = await client.query(
    `SELECT id, name, auth_secret_enc FROM external_integrations
     WHERE integration_kind = 'SOCRATA_OPEN_DATA' AND is_active = TRUE`,
  );

  let encryptKey = process.env.INTEGRATION_SECRET_KEY || process.env.JWT_SECRET;
  for (const row of rows) {
    if (!row.auth_secret_enc) continue;
    for (const s of secrets) {
      try {
        decrypt(row.auth_secret_enc, s);
        if (!encryptKey) encryptKey = s;
        break;
      } catch {
        /* try next */
      }
    }
  }
  if (!encryptKey) {
    encryptKey = secrets[0];
    console.warn('No se pudo inferir clave; usando INTEGRATION_SECRET_KEY o JWT_SECRET del entorno');
  }

  const enc = encrypt(token, encryptKey);
  const { rowCount } = await client.query(
    `UPDATE external_integrations
     SET auth_secret_enc = $1,
         auth_method = 'API_KEY',
         auth_header_name = 'X-App-Token',
         updated_at = NOW()
     WHERE integration_kind = 'SOCRATA_OPEN_DATA' AND is_active = TRUE`,
    [enc],
  );

  console.log(`Actualizadas ${rowCount} integraciones Socrata activas (clave: ${encryptKey.slice(0, 4)}…)`);
  const names = await client.query(
    `SELECT name FROM external_integrations
     WHERE integration_kind = 'SOCRATA_OPEN_DATA' AND is_active = TRUE ORDER BY name`,
  );
  for (const r of names.rows) console.log(' -', r.name);
  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
