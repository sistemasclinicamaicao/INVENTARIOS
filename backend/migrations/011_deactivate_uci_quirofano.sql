-- Desactiva bodegas satélite UCI y Quirófanos (ya no se usan en maestro ni OC)

UPDATE internal_requisitions
SET status = 'CANCELLED'
WHERE dest_warehouse_id IN (SELECT id FROM warehouses WHERE code IN ('SAT-UCI', 'SAT-QUI'))
   OR source_warehouse_id IN (SELECT id FROM warehouses WHERE code IN ('SAT-UCI', 'SAT-QUI'));

UPDATE warehouses
SET is_active = FALSE
WHERE code IN ('SAT-UCI', 'SAT-QUI');
