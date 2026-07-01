-- PMV Socrata: quitar columna ajuste_julio_2025 (ya no existe en dataset nauz-qkjw)

UPDATE external_integrations
SET
  socrata_query = 'SELECT no, id_mr, mercado_relevante, cum, medicamento, cantidad_por_unidad_de_medida, unidad_de_medida, precio_maximo_de_venta_transaccion_primaria_secundaria_y_final_institucional, margen_para_ips, precio_maximo_de_venta_transaccion_primaria_y_secundaria_comercial, precio_maximo_de_venta_transaccion_final_comercial, circular_cnpmdm, fecha_de_inicio_vigencia_precio_maximo_de_venta',
  updated_at = NOW()
WHERE socrata_dataset_id = 'nauz-qkjw'
   OR name ILIKE 'PRECIOS PMV';
