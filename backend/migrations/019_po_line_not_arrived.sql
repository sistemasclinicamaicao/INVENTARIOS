-- Línea OC marcada como mercancía que no llegará

DO $$ BEGIN
  ALTER TYPE po_line_fulfillment ADD VALUE 'NOT_ARRIVED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
