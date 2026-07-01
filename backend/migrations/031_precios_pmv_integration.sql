-- Integración Socrata «Precios PMV» (datos.gov.co view nauz-qkjw)

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
  'PRECIOS PMV',
  TRUE,
  'SOCRATA_OPEN_DATA',
  'https://www.datos.gov.co',
  'Precios máximos de venta INVIMA (SODA3 view nauz-qkjw). Requiere App Token datos.gov.co (X-App-Token).',
  'API_KEY',
  'X-App-Token',
  src.auth_secret_enc,
  'nauz-qkjw',
  'SODA3',
  'SELECT no, id_mr, mercado_relevante, cum, medicamento, cantidad_por_unidad_de_medida, unidad_de_medida, precio_maximo_de_venta_transaccion_primaria_secundaria_y_final_institucional, margen_para_ips, precio_maximo_de_venta_transaccion_primaria_y_secundaria_comercial, precio_maximo_de_venta_transaccion_final_comercial, circular_cnpmdm, fecha_de_inicio_vigencia_precio_maximo_de_venta',
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
  SELECT 1 FROM external_integrations WHERE name ILIKE 'PRECIOS PMV'
);

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
  'PRECIOS PMV',
  TRUE,
  'SOCRATA_OPEN_DATA',
  'https://www.datos.gov.co',
  'Precios máximos de venta INVIMA (SODA3 view nauz-qkjw). Pegue App Token en Configuración → Integraciones.',
  'API_KEY',
  'X-App-Token',
  'nauz-qkjw',
  'SODA3',
  'SELECT no, id_mr, mercado_relevante, cum, medicamento, cantidad_por_unidad_de_medida, unidad_de_medida, precio_maximo_de_venta_transaccion_primaria_secundaria_y_final_institucional, margen_para_ips, precio_maximo_de_venta_transaccion_primaria_y_secundaria_comercial, precio_maximo_de_venta_transaccion_final_comercial, circular_cnpmdm, fecha_de_inicio_vigencia_precio_maximo_de_venta',
  1000,
  'NONE'
WHERE NOT EXISTS (
  SELECT 1 FROM external_integrations WHERE name ILIKE 'PRECIOS PMV'
);
