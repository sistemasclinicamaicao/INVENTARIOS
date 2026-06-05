-- Recuperar líneas marcadas NOT_ARRIVED: vuelven a PENDING/PARTIAL según lo recibido

UPDATE purchase_order_lines pol SET fulfillment_status = sub.st
FROM (
  SELECT pol2.id,
    CASE
      WHEN COALESCE(rcv.total, 0) <= 0 THEN 'PENDING'::po_line_fulfillment
      WHEN COALESCE(rcv.total, 0) < COALESCE(pol2.qty_erp, pol2.qty_ordered)
        THEN 'PARTIAL'::po_line_fulfillment
      WHEN COALESCE(rcv.total, 0) = COALESCE(pol2.qty_erp, pol2.qty_ordered)
        THEN 'COMPLETE'::po_line_fulfillment
      ELSE 'SURPLUS'::po_line_fulfillment
    END AS st
  FROM purchase_order_lines pol2
  LEFT JOIN (
    SELECT r.purchase_order_id, rl.product_id, SUM(rl.qty_received)::numeric AS total
    FROM reception_lines rl
    JOIN receptions r ON r.id = rl.reception_id
    GROUP BY r.purchase_order_id, rl.product_id
  ) rcv ON rcv.purchase_order_id = pol2.purchase_order_id AND rcv.product_id = pol2.product_id
  WHERE pol2.fulfillment_status = 'NOT_ARRIVED'::po_line_fulfillment
) sub
WHERE pol.id = sub.id;
