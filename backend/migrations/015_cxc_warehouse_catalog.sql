-- Bodegas CXC: 01 Almacén | 02 Farmacia | 04 Hemoderivados | 05 Confecciones

ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_type_check;
ALTER TABLE warehouses ADD CONSTRAINT warehouses_type_check
  CHECK (type IN (
    'CENTRAL_ALMACEN',
    'CENTRAL_FARMACIA',
    'BODEGA_HEMODERIVADOS',
    'BODEGA_CONFECCIONES',
    'SATELITE'
  ));

UPDATE warehouses SET
  erp_bodega_code = '01',
  name = 'Almacén General',
  type = 'CENTRAL_ALMACEN',
  policy = 'FIFO',
  is_active = TRUE
WHERE code = 'BC-ALM';

UPDATE warehouses SET
  erp_bodega_code = '02',
  name = 'Bodega Farmacia',
  type = 'CENTRAL_FARMACIA',
  policy = 'FEFO',
  is_active = TRUE
WHERE code = 'BC-FARM';

INSERT INTO warehouses (code, name, type, policy, erp_bodega_code, is_active)
VALUES
  ('BC-HEMO', 'Bodega Hemoderivados', 'BODEGA_HEMODERIVADOS', 'FEFO', '04', TRUE),
  ('BC-CONF', 'Confecciones', 'BODEGA_CONFECCIONES', 'FIFO', '05', TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  policy = EXCLUDED.policy,
  erp_bodega_code = EXCLUDED.erp_bodega_code,
  is_active = TRUE;
