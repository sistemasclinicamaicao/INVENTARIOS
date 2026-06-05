-- Integraciones REST genéricas (consulta GET a URL fija, vista en tabla)

ALTER TYPE integration_kind ADD VALUE IF NOT EXISTS 'REST_QUERY';

COMMENT ON TYPE integration_kind IS 'ERP_PURCHASE_ORDER | SOCRATA_OPEN_DATA | REST_QUERY';
