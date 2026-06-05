# Plan: Sistema de Gestión de Inventario Clínico (Bodega + Farmacia)

> Documento maestro del proyecto. Última actualización: mayo 2026.  
> Especificación base: [`documentacion inicial.md`](documentacion inicial.md)

## Resumen

Construir desde cero un sistema de gestión de inventario clínico (bodega FIFO + farmacia FEFO) con **Nuxt 3**, **NestJS**, **PostgreSQL**, **Redis** y **Docker**, cubriendo el flujo completo de compras, recepción, almacén, picking, satélites y dispensación con HIS, autenticación 2FA y hardware (escáner/Zebra).

**Stack confirmado:** Nuxt 3 (Vue) + NestJS + PostgreSQL + Redis + Docker.

**UI de referencia:** Mockup React (Panel Principal + Recepción). Portado a Nuxt 3 con Tailwind; iconos **[Flaticon Uicons](https://www.flaticon.com/uicons)** (`UiIcon`, `fi-rr-*`). Ver `frontend/docs/ICONOS.md`.

---

## Tareas (checklist)

- [x] **schema-docker** — Monorepo: esquema PostgreSQL, docker-compose.yml, .env.example, skeleton NestJS + Nuxt 3
- [x] **ui-shell** — Nuxt: shell Clínica ERP (sidebar, header, dashboard, recepción)
- [x] **auth-rbac** — Auth 2FA (cédula/password/OTP), JWT, RBAC seed, worker sync RRHH mock
- [x] **masters** — Productos, import CSV, barcodes API, bodegas/ubicaciones consulta
- [x] **purchases-reception** — OC, proveedores, recepción escaneo, lote/vencimiento, ZPL etiquetas
- [x] **inventory-ops** — Saldos, movimientos, alertas dashboard, inventario cíclico PDA
- [x] **picking-satellite** — Requisiciones CRUD, picking FEFO/FIFO, traslados, recepción satélite PDA
- [x] **pharmacy-his** — Webhook HIS mock, prescripciones, dispensación, controlados bitácora
- [x] **frontend-full** — Módulos Nuxt, layout PDA 360px, composable escáner, auth middleware, API cableada

---

## API implementada (Fase 1)

| Módulo | Rutas principales |
|--------|-------------------|
| Auth | `POST /auth/login`, `verify-otp`, `refresh` (JWT + RBAC) |
| Dashboard | `GET /dashboard/stats`, `/expiry-alerts`, `/requisitions` |
| Masters | `GET/POST /masters/products`, `/import/csv`, `/warehouses`, barcodes |
| Purchases | `GET/POST /purchases/suppliers`, `/orders` |
| Receptions | `GET /receptions/order/:oc`, `/scan/:code`, `POST /confirm` |
| Inventory | `GET /inventory/balances`, `/movements`, `POST /cycle-count` |
| Operations | `GET/POST /operations/requisitions` |
| Picking | `POST /picking/start/:req`, `POST /order/:id/confirm`, `POST /transfers/:n/receive` |
| Pharmacy | `GET /pharmacy/*`, `POST /pharmacy/dispense` |
| Printing | `GET /printing/label/:lineId`, `POST /printing/zpl` |
| Integrations | `POST /integrations/his/prescriptions`, `POST /integrations/hr/sync` |
| Integrations (saliente) | Admin `GET/POST/PATCH/DELETE /integrations/external`, sondeo `GET .../poll/purchase-orders/:number` |

---

## Pantallas Nuxt

| Ruta | Descripción |
|------|-------------|
| `/` | Panel KPIs + alertas FEFO |
| `/login` | 2FA (OTP dev `000000`) |
| `/compras/ordenes`, `/compras/proveedores` | OC y proveedores |
| `/recepcion` | Recepción con escaneo |
| `/picking` | Picking FEFO/FIFO + despacho |
| `/inventario` | Saldos y movimientos |
| `/bodegas` | Satélites + nueva requisición |
| `/farmacia` | Controlados, RX HIS, dispensación |
| `/maestros/*` | Import, productos, bodegas |
| `/pda/*` | Conteo cíclico, recibir traslado (360px) |
| `/configuracion/integraciones` | API keys, probador OC, catálogo/logs; RRHH/HIS (colapsable) |

---

## Criterios de aceptación

### Fase 0 UI

- [x] Sidebar, header, navegación Clínica ERP
- [x] Dashboard: KPIs, alertas, requisiciones
- [x] Recepción: escaneo, lote/vencimiento, confirmar
- [x] Responsive (`hidden md:flex` en sidebar)

### Fase 1 funcional

- [x] Login 2FA completo (Redis OTP + bypass dev)
- [x] Sync usuarios RRHH (mock worker + `POST /integrations/hr/sync`)
- [x] OC → recepción → stock con lote
- [x] Etiqueta ZPL (`GET /printing/label/:id`)
- [x] Picking FEFO/FIFO + traslado + satélite PDA
- [x] Dispensación + webhook HIS mock + controlados
- [x] `docker compose up` (postgres, redis, api, worker, frontend)
- [x] PDA layout `max-w-[360px]`

---

## Arranque rápido

```powershell
.\scripts\detect-ports.ps1   # opcional
docker compose up -d postgres redis
.\scripts\apply-migration-004.ps1
.\iniciar.bat
```

App: `http://localhost:3051` (o `FRONTEND_PORT`) — API proxy `/api/v1`.

Login demo: cédula `1234567890`, password `Admin123!`, OTP `000000`.

---

## Fase 2 — producción (completada)

- [x] JWT guard global + `PermissionsGuard` + `@RequirePermissions`
- [x] Migración `005_rbac_permissions.sql` (roles demo admin / bodeguero)
- [x] `POST /auth/refresh` + permisos en sesión frontend
- [x] Adaptador RRHH (`HR_API_URL` / `HR_USE_MOCK`) + cron worker 6 h
- [x] HIS webhook con `x-his-secret`; pantalla `/configuracion/integraciones`
- [x] Integraciones salientes al ERP: registro URL/auth, sondeo OC — [`docs/INTEGRATIONS_EXTERNAL.md`](docs/INTEGRATIONS_EXTERNAL.md)
- [x] Zebra TCP (`ZEBRA_HOST:ZEBRA_PORT`) + `POST /printing/zpl/send`
- [x] FEFO picking con `FOR UPDATE` en `picking.service`
- [x] Capacitor: `capacitor.config.ts`, `frontend/docs/PDA-CAPACITOR.md`
- [ ] SMTP corporativo (variables en `.env`; OTP dev `000000` en no-producción)
- [ ] APIs RRHH/HIS reales en cliente (adaptadores listos; configurar URLs)

### Referencia INVIMA (tablas de consulta)

- [x] Migración `006_invima_reference.sql` (`invima_import_batches`, `invima_registros`)
- [x] Import Excel (`scripts/import-invima-xlsx.ps1`, `npm run import:invima`)
- [x] API `GET/POST /masters/invima/*` y UI `/maestros/invima`
- [x] Modal alerta medicamento vencido en consulta INVIMA
- [ ] Cruce automático con `products` (pendiente reglas de negocio) — ver [`docs/INVIMA.md`](docs/INVIMA.md)

### OC / registro factura (apoyo bodega)

- [x] Migración `007_po_lines_extended.sql` (precio unitario, lote, vencimiento en líneas OC)
- [x] UI `/compras/ordenes`: búsqueda producto, totales factura, lote/vencimiento si bodega farmacia
- [x] `GET /masters/products/search`
- [x] Recepción: precarga lote y valor unitario desde líneas OC

### Arranque Fase 2

```powershell
.\scripts\apply-migration-004.ps1
.\scripts\apply-migration-005.ps1
.\scripts\apply-migration-006.ps1
.\iniciar.bat
```

Usuarios demo: **admin** `1234567890` / `Admin123!` — **bodeguero** `9876543210` (permisos reducidos).  
Desarrollo sin JWT: `AUTH_DISABLED=true` en `.env` (solo local).

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| APIs RRHH/HIS no documentadas | Mocks + OpenAPI en `/api/docs` |
| FEFO en concurrencia | Validación de lote + mejora FOR UPDATE en Fase 2 |
| PDA heterogéneos | Input teclado + rutas `/pda/*` |
| Zebra desde browser | ZPL en API; impresión manual o servicio local |
