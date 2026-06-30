-- Fecha de última sincronización por catálogo y sincronización completa (manual/cron)
CREATE TABLE IF NOT EXISTS catalog_sync_status (
  sync_key VARCHAR(64) PRIMARY KEY,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source VARCHAR(32) NOT NULL DEFAULT 'manual',
  ok BOOLEAN NOT NULL DEFAULT TRUE,
  steps_completed INT,
  total_steps INT,
  message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_sync_status_synced_at
  ON catalog_sync_status(synced_at DESC);
