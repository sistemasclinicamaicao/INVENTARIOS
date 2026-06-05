-- Contraseña demo Admin123! (bcrypt cost 10) para login en producción
-- Usuarios: 1234567890 (admin), 9876543210 (bodeguero)

UPDATE users
SET password_hash = '$2b$10$Rq7PEYgN16UhvmOE8jeU9eFhShhQ7r5Pwa/TEN/2eezFK71pPHJV.'
WHERE cedula IN ('1234567890', '9876543210')
  AND (password_hash IS NULL OR password_hash = '');
