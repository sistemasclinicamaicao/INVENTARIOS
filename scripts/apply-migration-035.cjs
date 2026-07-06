const fs = require('fs');
const path = require('path');
const pg = require('../backend/node_modules/pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL requerida');
  process.exit(1);
}

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'backend', 'migrations', '035_user_jesus_montes.sql'),
  'utf8',
);

async function main() {
  const client = new pg.Client({
    connectionString: url.replace(/^postgres:\/\//, 'postgresql://'),
  });
  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query(
      `SELECT u.cedula, u.email, u.full_name, array_agg(r.code) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.cedula = '1124046538'
       GROUP BY u.id`,
    );
    console.log('[OK] Migración 035 aplicada');
    if (rows[0]) console.log(rows[0]);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[ERROR]', e.message);
  process.exit(1);
});
