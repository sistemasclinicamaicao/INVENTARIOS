# Listados INVIMA (código único)

Coloque aquí los archivos Excel publicados por INVIMA:

| Archivo sugerido | Tipo (`list_type`) |
|------------------|-------------------|
| `ListadoCodigoUnicoVigentes2022.xlsx` | VIGENTE |
| `ListadoCodigoUnicoVencidos2022.xlsx` | VENCIDO |
| `ListadoCodigoUnicoRenovacion2022.xlsx` | RENOVACION |
| `ListadoCodigounicoOtrosEstado2022.xlsx` | OTRO_ESTADO |

Importación:

```powershell
.\scripts\import-invima-xlsx.ps1
# o un archivo:
.\scripts\import-invima-xlsx.ps1 -File "data\invima\ListadoCodigoUnicoVigentes2022.xlsx" -ListType VIGENTE
```

Ver `docs/INVIMA.md` para columnas y cruce futuro con inventario.
