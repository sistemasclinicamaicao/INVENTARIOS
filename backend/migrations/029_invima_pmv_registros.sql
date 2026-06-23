-- Precios máximos de venta INVIMA (PMV) — carga desde Excel .xlsx / .xlsb

CREATE TABLE invima_pmv_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_filename VARCHAR(255) NOT NULL,
  rows_imported INT NOT NULL DEFAULT 0,
  file_hash VARCHAR(64),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invima_pmv_registros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES invima_pmv_import_batches(id) ON DELETE CASCADE,
  numero VARCHAR(20),
  id_mr VARCHAR(50),
  mercado_relevante TEXT,
  cum VARCHAR(40),
  medicamento TEXT,
  cantidad_unidad_medida VARCHAR(50),
  unidad_medida VARCHAR(50),
  precio_max_institucional NUMERIC(18, 2),
  margen_ips NUMERIC(18, 2),
  precio_max_comercial_ps NUMERIC(18, 2),
  precio_max_comercial_final NUMERIC(18, 2),
  circular_cnpmdm VARCHAR(200),
  fecha_inicio_vigencia DATE,
  ajuste_julio_2025 VARCHAR(100),
  raw_row JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invima_pmv_registros_batch ON invima_pmv_registros(batch_id);
CREATE INDEX idx_invima_pmv_registros_cum ON invima_pmv_registros(cum);
CREATE INDEX idx_invima_pmv_registros_medicamento_trgm
  ON invima_pmv_registros USING gin (medicamento gin_trgm_ops);

COMMENT ON TABLE invima_pmv_registros IS 'Precios máximos de venta por presentación comercial (PMV INVIMA)';
