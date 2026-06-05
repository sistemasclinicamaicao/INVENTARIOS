-- Referencia INVIMA: listados código único (sin cruce a products aún)

CREATE TYPE invima_list_type AS ENUM ('VIGENTE', 'VENCIDO', 'RENOVACION', 'OTRO_ESTADO');

CREATE TABLE invima_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_type invima_list_type NOT NULL,
  source_filename VARCHAR(255) NOT NULL,
  generated_at DATE,
  rows_imported INT NOT NULL DEFAULT 0,
  file_hash VARCHAR(64),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invima_registros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES invima_import_batches(id) ON DELETE CASCADE,
  list_type invima_list_type NOT NULL,
  expediente VARCHAR(50),
  producto VARCHAR(500),
  titular VARCHAR(500),
  registro_sanitario VARCHAR(100),
  fecha_expedicion DATE,
  fecha_vencimiento DATE,
  estado_registro VARCHAR(80),
  expediente_cum VARCHAR(50),
  consecutivo_cum VARCHAR(30),
  cantidad_cum VARCHAR(30),
  cum_codigo VARCHAR(80),
  descripcion_comercial TEXT,
  estado_cum VARCHAR(40),
  fecha_activo DATE,
  fecha_inactivo DATE,
  principio_activo VARCHAR(500),
  concentracion VARCHAR(200),
  forma_farmaceutica VARCHAR(200),
  via_administracion VARCHAR(200),
  atc VARCHAR(50),
  descripcion_atc TEXT,
  ium VARCHAR(100),
  raw_row JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invima_registros_batch ON invima_registros(batch_id);
CREATE INDEX idx_invima_registros_cum ON invima_registros(cum_codigo);
CREATE INDEX idx_invima_registros_registro ON invima_registros(registro_sanitario);
CREATE INDEX idx_invima_registros_expediente ON invima_registros(expediente);
CREATE INDEX idx_invima_registros_list_type ON invima_registros(list_type);
CREATE INDEX idx_invima_registros_vencimiento ON invima_registros(fecha_vencimiento);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_invima_registros_producto_trgm ON invima_registros USING gin (producto gin_trgm_ops);

COMMENT ON TABLE invima_registros IS 'Listados INVIMA código único; cruce con products: fase futura (product_invima_links)';
