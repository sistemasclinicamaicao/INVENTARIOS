# Referencia INVIMA — código único (CUM)

Listados oficiales del INVIMA cargados como **tablas de referencia** en PostgreSQL. No hay cruce automático con `products` hasta definir reglas de negocio.

## Archivos fuente

| Archivo / fuente | `list_type` |
|------------------|-------------|
| `ListadoCodigoUnicoVigentes2022.xlsx` o datos.gov.co `i7cb-raxc` | `VIGENTE` |
| `ListadoCodigoUnicoVencidos2022.xlsx` o datos.gov.co `vwwf-4ftk` | `VENCIDO` |
| `ListadoCodigoUnicoRenovacion2022.xlsx` o datos.gov.co `vgr4-gemg` | `RENOVACION` |
| `ListadoCodigounicoOtrosEstado2022.xlsx` o datos.gov.co `spzp-dfuc` | `OTRO_ESTADO` |

Ubicación Excel: `data/invima/`. API: **Configuración → Integraciones** (Socrata) o sync masivo `POST .../socrata/sync-invimaf-all`.

## Esquema (migración 006)

- **`invima_import_batches`**: metadatos de cada carga (tipo, archivo, fecha del listado, filas, hash SHA-256).
- **`invima_registros`**: una fila por presentación CUM en el Excel.

### Columnas normalizadas

| Campo DB | Origen Excel (aprox.) |
|----------|----------------------|
| `expediente` | EXPEDIENTE |
| `producto` | PRODUCTO |
| `titular` | TITULAR |
| `registro_sanitario` | REGISTRO SANITARIO |
| `fecha_expedicion` / `fecha_vencimiento` | FECHA EXPEDICIÓN / VENCIMIENTO |
| `estado_registro` | ESTADO REGISTRO |
| `expediente_cum`, `consecutivo_cum`, `cantidad_cum` | EXPEDIENTE CUM, CONSECUTIVO, CANTIDAD CUM |
| `cum_codigo` | Calculado: `{expediente_cum}-{consecutivo_cum}` |
| `descripcion_comercial` | DESCRIPCIÓN COMERCIAL |
| `estado_cum`, `fecha_activo`, `fecha_inactivo` | ESTADO / FECHAS CUM |
| `principio_activo`, `concentracion`, `forma_farmaceutica`, `via_administracion` | Campos farmacéuticos |
| `atc`, `descripcion_atc`, `ium` | ATC, descripción ATC, IUM |
| `raw_row` | JSONB con el resto de columnas del Excel |

Índices: `cum_codigo`, `registro_sanitario`, `expediente`, `list_type`, `fecha_vencimiento`, trigram en `producto`.

## Importación

**Fuente operativa:** integraciones Socrata en Configuración → Integraciones, o:

```powershell
.\scripts\reload-invima-socrata.ps1
```

Vacía `invima_registros` y recarga los 4 listados (vigentes, vencidos, renovación, otros) desde datos.gov.co.

### Excel (legado, no usar en operación normal)

```powershell
.\scripts\import-invima-xlsx.ps1
```

## API

| Método | Ruta | Permiso |
|--------|------|---------|
| `GET` | `/api/v1/masters/invima/search?q=&cum=&listType=&page=&limit=` | `reception.manage` |
| `GET` | `/api/v1/masters/invima/batches` | `reception.manage` |
| `POST` | `/api/v1/masters/invima/import` | `admin.users` |
| `POST` | `/api/v1/masters/invima/import-all` | `admin.users` |

UI: **Maestros → Referencia INVIMA** (`/maestros/invima`).

## Alerta de medicamento vencido

Tras cada búsqueda, si algún resultado de la página está vencido, se muestra un **modal** “Medicamento vencido”.

Criterios (`isExpired` en API y `useInvimaExpired` en frontend):

- Listado `VENCIDO`, o
- `estado_registro` contiene “vencido”, o
- `fecha_vencimiento` anterior a la fecha actual.

Las filas vencidas se resaltan en rojo en la tabla.

## Parser

- Detecta la fila de encabezados buscando columnas `EXPEDIENTE` y `PRODUCTO`.
- Ignora filas de título/fecha anteriores.
- Fechas `MM/DD/YYYY` → ISO `YYYY-MM-DD`.
- Reemplazo por `list_type`: al importar de nuevo un mismo tipo se borran registros y batches previos de ese tipo (histórico entre tipos se conserva).

## Cruce futuro con inventario (no implementado)

Cuando se definan reglas, opciones documentadas:

1. Tabla `product_invima_links (product_id, invima_registro_id, match_method, confidence)`.
2. Campos en `products` (`cum_codigo`, `registro_sanitario`, etc.).

Reglas propuestas a acordar:

- Matching por **CUM** activo en listado `VIGENTE`.
- Alertas si el producto enlaza a registro `VENCIDO` o en `RENOVACION`.
- Bloqueo o advertencia en recepción/dispensación según política.
- Sincronización periódica: nueva carga por `list_type` sin mezclar tipos.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Volumen alto | Inserción por lotes de 400 filas; script offline |
| Varias presentaciones por medicamento | Granularidad `cum_codigo` + `descripcion_comercial` |
| Listados desactualizados (ej. 2022) | Nuevas cargas vía `import_batches`; reemplazo por tipo |
