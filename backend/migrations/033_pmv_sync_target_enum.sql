-- Destino de sincronización INVIMA_PMV para integración Precios PMV
-- (el valor enum y el UPDATE deben ir en transacciones separadas en PostgreSQL)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'integration_sync_target'
      AND e.enumlabel = 'INVIMA_PMV'
  ) THEN
    ALTER TYPE integration_sync_target ADD VALUE 'INVIMA_PMV';
  END IF;
END $$;
