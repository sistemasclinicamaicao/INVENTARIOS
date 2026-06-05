# Integraciones API externas (saliente)

El módulo admite dos tipos de integración saliente:

| Tipo (`integration_kind`) | Uso |
|---------------------------|-----|
| `ERP_PURCHASE_ORDER` | Sondeo de órdenes de compra por consecutivo (Crystalos / CXC) |
| `REST_QUERY` | Consulta GET a URL fija; vista previa en tabla (sin mapeo OC) |
| `SOCRATA_OPEN_DATA` | Consulta SoQL a portales Socrata ([datos.gov.co](https://www.datos.gov.co/), etc.) con sincronización opcional a INVIMA |

## Pantalla de administración

**Configuración → Integraciones API externas** (`/configuracion/integraciones`)

| Pestaña | Función |
|---------|---------|
| Registradas | Listado por tipo (ERP / Socrata), probar, editar, desactivar |
| Nueva integración | Formulario según tipo: ERP (ruta OC), REST (URL completa) o Socrata (dataset, SoQL, destino) |
| Vista previa / operaciones | ERP: sondeo OC; REST: tabla JSON; Socrata: preview + sync INVIMA |

## Parámetros de conexión

| Campo | Descripción |
|-------|-------------|
| Nombre | Etiqueta visible para administradores |
| Integración activa | Si está inactiva no se usa en sondeo |
| URL base | Prefijo HTTPS del API (sin `/` final). En dev: `http://localhost:...` |
| Notas internas | Solo documentación; no afecta llamadas |
| Método | `NONE`, `API_KEY`, `BEARER`, `BASIC` |
| Ruta plantilla OC | Default `?consecutivo={number}` (query). Placeholders: `{number}`, `{consecutivo}` |

### Ejemplo Crystalos / CXC

| Campo | Valor |
|-------|--------|
| URL base | `https://py2-apisdi.tjgwxu.easypanel.host/v1/run/cxc` |
| Ruta plantilla | `?consecutivo={number}` |
| Sondeo | `GET …/v1/run/cxc?consecutivo=0100000017` |

**Respuesta esperada:** array JSON de líneas:

```json
[
  {
    "NIT": "17842088",
    "RAZONSOCIAL": "RESTREPO PIEDRAHITA FABIO HERNAN",
    "CODIGO": "EM0043",
    "DESCRIPCION": "UNIVERSAL PVC",
    "CANT_AUTO": 5.0,
    "VLR_UNITARIO": 3879.31,
    "VLR_BRUTO": 19396.55,
    "VALOR_TOTAL": 22500.0,
    "NRO_LOTE": ""
  }
]
```

Se mapea a cabecera (proveedor = NIT/RAZONSOCIAL; bodega = `CODBODEGA` / `NOMBODEGA` / `BODEGA` si vienen en la línea) + líneas (`productCode` = CODIGO, etc.).

La bodega del ERP se **mapea** a bodega principal local (las OC no usan satélites):

| Código ERP / CXC | Bodega local |
|------------------|--------------|
| `02` (o `2`) | Almacén central (`BC-ALM`) |
| `10` | Farmacia central (`BC-FARM`) |

En PostgreSQL, `warehouses.erp_bodega_code` guarda ese vínculo (`02`, `10`).

### Uso en órdenes de compra

En **`/compras/ordenes`**, al buscar por consecutivo en el campo **Orden de Compra (OC)**:

1. Si la OC existe en este sistema, se carga localmente.
2. Si no, se consulta la integración ERP activa (`GET /integrations/external/poll-active/purchase-orders/:number`).
3. Se muestra la tabla con todos los campos CXC y el botón **Importar al formulario** (empareja `CODIGO` con inventario).

Las credenciales se guardan **cifradas** (AES-256-GCM). Nunca se devuelven en listados (`hasSecret: true`).

## API admin (JWT, permiso `admin.users`)

| Método | Ruta |
|--------|------|
| GET | `/integrations/external` |
| POST | `/integrations/external` |
| GET | `/integrations/external/:id` |
| PATCH | `/integrations/external/:id` |
| DELETE | `/integrations/external/:id` |
| POST | `/integrations/external/:id/test-connection` |
| GET | `/integrations/external/:id/poll/purchase-orders/:number` |
| GET | `/integrations/external/:id/rest/preview` |
| GET | `/integrations/external/:id/socrata/preview` |
| POST | `/integrations/external/:id/socrata/sync` |
| POST | `/integrations/external/socrata/sync-invimaf-all` |
| POST | `/integrations/external/socrata/reload-invimaf-all` |

### Sondeo ERP activo (compras)

`GET /integrations/external/poll-active/purchase-orders/:number` — permiso `reception.manage`.

Solo usa integraciones con `integration_kind = ERP_PURCHASE_ORDER` (no elige Socrata por error).

### Respuesta sondeo ERP

```json
{
  "ok": true,
  "httpStatus": 200,
  "durationMs": 85,
  "url": "https://erp.../purchase-orders/OC-2026-1001",
  "mapped": { "number": "OC-2026-1001", "status": "...", "lines": [], "totals": {} },
  "rawPreview": {},
  "source": "erp"
}
```

Si `ERP_USE_MOCK=true` y el ERP no responde, `source: "mock"` con datos de ejemplo.

## Tipo Socrata (datos abiertos)

### Parámetros

| Campo | Descripción |
|-------|-------------|
| `integration_kind` | `SOCRATA_OPEN_DATA` |
| URL base | Ej. `https://www.datos.gov.co` |
| `socrata_dataset_id` | ID del dataset, ej. `i7cb-raxc` (CUM vigentes INVIMA) |
| `socrata_api_version` | `SODA3` (POST) o `SODA2` (GET resource) |
| `socrata_query` | Consulta SoQL completa (copiable desde el portal) |
| `socrata_page_size` | Default 1000 (máximo típico SODA3 por página) |
| Auth | **SODA3 en datos.gov.co:** `API_KEY` + header `X-App-Token` ([App Token](https://dev.socrata.com/docs/queries/)) |
| `sync_target` | `NONE` (solo preview) o `INVIMA_REGISTROS` |
| `invima_list_type` | Obligatorio si destino INVIMA: `VIGENTE`, `VENCIDO`, `RENOVACION`, `OTRO_ESTADO` |

### Endpoints Socrata

- **Preview:** `GET /integrations/external/:id/socrata/preview` — primera página (respeta `LIMIT` en SoQL o añade límite de muestra).
- **Sync:** `POST /integrations/external/:id/socrata/sync` body `{ "replaceExisting": true }` — pagina todo el dataset, mapea filas e importa vía `InvimaService.importParsedRows`. El batch queda como `socrata:i7cb-raxc@YYYY-MM-DD`.

### Ejemplo INVIMA CUM vigentes

| Campo | Valor |
|-------|--------|
| URL | `https://www.datos.gov.co` |
| Dataset | `i7cb-raxc` |
| API | SODA3 |
| Destino | `INVIMA_REGISTROS` + `list_type` = `VIGENTE` |

### Datasets INVIMA en datos.gov.co

| `list_type` | Dataset ID | Endpoint SODA3 |
|-------------|------------|----------------|
| `VIGENTE` | `i7cb-raxc` | `.../views/i7cb-raxc/query.json` |
| `VENCIDO` | `vwwf-4ftk` | `.../views/vwwf-4ftk/query.json` |
| `RENOVACION` | `vgr4-gemg` | `.../views/vgr4-gemg/query.json` |
| `OTRO_ESTADO` | `spzp-dfuc` | `.../views/spzp-dfuc/query.json` |

### Medicamentos POS (Plan Obligatorio de Salud)

| Campo | Valor |
|-------|--------|
| Nombre | `MEDICAMENTOS POS` |
| URL | `https://www.datos.gov.co` |
| Dataset / view | `a7iv-sme8` |
| API | SODA3 → `POST .../api/v3/views/a7iv-sme8/query.json` |
| Destino sync | `NONE` (solo consulta; no importa a `invima_registros`) |
| Auth | `X-App-Token` (mismo App Token datos.gov.co) |

Migración: `.\scripts\apply-migration-025.ps1` inserta la integración si no existe (reutiliza token de otra integración Socrata si hay).

Consulta en maestros: pestaña **Medicamentos POS** en `/maestros/invima`.

`GET /integrations/external/rest/medicamentos-pos?q=&page=1&limit=50&refresh=false` — permiso `reception.manage`. Caché en servidor 2 minutos.

Una integración por fila (mismo App Token en cada una). Plantillas en la UI al crear integración Socrata.

### Sync masivo INVIMA

`POST /integrations/external/socrata/sync-invimaf-all` body `{ "replaceExisting": true }`

`POST /integrations/external/socrata/reload-invimaf-all` — **vacía toda la referencia INVIMA** y luego ejecuta el sync masivo (fuente exclusiva datos.gov.co).

Script CLI: `.\scripts\reload-invima-socrata.ps1`

- Procesa en orden: `VIGENTE` → `VENCIDO` → `RENOVACION` → `OTRO_ESTADO`.
- Solo integraciones activas con `sync_target = INVIMA_REGISTROS` y token guardado.
- Respuesta: `{ ok, totalRowsImported, results: [{ listType, rowsImported, message }] }`.

Botón en UI: **Sincronizar todos los listados INVIMA** (pestaña operaciones).

SoQL de referencia (columnas en minúsculas en la API):

```sql
SELECT expediente, producto, titular, registrosanitario, fechaexpedicion, fechavencimiento, estadoregistro, expedientecum, consecutivocum, cantidadcum, descripcioncomercial, estadocum, fechaactivo, fechainactivo, principioactivo, concentracion, formafarmaceutica, viaadministracion, atc, descripcionatc, ium
```

Los nombres de columna en SoQL deben coincidir con la API (minúsculas, sin guiones bajos). `registro_sanitario` provoca HTTP 400.

### Mapeo columnas API → `invima_registros`

| Columna Socrata (normalizada) | Campo BD |
|------------------------------|----------|
| `expediente` | `expediente` |
| `producto` | `producto` |
| `titular` | `titular` |
| `registrosanitario` | `registro_sanitario` |
| `fechaexpedicion` / `fechavencimiento` | fechas ISO `YYYY-MM-DD` |
| `expedientecum` + `consecutivocum` | `cum_codigo` = `{expediente}-{consecutivo}` |
| `principioactivo`, `concentracion`, … | mismos nombres snake_case |
| Resto de columnas del dataset | `raw_row` (JSONB) |

Columnas no reconocidas no bloquean la importación; el preview muestra los nombres reales devueltos por la API.

### Diferencia con import Excel INVIMA

- **Excel:** `/maestros/invima` — carga manual de archivos `.xlsx`.
- **Socrata sync:** reemplaza (opcional) todos los registros del `list_type` configurado desde datos.gov.co en una sola operación paginada.

## Variables `.env`

```env
INTEGRATION_SECRET_KEY=...   # cifrado credenciales (opcional; usa JWT_SECRET)
ERP_USE_MOCK=true            # solo desarrollo
```

## Migraciones

```powershell
.\scripts\apply-migration-009.ps1   # tabla external_integrations (ERP)
.\scripts\apply-migration-022.ps1   # Socrata: integration_kind, SoQL, sync_target, INVIMA
.\scripts\apply-migration-025.ps1   # Integración MEDICAMENTOS POS (a7iv-sme8)
```

La 009 reemplaza tablas inbound de migración 008 (`integration_api_keys`).

## Formato JSON esperado del ERP

### Crystalos (array de líneas)

Ver tabla anterior. Es el formato principal soportado para sondeo OC.

### Formato estable (alternativo)

```json
{
  "number": "OC-2026-1001",
  "status": "APPROVED",
  "supplier": { "name": "..." },
  "warehouse": { "code": "...", "name": "...", "type": "..." },
  "lines": [{ "productCode", "productName", "qtyOrdered", "unit", "unitPrice", "lineTotal" }]
}
```

También se intenta mapear variantes con `items`, `detalle`, `consecutivo`, `proveedor`, etc.
