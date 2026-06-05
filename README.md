# Clínica ERP — Logística & Farmacia

Sistema de gestión de inventario clínico (bodega FIFO + farmacia FEFO).

## Stack

- **Frontend:** Nuxt 3 + Vue 3 + Tailwind CSS + Pinia + [Flaticon Uicons](https://www.flaticon.com/uicons)
- **Backend:** NestJS + TypeORM + PostgreSQL + Redis
- **Infra:** Docker Compose

## Puertos (evitar conflictos con otras apps)

En tu equipo se detectaron ocupados, entre otros: **5432**, **5433**, **6379** (Docker/WSL), **3030** (Node), **8080** (WAMP).

Este proyecto usa un **bloque dedicado** (ajustable en `.env`):

| Servicio | Puerto por defecto | Alternativas si está ocupado |
|----------|-------------------|------------------------------|
| API NestJS | **3050** | 3052, 3060, 3000 |
| Frontend Nuxt | **3010** | 3051, 3020, 3040 |
| PostgreSQL (Docker) | **5434** | 5435, 5440 |
| Redis (Docker) | **6380** | 6381, 6390 |

**Detectar puertos libres y generar `.env`:**

```powershell
.\scripts\detect-ports.ps1
```

O doble clic en [`detectar-puertos.bat`](detectar-puertos.bat).

`iniciar.bat` ejecuta la detección automáticamente si no existe `.env`.

Forzar nuevo escaneo: `.\scripts\start-dev.ps1 -DetectPorts`

---

## Inicio automático (un solo clic)

**Doble clic** en [`iniciar.bat`](iniciar.bat) en la raíz del proyecto.

O desde PowerShell:

```powershell
.\scripts\start-dev.ps1
```

Opciones:

```powershell
.\scripts\start-dev.ps1 -SinDocker       # API + frontend (BD ya corriendo)
.\scripts\start-dev.ps1 -SinFrontend    # solo Docker + API
.\scripts\start-dev.ps1 -DetectPorts    # regenerar .env con puertos libres
```

Detener: [`detener.bat`](detener.bat) o `.\scripts\stop-dev.ps1`

---

## Inicio rápido (desarrollo local)

### 1. Variables de entorno

```bash
copy .env.example .env
```

### 2. Base de datos y Redis (Docker)

```powershell
docker compose up postgres redis -d
```

> **Puerto 5432 ocupado** (WAMP u otro PostgreSQL): el proyecto usa **5433** por defecto.  
> Conéctese con `localhost:5433`. Si prefiere 5432, detenga el otro servicio o cambie `POSTGRES_PORT` en `.env`.

El esquema SQL se aplica automáticamente al crear el contenedor PostgreSQL (solo la primera vez).

### 3. Backend

```bash
cd backend
npm install
set DATABASE_URL=postgresql://clinica:clinica_secret@localhost:5434/clinica_erp
set REDIS_URL=redis://localhost:6380
set PORT=3050
set REDIS_URL=redis://localhost:6379
set JWT_SECRET=dev_secret_change_me
set NODE_ENV=development
npm run start:dev
```

API: http://localhost:3000/api/v1  
Swagger: http://localhost:3000/api/docs

### 4. Frontend

```bash
cd frontend
npm install
set NUXT_PUBLIC_API_BASE=http://localhost:3000/api/v1
npm run dev
```

App: **http://localhost:3051** (`FRONTEND_PORT`). API Nest solo en **3050**; el navegador usa proxy `/api/v1`. No abra `:3050` para la UI. Verifique con `.\scripts\verificar-puertos.ps1`.

### 5. Todo con Docker

```bash
docker compose up --build
```

## Datos reales de la clínica (no demostración)

Lo que ve en pantalla debe venir **de su operación**, no del archivo de ejemplo `002_seed`.

### 1. Borrar datos de demostración

```powershell
.\limpiar-demo.bat
```

(o `.\scripts\clear-demo-data.ps1`)

### 2. Cargar su información

- **CSV:** edite las plantillas en [`data/plantillas/`](data/plantillas/) (separador `;`, UTF-8) y impórtelas en **Maestros → Importar** (`/maestros/importar`).
- **Manual:** **Maestros → Productos** para alta uno a uno.
- **Bodegas:** ya están definidas en el sistema (`BC-FARM`, `BC-ALM`, `SAT-URG`, etc.); puede ajustar nombres en BD si hace falta.

### 3. Operación diaria

Cree órdenes de compra y requisiciones desde los módulos (o importe más adelante); el panel reflejará solo lo que exista en PostgreSQL.

| Pantalla | Endpoints |
|----------|-----------|
| Panel | `GET /dashboard/stats`, `/expiry-alerts`, `/requisitions` |
| Header | `GET /users/header` (nombre, rol, notificaciones) |
| Recepción | `GET /receptions/order/:oc`, `/scan/:code`, `POST /receptions/confirm` |

---

## Login demo

| Campo | Valor |
|-------|-------|
| Cédula | `1234567890` |
| Contraseña | `Admin123!` |
| OTP (sin SMTP) | Ver consola del API `[DEV OTP]` o usar `000000` |

## Migraciones

```powershell
.\scripts\apply-migration-004.ps1   # proveedores
.\scripts\apply-migration-005.ps1   # RBAC Fase 2
.\scripts\apply-migration-006.ps1   # referencia INVIMA (CUM)
.\scripts\apply-migration-007.ps1   # líneas OC: precio, lote, vencimiento
.\scripts\apply-migration-009.ps1   # integraciones salientes al ERP principal
```

### Listados INVIMA (referencia, sin cruce con inventario)

Coloque los 4 Excel en `data/invima/` y ejecute:

```powershell
.\scripts\import-invima-xlsx.ps1
```

Consulta en la app: `/maestros/invima`. Detalle: [`docs/INVIMA.md`](docs/INVIMA.md).

Usuario **bodeguero** (permisos reducidos): cédula `9876543210`, misma contraseña demo `Admin123!`, OTP `000000`.

## Pantallas disponibles (Fase 1 — ver [`PLAN.md`](PLAN.md))

- `/` — Panel principal
- `/login` — 2FA
- `/compras/ordenes`, `/compras/proveedores` — OC y proveedores
- `/recepcion` — Recepción + ZPL
- `/picking` — Picking FEFO/FIFO y despacho
- `/inventario` — Saldos y movimientos
- `/bodegas` — Satélites y requisiciones
- `/farmacia` — Controlados, HIS, dispensación
- `/maestros/*` — Import CSV, productos, bodegas, referencia INVIMA
- `/pda/*` — Modo móvil (conteo, traslados)
- `/configuracion/integraciones` — Conexión ERP principal, sondeo OC, RRHH/HIS

## Iconos (Flaticon)

Fuente: [Uicons / icon fonts Flaticon](https://www.flaticon.es/icon-fonts-mas-descargados). Uso: `<UiIcon name="home" :size="18" />`. Guía: [`frontend/docs/ICONOS.md`](frontend/docs/ICONOS.md).

## Documentación

- [`PLAN.md`](PLAN.md) — Plan maestro de implementación
- [`docs/INVIMA.md`](docs/INVIMA.md) — Listados código único INVIMA
- [`docs/INTEGRATIONS_EXTERNAL.md`](docs/INTEGRATIONS_EXTERNAL.md) — Integraciones salientes al ERP principal
- [`documentacion inicial.md`](documentacion inicial.md) — Especificación funcional

## Estructura

```
├── backend/          # NestJS API + worker
├── frontend/         # Nuxt 3 UI
├── docker-compose.yml
└── PLAN.md
```
