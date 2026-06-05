-- Elimina SOLO datos de demostración (002_seed). Conserva esquema, roles y bodegas base.
-- Ejecutar antes de cargar información real de la clínica.

DELETE FROM controlled_drug_log;
DELETE FROM dispensations;
DELETE FROM prescription_lines;
DELETE FROM prescriptions;
DELETE FROM transfer_lines;
DELETE FROM transfers;
DELETE FROM picking_lines;
DELETE FROM picking_orders;
DELETE FROM internal_requisition_lines;
DELETE FROM internal_requisitions;
DELETE FROM inventory_movements;
DELETE FROM reception_lines;
DELETE FROM receptions;
DELETE FROM purchase_order_lines;
DELETE FROM purchase_orders;
DELETE FROM inventory_balances;
DELETE FROM lots;
DELETE FROM product_barcodes;
DELETE FROM unit_equivalences;
DELETE FROM products;
DELETE FROM locations;

-- Opcional: dejar solo usuario sincronizado desde RRHH (no borrar users/roles)
