# cash-diagrams

Catálogo de diagramas de solución animados. **Cada diagrama existe en dos formatos**:

- **SVG** autocontenido (sin JS ni dependencias; se pega inline en cualquier web).
- **JSX** interactivo (React + framer-motion), generado desde el mismo `spec.json`.

El índice (`site/index.template.html`) los enlaza todos. Los ejemplos base (`request-flow`) se conservan como referencia.

## Estructura

```
diagrams/<slug>/spec.json    # fuente única: nodos, aristas y guion de la animación
diagrams/<slug>/svg/         # SVG y snippet generados
diagrams/request-flow/       # ejemplo base: JSX original + SVG + comparativa (meta.json)
src/svg/gen.mjs              # generador spec -> SVG
src/jsx/                     # player JSX genérico (lee spec.json)
src/build.mjs                # genera todo en _site/ (SVG, snippets, JSX, índice)
.github/workflows/pages.yml  # despliegue en GitHub Pages
```

## Añadir un diagrama

1. Crea `diagrams/<slug>/spec.json` (copia el de `kyo-trx`).
2. `cd src/jsx && npm ci && npm run build` (una vez) y `node src/build.mjs`.
3. Abre `_site/index.html` (por ejemplo con `python3 -m http.server -d _site`).

## Incrustar un SVG

Pega el contenido de `<slug>.snippet.html` en tu HTML. Atributos del `<svg>`:

| Atributo | Valores |
|---|---|
| `data-theme` | `light` (por defecto), `dark`, `auto` (sigue al sistema) |
| `data-bg` | `transparent` quita el papel y la rejilla |

Respeta `prefers-reduced-motion`.
