-- Vincular recepciones a la línea concreta de la OC (recepción parcial por línea)

ALTER TABLE reception_lines
  ADD COLUMN IF NOT EXISTS purchase_order_line_id UUID REFERENCES purchase_order_lines(id);

UPDATE reception_lines rl
SET purchase_order_line_id = sub.pol_id
FROM (
  SELECT rl2.id AS rl_id, pol.id AS pol_id
  FROM reception_lines rl2
  JOIN receptions r ON rl2.reception_id = r.id
  JOIN purchase_order_lines pol
    ON pol.purchase_order_id = r.purchase_order_id
   AND pol.product_id = rl2.product_id
  WHERE rl2.purchase_order_line_id IS NULL
) sub
WHERE rl.id = sub.rl_id;

CREATE INDEX IF NOT EXISTS idx_reception_lines_po_line
  ON reception_lines (purchase_order_line_id);
