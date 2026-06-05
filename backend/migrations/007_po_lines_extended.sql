-- Líneas OC: precio unitario y datos de lote (farmacia)

ALTER TABLE purchase_order_lines
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lot_number VARCHAR(80),
  ADD COLUMN IF NOT EXISTS expires_at DATE;
