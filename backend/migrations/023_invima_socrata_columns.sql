-- Columnas adicionales del dataset Socrata INVIMA CUM (29 columnas oficiales)

ALTER TABLE invima_registros
  ADD COLUMN IF NOT EXISTS muestra_medica VARCHAR(10),
  ADD COLUMN IF NOT EXISTS unidad VARCHAR(50),
  ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(80),
  ADD COLUMN IF NOT EXISTS cantidad VARCHAR(50),
  ADD COLUMN IF NOT EXISTS unidad_referencia TEXT,
  ADD COLUMN IF NOT EXISTS nombre_rol VARCHAR(500),
  ADD COLUMN IF NOT EXISTS tipo_rol VARCHAR(120),
  ADD COLUMN IF NOT EXISTS modalidad VARCHAR(120);

UPDATE external_integrations
SET socrata_query = 'SELECT expediente, producto, titular, registrosanitario, fechaexpedicion, fechavencimiento, estadoregistro, expedientecum, consecutivocum, cantidadcum, descripcioncomercial, estadocum, fechaactivo, fechainactivo, muestramedica, unidad, atc, descripcionatc, viaadministracion, concentracion, principioactivo, unidadmedida, cantidad, unidadreferencia, formafarmaceutica, nombrerol, tiporol, modalidad, ium'
WHERE integration_kind = 'SOCRATA_OPEN_DATA'
  AND sync_target = 'INVIMA_REGISTROS';
