-- Integraciones Socrata / datos abiertos (SODA) además de sondeo ERP

DO $$ BEGIN
  CREATE TYPE integration_kind AS ENUM ('ERP_PURCHASE_ORDER', 'SOCRATA_OPEN_DATA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE socrata_api_version AS ENUM ('SODA2', 'SODA3');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE integration_sync_target AS ENUM ('NONE', 'INVIMA_REGISTROS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE external_integrations
  ADD COLUMN IF NOT EXISTS integration_kind integration_kind NOT NULL DEFAULT 'ERP_PURCHASE_ORDER',
  ADD COLUMN IF NOT EXISTS socrata_dataset_id VARCHAR(32),
  ADD COLUMN IF NOT EXISTS socrata_api_version socrata_api_version DEFAULT 'SODA3',
  ADD COLUMN IF NOT EXISTS socrata_query TEXT,
  ADD COLUMN IF NOT EXISTS socrata_page_size INT NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS sync_target integration_sync_target NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS invima_list_type invima_list_type;

ALTER TABLE external_integrations
  ALTER COLUMN po_path_template DROP NOT NULL;

COMMENT ON COLUMN external_integrations.socrata_dataset_id IS 'ID Socrata ej. i7cb-raxc (datos.gov.co)';
COMMENT ON COLUMN external_integrations.socrata_query IS 'Consulta SoQL completa';
COMMENT ON COLUMN external_integrations.sync_target IS 'Destino al sincronizar: INVIMA_REGISTROS, etc.';
