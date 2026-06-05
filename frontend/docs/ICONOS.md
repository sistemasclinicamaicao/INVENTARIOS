# Iconos — Flaticon Uicons

El proyecto usa **[Flaticon Uicons](https://www.flaticon.com/uicons)** (fuentes de iconos de [Flaticon](https://www.flaticon.es/icon-fonts-mas-descargados)), estilo **Regular Rounded** (`fi-rr-*`).

## Paquete

```bash
npm install @flaticon/flaticon-uicons
```

CSS cargado en `assets/css/main.css`:

```css
@import '@flaticon/flaticon-uicons/css/regular/rounded.css';
```

## Uso en Vue

```vue
<UiIcon name="home" :size="18" />
<UiIcon name="settings" :size="24" class="text-blue-600" />
```

Los nombres válidos están en `utils/flaticon-icons.ts`. Para añadir uno nuevo:

1. Busque el icono en [Uicons](https://www.flaticon.com/uicons) (nombre en kebab-case, ej. `truck-medical`).
2. Verifique que exista en `node_modules/@flaticon/flaticon-uicons/css/regular/rounded.css` como `fi-rr-truck-medical`.
3. Agréguelo al objeto `FLATICON_ICONS`.

## HTML directo (sin componente)

```html
<i class="fi fi-rr-home"></i>
```

## Otros estilos (opcional)

| Peso   | Esquina  | Clase   |
|--------|----------|---------|
| Regular | Rounded | `fi-rr` |
| Bold    | Rounded | `fi-br` |
| Solid   | Rounded | `fi-sr` |

Import alternativo en CSS:

```css
@import '@flaticon/flaticon-uicons/css/bold/rounded.css';
```

## Atribución

En uso gratuito, atribuya a Flaticon según [sus condiciones](https://support.flaticon.com/s/article/Attribution-How-when-and-where-FI?language=es). Con licencia Premium no es obligatorio.
