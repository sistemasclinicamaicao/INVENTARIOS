-- Datos operativos iniciales (idempotente donde es posible)

-- Productos
INSERT INTO products (code, name, description, base_unit, is_farmacia, requires_lote, is_controlado, policy, min_stock)
VALUES
  ('10014', 'Acetaminofén 500mg', 'Caja x 100 Tab', 'TAB', TRUE, TRUE, FALSE, 'FEFO', 100),
  ('20455', 'Solución Salina 0.9% 500ml', 'Bolsa x 1 Und', 'UND', TRUE, TRUE, FALSE, 'FEFO', 50),
  ('30001', 'Epinefrina 1mg/ml Ampolla', 'Ampolla', 'UND', TRUE, TRUE, TRUE, 'FEFO', 20),
  ('30002', 'Amoxicilina 500mg Cápsula', 'Caja x 100 Cap', 'CAJ', TRUE, TRUE, FALSE, 'FEFO', 30)
ON CONFLICT (code) DO NOTHING;

-- Códigos de barras
INSERT INTO product_barcodes (product_id, barcode, type)
SELECT p.id, 'EAN' || p.code, 'EAN' FROM products p
WHERE p.code IN ('10014', '20455', '30001', '30002')
ON CONFLICT (barcode) DO NOTHING;

-- Lotes con vencimiento
INSERT INTO lots (product_id, lot_number, expires_at)
SELECT p.id, 'L-2023-99', '2026-06-10'::date FROM products p WHERE p.code = '30001'
ON CONFLICT (product_id, lot_number) DO NOTHING;

INSERT INTO lots (product_id, lot_number, expires_at)
SELECT p.id, 'L-8842-A', '2026-07-10'::date FROM products p WHERE p.code = '30002'
ON CONFLICT (product_id, lot_number) DO NOTHING;

INSERT INTO lots (product_id, lot_number, expires_at)
SELECT p.id, 'L-9988X', '2027-12-01'::date FROM products p WHERE p.code = '20455'
ON CONFLICT (product_id, lot_number) DO NOTHING;

-- Saldos en bodega central farmacia
INSERT INTO inventory_balances (warehouse_id, product_id, lot_id, qty)
SELECT w.id, p.id, l.id, 50
FROM warehouses w, products p, lots l
WHERE w.code = 'BC-FARM' AND p.code = '30001' AND l.lot_number = 'L-2023-99'
ON CONFLICT (warehouse_id, location_id, product_id, lot_id) DO UPDATE SET qty = EXCLUDED.qty;

INSERT INTO inventory_balances (warehouse_id, product_id, lot_id, qty)
SELECT w.id, p.id, l.id, 120
FROM warehouses w, products p, lots l
WHERE w.code = 'BC-FARM' AND p.code = '30002' AND l.lot_number = 'L-8842-A'
ON CONFLICT (warehouse_id, location_id, product_id, lot_id) DO UPDATE SET qty = EXCLUDED.qty;

INSERT INTO inventory_balances (warehouse_id, product_id, lot_id, qty)
SELECT w.id, p.id, l.id, 200
FROM warehouses w, products p, lots l
WHERE w.code = 'BC-FARM' AND p.code = '20455' AND l.lot_number = 'L-9988X'
ON CONFLICT (warehouse_id, location_id, product_id, lot_id) DO UPDATE SET qty = EXCLUDED.qty;

-- Stock bajo: acetaminofén sin saldo (solo OC pendiente)
INSERT INTO inventory_balances (warehouse_id, product_id, lot_id, qty)
SELECT w.id, p.id, NULL, 5
FROM warehouses w, products p
WHERE w.code = 'BC-ALM' AND p.code = '10014'
ON CONFLICT (warehouse_id, location_id, product_id, lot_id) DO UPDATE SET qty = EXCLUDED.qty;

-- Orden de compra abierta para recepción
INSERT INTO purchase_orders (number, supplier_name, warehouse_id, status)
SELECT 'OC-2026-889', 'PharmaMed S.A.', w.id, 'APPROVED'
FROM warehouses w WHERE w.code = 'BC-FARM'
ON CONFLICT (number) DO NOTHING;

INSERT INTO purchase_order_lines (purchase_order_id, product_id, qty_ordered, unit)
SELECT po.id, p.id, 50, 'CAJ' FROM purchase_orders po, products p
WHERE po.number = 'OC-2026-889' AND p.code = '10014'
AND NOT EXISTS (
  SELECT 1 FROM purchase_order_lines pol
  JOIN purchase_orders po2 ON po2.id = pol.purchase_order_id
  WHERE po2.number = 'OC-2026-889' AND pol.product_id = p.id
);

INSERT INTO purchase_order_lines (purchase_order_id, product_id, qty_ordered, unit)
SELECT po.id, p.id, 200, 'UND' FROM purchase_orders po, products p
WHERE po.number = 'OC-2026-889' AND p.code = '20455'
AND NOT EXISTS (
  SELECT 1 FROM purchase_order_lines pol
  JOIN purchase_orders po2 ON po2.id = pol.purchase_order_id
  WHERE po2.number = 'OC-2026-889' AND pol.product_id = p.id
);

-- Requisiciones pendientes
INSERT INTO internal_requisitions (number, source_warehouse_id, dest_warehouse_id, priority, status)
SELECT 'REQ-1042', s.id, d.id, 'ALTA', 'PENDING'
FROM warehouses s, warehouses d WHERE s.code = 'BC-FARM' AND d.code = 'SAT-URG'
ON CONFLICT (number) DO NOTHING;

-- Entregas de hoy (movimientos)
INSERT INTO inventory_movements (type, warehouse_id, product_id, lot_id, qty, reference_type, created_at)
SELECT 'PICK', w.id, p.id, l.id, 10, 'REQUISITION', NOW()
FROM warehouses w, products p, lots l
WHERE w.code = 'BC-FARM' AND p.code = '30002' AND l.lot_number = 'L-8842-A'
AND NOT EXISTS (
  SELECT 1 FROM inventory_movements im
  WHERE im.reference_type = 'REQUISITION' AND im.created_at::date = CURRENT_DATE AND im.product_id = p.id
  LIMIT 1
);
