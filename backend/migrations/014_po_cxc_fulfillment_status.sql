-- Estados de líneas OC vs CXC y OC incompletas al importar

DO $$ BEGIN
  CREATE TYPE po_line_fulfillment AS ENUM (
    'PENDING',
    'PARTIAL',
    'COMPLETE',
    'SURPLUS'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE po_import_status AS ENUM (
    'COMPLETE',
    'INCOMPLETE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE purchase_order_lines
  ADD COLUMN IF NOT EXISTS erp_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS qty_erp DECIMAL(14,4),
  ADD COLUMN IF NOT EXISTS fulfillment_status po_line_fulfillment NOT NULL DEFAULT 'PENDING';

UPDATE purchase_order_lines
SET qty_erp = qty_ordered
WHERE qty_erp IS NULL;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS erp_lines_count INT,
  ADD COLUMN IF NOT EXISTS linked_lines_count INT,
  ADD COLUMN IF NOT EXISTS import_status po_import_status;

CREATE TABLE IF NOT EXISTS purchase_order_missing_erp_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  erp_code VARCHAR(50) NOT NULL,
  erp_description TEXT,
  qty_erp DECIMAL(14,4) NOT NULL,
  unit_price DECIMAL(14,4) NOT NULL DEFAULT 0,
  reason VARCHAR(30) NOT NULL CHECK (reason IN ('MISSING_PRODUCT', 'WRONG_CATALOG')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_missing_erp_po
  ON purchase_order_missing_erp_lines (purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_po_lines_fulfillment
  ON purchase_order_lines (purchase_order_id, fulfillment_status);
