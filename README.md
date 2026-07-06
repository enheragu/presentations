# Presentaciones

Decks de charlas en **HTML autocontenido** (sin build, sin dependencias externas).
Navegación con flechas · `F` para pantalla completa.

**Índice online:** https://enheragu.github.io/presentations/

## Charlas

| Fecha | Congreso | Título | Deck |
|-------|----------|--------|------|
| 7–9 Jul 2026 | XIX AEMCCO · Almería | *Que no te engañe el azar: cómo impacta la aleatoriedad en el diseño de redes neuronales* | [`2026_07_8_AEMCCO_ALMERIA/`](2026_07_8_AEMCCO_ALMERIA/) · [online](https://enheragu.github.io/presentations/2026_07_8_AEMCCO_ALMERIA/) |

## Estructura de un deck

```
2026_07_8_AEMCCO_ALMERIA/
├── index.html               # motor (lee slides.md + data/presentation.json)
├── slides.md                # contenido de las diapositivas (micro-markdown)
├── widgets.js               # widgets nativos en canvas
├── data/presentation.json   # datos pre-cocinados (sin cómputo en vivo)
├── assets/                  # logos, imágenes, QR, a11y.css
└── index_standalone.html    # versión offline de un solo archivo (opcional)
```

Editar una charla: se toca `slides.md` (y, si hace falta, `widgets.js`). Ver
la cabecera de `slides.md` para la sintaxis de diapositivas y widgets.

## Publicación (GitHub Pages)

Sitio estático servido tal cual (`.nojekyll` desactiva Jekyll). Cada carpeta es
una charla accesible por su ruta; la raíz muestra este índice.
