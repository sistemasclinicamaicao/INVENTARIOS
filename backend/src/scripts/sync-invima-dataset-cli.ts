/**
 * Sincroniza un listado INVIMA por dataset ID Socrata.
 * Uso: node dist/scripts/sync-invima-dataset-cli.js vgr4-gemg
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { ExternalIntegrationsService } from '../integrations/external-integrations.service';

async function main() {
  const datasetId = process.argv[2];
  if (!datasetId) {
    console.error('Uso: node dist/scripts/sync-invima-dataset-cli.js <dataset-id>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ds = app.get(DataSource);
    const [row] = await ds.query<{ id: string }[]>(
      `SELECT id FROM external_integrations WHERE socrata_dataset_id = $1 AND is_active = TRUE`,
      [datasetId],
    );
    if (!row) {
      console.error(`No hay integración activa para dataset ${datasetId}`);
      process.exit(1);
    }

    const svc = app.get(ExternalIntegrationsService);
    console.log(`[INVIMA] Sincronizando ${datasetId}...`);
    const result = await svc.syncSocrata(row.id, true);
    console.log(result.message ?? JSON.stringify(result));
    process.exit(result.ok ? 0 : 1);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
