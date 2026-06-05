-- Mismo código ERP puede existir en farmacia y almacén (catálogos separados)

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_code_key;

DROP INDEX IF EXISTS idx_products_code_catalog;

CREATE UNIQUE INDEX idx_products_code_catalog
  ON products ((UPPER(TRIM(code))), is_farmacia);

-- Códigos MD del ERP suelen ser farmacia
UPDATE products
SET is_farmacia = TRUE,
    requires_lote = TRUE,
    policy = 'FEFO'::inventory_policy
WHERE UPPER(TRIM(code)) LIKE 'MD%'
  AND is_farmacia = FALSE;
