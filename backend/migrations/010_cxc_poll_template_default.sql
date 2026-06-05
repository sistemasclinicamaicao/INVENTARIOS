-- Plantilla por defecto alineada con ERP Crystalos (?consecutivo=)
ALTER TABLE external_integrations
  ALTER COLUMN po_path_template SET DEFAULT '?consecutivo={number}';
