-- Nombres con tildes vía escapes Unicode (independiente de encoding del shell)

UPDATE warehouses SET name = U&'Almac\00E9n General' WHERE code = 'BC-ALM';
UPDATE warehouses SET name = U&'Servicio Farmac\00E9utico' WHERE code = 'BC-FARM';
