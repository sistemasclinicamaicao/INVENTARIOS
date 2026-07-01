const pg = require('../backend/node_modules/pg');
const { scryptSync, createDecipheriv } = require('crypto');

const url = process.env.DATABASE_URL;
const keys = [
  process.env.INTEGRATION_SECRET_KEY,
  process.env.JWT_SECRET,
  'dev_integration_secret',
].filter(Boolean);

function tryDecrypt(enc, secret) {
  const parts = enc.split(':');
  const key = scryptSync(secret, 'clinica-integration-v1', 32);
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64'));
  d.setAuthTag(Buffer.from(parts[2], 'base64'));
  return Buffer.concat([d.update(Buffer.from(parts[3], 'base64')), d.final()]).toString();
}

async function testSocrata(token) {
  const res = await fetch('https://www.datos.gov.co/api/v3/views/nauz-qkjw/query.json', {
    method: 'POST',
    headers: { 'X-App-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'SELECT no LIMIT 1', page: { pageNumber: 1, pageSize: 1 } }),
  });
  return res.status;
}

async function main() {
  const client = new pg.Client({
    connectionString: url.replace(/^postgres:\/\//, 'postgresql://'),
  });
  await client.connect();
  const { rows } = await client.query(
    `SELECT name, auth_secret_enc FROM external_integrations WHERE name ILIKE 'precios pmv'`,
  );
  const enc = rows[0]?.auth_secret_enc;
  console.log('Integration:', rows[0]?.name);
  for (const k of keys) {
    try {
      const t = tryDecrypt(enc, k);
      const st = await testSocrata(t);
      console.log(`key ${k.slice(0, 6)}… → token len ${t.length} → Socrata ${st}`);
      console.log('token prefix:', t.slice(0, 6) + '…');
    } catch (e) {
      console.log(`key ${k.slice(0, 6)}… → decrypt fail`);
    }
  }
  await client.end();
}

main();
