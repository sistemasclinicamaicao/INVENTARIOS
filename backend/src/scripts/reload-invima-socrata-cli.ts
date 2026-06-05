/**
 * Vacía invima_registros y recarga desde integraciones Socrata INVIMA activas.
 * Uso: npm run reload:invima-socrata
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ExternalIntegrationsService } from '../integrations/external-integrations.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const integrations = app.get(ExternalIntegrationsService);
    console.log('[INVIMA] Vaciando datos anteriores...');
    const result = await integrations.reloadAllInvimaFromSocrata(true);
    console.log(`[INVIMA] ${result.message}`);
    for (const r of result.results) {
      const line = r.ok
        ? `[OK] ${r.listType} — ${r.integrationName}: ${r.rowsImported?.toLocaleString() ?? 0} filas`
        : `[FAIL] ${r.listType} — ${r.integrationName}: ${r.message}`;
      console.log(line);
    }
    process.exit(result.ok ? 0 : 1);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
