-- Usuario: Jesús Montes (password inicial: Admin123!)
INSERT INTO users (cedula, email, full_name, password_hash, is_active)
VALUES (
  '1124046538',
  'montesan.jesus@gmail.com',
  'Jesús Montes',
  '$2b$10$Rq7PEYgN16UhvmOE8jeU9eFhShhQ7r5Pwa/TEN/2eezFK71pPHJV.',
  TRUE
)
ON CONFLICT (cedula) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash),
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.cedula = '1124046538' AND r.code = 'admin'
ON CONFLICT DO NOTHING;
