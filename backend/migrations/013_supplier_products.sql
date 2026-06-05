-- Relación proveedor ↔ producto (catálogo importado desde ERP / CXC)

CREATE TABLE IF NOT EXISTS supplier_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  erp_code VARCHAR(50),
  last_unit_price DECIMAL(14, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier
  ON supplier_products (supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_products_product
  ON supplier_products (product_id);
