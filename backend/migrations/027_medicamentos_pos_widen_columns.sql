-- Ampliar columnas POS para datos reales de Socrata (valores largos en unidad, etc.)

ALTER TABLE medicamentos_pos_registros
  ALTER COLUMN registro_sanitario TYPE VARCHAR(200),
  ALTER COLUMN unidad TYPE TEXT,
  ALTER COLUMN via_administracion TYPE TEXT,
  ALTER COLUMN concentracion TYPE TEXT,
  ALTER COLUMN unidad_medida TYPE TEXT,
  ALTER COLUMN cantidad TYPE VARCHAR(200),
  ALTER COLUMN unidad_referencia TYPE TEXT,
  ALTER COLUMN forma_farmaceutica TYPE TEXT,
  ALTER COLUMN nombre_rol TYPE TEXT;
