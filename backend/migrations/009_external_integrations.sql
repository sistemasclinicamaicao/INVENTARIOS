-- Integraciones salientes al ERP principal (reemplaza API keys inbound 008)

DROP TABLE IF EXISTS integration_request_log;
DROP TABLE IF EXISTS integration_api_keys;

CREATE TYPE external_auth_method AS ENUM ('NONE', 'API_KEY', 'BEARER', 'BASIC');

CREATE TABLE external_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  base_url VARCHAR(500) NOT NULL,
  internal_notes TEXT,
  auth_method external_auth_method NOT NULL DEFAULT 'NONE',
  auth_header_name VARCHAR(64) DEFAULT 'x-api-key',
  auth_secret_enc TEXT,
  auth_username VARCHAR(120),
  po_path_template VARCHAR(300) NOT NULL DEFAULT '/purchase-orders/{number}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_poll_at TIMESTAMPTZ
);

CREATE INDEX idx_external_integrations_active ON external_integrations(is_active) WHERE is_active = TRUE;

CREATE TABLE external_integration_poll_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID REFERENCES external_integrations(id) ON DELETE CASCADE,
  method VARCHAR(10) NOT NULL,
  url VARCHAR(800) NOT NULL,
  status_code INT NOT NULL,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_external_poll_log_created ON external_integration_poll_log(created_at DESC);
