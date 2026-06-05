-- Clinica ERP - Inventario (Bodega + Farmacia)
-- PostgreSQL 16+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE inventory_policy AS ENUM ('FIFO', 'FEFO');
CREATE TYPE movement_type AS ENUM (
  'RECEPTION', 'PICK', 'TRANSFER_OUT', 'TRANSFER_IN',
  'DISPENSE', 'ADJUSTMENT', 'CYCLE_COUNT'
);
CREATE TYPE requisition_priority AS ENUM ('ALTA', 'MEDIA', 'NORMAL');
CREATE TYPE requisition_status AS ENUM ('PENDING', 'IN_PICKING', 'DISPATCHED', 'RECEIVED', 'CANCELLED');
CREATE TYPE po_status AS ENUM ('DRAFT', 'APPROVED', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- Roles y permisos
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Usuarios (sync RRHH)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cedula VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE login_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  cedula VARCHAR(20),
  success BOOLEAN NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status VARCHAR(20) NOT NULL,
  records_processed INT DEFAULT 0,
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Maestros
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('CENTRAL_ALMACEN', 'CENTRAL_FARMACIA', 'SATELITE')),
  policy inventory_policy NOT NULL DEFAULT 'FIFO',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  aisle VARCHAR(20),
  shelf VARCHAR(20),
  level VARCHAR(20),
  code VARCHAR(50) NOT NULL,
  UNIQUE (warehouse_id, code)
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  base_unit VARCHAR(30) NOT NULL DEFAULT 'UND',
  is_farmacia BOOLEAN NOT NULL DEFAULT FALSE,
  requires_lote BOOLEAN NOT NULL DEFAULT FALSE,
  is_controlado BOOLEAN NOT NULL DEFAULT FALSE,
  policy inventory_policy,
  min_stock DECIMAL(14,4) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_barcodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('EAN', 'GS1', 'INTERNAL')),
  UNIQUE (barcode)
);

CREATE TABLE unit_equivalences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  from_unit VARCHAR(30) NOT NULL,
  to_unit VARCHAR(30) NOT NULL,
  factor DECIMAL(14,6) NOT NULL,
  UNIQUE (product_id, from_unit, to_unit)
);

-- Compras
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(30) UNIQUE NOT NULL,
  supplier_name VARCHAR(200) NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  status po_status NOT NULL DEFAULT 'DRAFT',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  qty_ordered DECIMAL(14,4) NOT NULL,
  unit VARCHAR(30) NOT NULL
);

CREATE TABLE receptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
  number VARCHAR(30) UNIQUE NOT NULL,
  received_by UUID REFERENCES users(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_partial BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE reception_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reception_id UUID NOT NULL REFERENCES receptions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  qty_received DECIMAL(14,4) NOT NULL,
  lot_number VARCHAR(80),
  expires_at DATE,
  lot_id UUID
);

-- Lotes e inventario
CREATE TABLE lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  lot_number VARCHAR(80) NOT NULL,
  expires_at DATE,
  internal_barcode VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, lot_number)
);

ALTER TABLE reception_lines
  ADD CONSTRAINT fk_reception_lines_lot
  FOREIGN KEY (lot_id) REFERENCES lots(id);

CREATE TABLE inventory_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  location_id UUID REFERENCES locations(id),
  product_id UUID NOT NULL REFERENCES products(id),
  lot_id UUID REFERENCES lots(id),
  qty DECIMAL(14,4) NOT NULL DEFAULT 0 CHECK (qty >= 0),
  UNIQUE (warehouse_id, location_id, product_id, lot_id)
);

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type movement_type NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  lot_id UUID REFERENCES lots(id),
  qty DECIMAL(14,4) NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operaciones
CREATE TABLE internal_requisitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(30) UNIQUE NOT NULL,
  source_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  dest_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  priority requisition_priority NOT NULL DEFAULT 'NORMAL',
  status requisition_status NOT NULL DEFAULT 'PENDING',
  requested_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE internal_requisition_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id UUID NOT NULL REFERENCES internal_requisitions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  qty_requested DECIMAL(14,4) NOT NULL,
  unit VARCHAR(30) NOT NULL
);

CREATE TABLE picking_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id UUID NOT NULL REFERENCES internal_requisitions(id),
  number VARCHAR(30) UNIQUE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE picking_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  picking_order_id UUID NOT NULL REFERENCES picking_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  lot_id UUID NOT NULL REFERENCES lots(id),
  qty_to_pick DECIMAL(14,4) NOT NULL,
  qty_picked DECIMAL(14,4) NOT NULL DEFAULT 0,
  location_id UUID REFERENCES locations(id)
);

CREATE TABLE transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number VARCHAR(30) UNIQUE NOT NULL,
  picking_order_id UUID REFERENCES picking_orders(id),
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  status VARCHAR(30) NOT NULL DEFAULT 'IN_TRANSIT',
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transfer_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  lot_id UUID NOT NULL REFERENCES lots(id),
  qty DECIMAL(14,4) NOT NULL
);

-- Farmacia / HIS
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(100) UNIQUE,
  patient_id VARCHAR(100) NOT NULL,
  doctor_id VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prescription_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  dose_qty DECIMAL(14,4) NOT NULL,
  dose_unit VARCHAR(30) NOT NULL
);

CREATE TABLE dispensations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id),
  dispensed_by UUID REFERENCES users(id),
  dispensed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE controlled_drug_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispensation_id UUID NOT NULL REFERENCES dispensations(id),
  validator_user_id UUID NOT NULL REFERENCES users(id),
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Indices
CREATE INDEX idx_lots_expires ON lots(expires_at);
CREATE INDEX idx_inventory_balances_product ON inventory_balances(product_id, warehouse_id);
CREATE INDEX idx_movements_created ON inventory_movements(created_at);
CREATE INDEX idx_requisitions_status ON internal_requisitions(status, priority);

-- Seed roles
INSERT INTO roles (code, name) VALUES
  ('admin', 'Administrador'),
  ('bodeguero', 'Bodeguero'),
  ('regente_farmacia', 'Regente de Farmacia'),
  ('medico', 'Médico');

INSERT INTO permissions (code, name) VALUES
  ('dashboard.view', 'Ver panel principal'),
  ('reception.manage', 'Gestionar recepción'),
  ('picking.manage', 'Gestionar picking'),
  ('inventory.view', 'Ver inventario'),
  ('pharmacy.dispense', 'Dispensar medicamentos'),
  ('pharmacy.controlled', 'Validar controlados'),
  ('admin.users', 'Administrar usuarios');

-- Seed warehouses
INSERT INTO warehouses (code, name, type, policy) VALUES
  ('BC-ALM', 'Bodega Central - Almacén Gral', 'CENTRAL_ALMACEN', 'FIFO'),
  ('BC-FARM', 'Bodega Central - Farmacia', 'CENTRAL_FARMACIA', 'FEFO'),
  ('SAT-URG', 'Bodega Satélite - Urgencias', 'SATELITE', 'FIFO');

-- Usuario demo (password: Admin123! — bcrypt generado en seed app)
INSERT INTO users (cedula, email, full_name, password_hash, is_active) VALUES
  ('1234567890', 'carlos.ruiz@clinica.local', 'Dr. Carlos Ruiz', NULL, TRUE);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.cedula = '1234567890' AND r.code = 'regente_farmacia';
