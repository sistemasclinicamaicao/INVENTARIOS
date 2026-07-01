-- Asignar sync_target INVIMA_PMV a integración Precios PMV (ejecutar tras 033_pmv_sync_target_enum.sql)

UPDATE external_integrations
SET
  sync_target = 'INVIMA_PMV',
  updated_at = NOW()
WHERE name ILIKE 'PRECIOS PMV'
   OR socrata_dataset_id = 'nauz-qkjw';
