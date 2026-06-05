-- Catálogo local Medicamentos POS (sincronizado desde Socrata a7iv-sme8)

CREATE TABLE medicamentos_pos_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_filename VARCHAR(255) NOT NULL,
  rows_imported INT NOT NULL DEFAULT 0,
  file_hash VARCHAR(64),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE medicamentos_pos_registros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES medicamentos_pos_import_batches(id) ON DELETE CASCADE,
  atc VARCHAR(50),
  principio_activo VARCHAR(500),
  descripcion_atc TEXT,
  producto VARCHAR(500),
  expediente VARCHAR(50),
  registro_sanitario VARCHAR(100),
  fecha_vencimiento DATE,
  estado_registro VARCHAR(80),
  descripcion_comercial TEXT,
  unidad VARCHAR(100),
  via_administracion VARCHAR(200),
  concentracion VARCHAR(200),
  unidad_medida VARCHAR(100),
  cantidad VARCHAR(50),
  unidad_referencia VARCHAR(100),
  forma_farmaceutica VARCHAR(200),
  nombre_rol VARCHAR(500),
  raw_row JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medicamentos_pos_registros_batch ON medicamentos_pos_registros(batch_id);
CREATE INDEX idx_medicamentos_pos_registros_atc ON medicamentos_pos_registros(atc);
CREATE INDEX idx_medicamentos_pos_registros_expediente ON medicamentos_pos_registros(expediente);
CREATE INDEX idx_medicamentos_pos_registros_producto_trgm
  ON medicamentos_pos_registros USING gin (producto gin_trgm_ops);

COMMENT ON TABLE medicamentos_pos_registros IS 'Catálogo POS local; sincronizar desde pestaña Sincronización (Socrata a7iv-sme8)';
