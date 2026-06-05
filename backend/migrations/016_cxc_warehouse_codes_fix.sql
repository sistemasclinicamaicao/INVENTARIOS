-- Bodegas CXC: 02 Almacén | 10 Servicio Farmacéutico | 11 Confecciones

UPDATE warehouses SET is_active = FALSE, erp_bodega_code = NULL
WHERE code IN ('BC-HEMO', '10');

UPDATE warehouses SET erp_bodega_code = NULL
WHERE erp_bodega_code IN ('01', '04', '05') AND code NOT IN ('BC-ALM', 'BC-FARM', 'BC-CONF');

UPDATE warehouses SET
  erp_bodega_code = '02',
  name = U&'Almac\00E9n General',
  type = 'CENTRAL_ALMACEN',
  policy = 'FIFO',
  is_active = TRUE
WHERE code = 'BC-ALM';

UPDATE warehouses SET
  erp_bodega_code = '10',
  name = U&'Servicio Farmac\00E9utico',
  type = 'CENTRAL_FARMACIA',
  policy = 'FEFO',
  is_active = TRUE
WHERE code = 'BC-FARM';

UPDATE warehouses SET
  erp_bodega_code = '11',
  name = 'Confecciones',
  type = 'BODEGA_CONFECCIONES',
  policy = 'FIFO',
  is_active = TRUE
WHERE code = 'BC-CONF';
