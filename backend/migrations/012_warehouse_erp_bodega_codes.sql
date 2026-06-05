-- Códigos de bodega del ERP principal (02 = Almacén, 10 = Farmacia)
ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS erp_bodega_code VARCHAR(10);

UPDATE warehouses SET erp_bodega_code = '02' WHERE code = 'BC-ALM';
UPDATE warehouses SET erp_bodega_code = '10' WHERE code = 'BC-FARM';

CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_erp_bodega_code
  ON warehouses (erp_bodega_code)
  WHERE erp_bodega_code IS NOT NULL AND is_active = TRUE;
