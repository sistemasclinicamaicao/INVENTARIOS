-- Integración Socrata «Medicamentos POS» (datos.gov.co view a7iv-sme8)

INSERT INTO external_integrations (
  name,
  is_active,
  integration_kind,
  base_url,
  internal_notes,
  auth_method,
  auth_header_name,
  auth_secret_enc,
  socrata_dataset_id,
  socrata_api_version,
  socrata_query,
  socrata_page_size,
  sync_target
)
SELECT
  'MEDICAMENTOS POS',
  TRUE,
  'SOCRATA_OPEN_DATA',
  'https://www.datos.gov.co',
  'Plan Obligatorio de Salud — medicamentos POS (SODA3 view a7iv-sme8). Requiere App Token datos.gov.co (X-App-Token).',
  'API_KEY',
  'X-App-Token',
  src.auth_secret_enc,
  'a7iv-sme8',
  'SODA3',
  'SELECT atc, principioactivo, descripcionatc, producto, expediente, registrosanitario, fechavencimiento, estadoregistro, descripcioncomercial, unidad, viaadministracion, concentracion, unidadmedida, cantidad, unidadreferencia, formafarmaceutica, nombrerol',
  1000,
  'NONE'
FROM (
  SELECT auth_secret_enc
  FROM external_integrations
  WHERE integration_kind = 'SOCRATA_OPEN_DATA'
    AND auth_secret_enc IS NOT NULL
  ORDER BY updated_at DESC
  LIMIT 1
) src
WHERE NOT EXISTS (
  SELECT 1 FROM external_integrations WHERE name ILIKE 'MEDICAMENTOS POS'
);

-- Si no había token previo, insertar sin secret
INSERT INTO external_integrations (
  name,
  is_active,
  integration_kind,
  base_url,
  internal_notes,
  auth_method,
  auth_header_name,
  socrata_dataset_id,
  socrata_api_version,
  socrata_query,
  socrata_page_size,
  sync_target
)
SELECT
  'MEDICAMENTOS POS',
  TRUE,
  'SOCRATA_OPEN_DATA',
  'https://www.datos.gov.co',
  'Plan Obligatorio de Salud — medicamentos POS (SODA3 view a7iv-sme8). Pegue App Token en Configuración → Integraciones.',
  'API_KEY',
  'X-App-Token',
  'a7iv-sme8',
  'SODA3',
  'SELECT atc, principioactivo, descripcionatc, producto, expediente, registrosanitario, fechavencimiento, estadoregistro, descripcioncomercial, unidad, viaadministracion, concentracion, unidadmedida, cantidad, unidadreferencia, formafarmaceutica, nombrerol',
  1000,
  'NONE'
WHERE NOT EXISTS (
  SELECT 1 FROM external_integrations WHERE name ILIKE 'MEDICAMENTOS POS'
);
