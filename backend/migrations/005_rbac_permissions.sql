-- RBAC: permisos por rol

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'bodeguero'
  AND p.code IN ('dashboard.view', 'reception.manage', 'picking.manage', 'inventory.view')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'regente_farmacia'
  AND p.code IN (
    'dashboard.view', 'inventory.view', 'pharmacy.dispense',
    'pharmacy.controlled', 'reception.manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'medico'
  AND p.code IN ('dashboard.view', 'pharmacy.dispense')
ON CONFLICT DO NOTHING;

-- Usuario demo como administrador (acceso completo Fase 2)
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE cedula = '1234567890');
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.cedula = '1234567890' AND r.code = 'admin';

-- Segundo usuario demo bodeguero
INSERT INTO users (cedula, email, full_name, is_active)
VALUES ('9876543210', 'bodega@clinica.local', 'Ana Bodeguero', TRUE)
ON CONFLICT (cedula) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.cedula = '9876543210' AND r.code = 'bodeguero'
ON CONFLICT DO NOTHING;
