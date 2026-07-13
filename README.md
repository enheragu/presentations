# Presentaciones

Decks de charlas en **HTML autocontenido** (sin build, sin dependencias externas).
Navegación con flechas · `F` para pantalla completa.

**Índice online:** https://enheragu.github.io/presentations/

## Charlas

| Fecha | Congreso | Título | Deck |
|-------|----------|--------|------|
| 9 Jul 2026 | XIX AEMCCO · Almería · **Premio AEMCCO de divulgación y transferencia en metodología** | *Herramientas estadísticas y psicométricas para investigadores en ciencias del comportamiento y en ingeniería* | [`2026_07_09_AEMCCO_ALMERIA/`](2026_07_09_AEMCCO_ALMERIA/) · [online](https://enheragu.github.io/presentations/2026_07_09_AEMCCO_ALMERIA/) |
| 7–9 Jul 2026 | XIX AEMCCO · Almería | *Que no te engañe el azar: cómo impacta la aleatoriedad en el diseño de redes neuronales* | [`2026_07_8_AEMCCO_ALMERIA/`](2026_07_8_AEMCCO_ALMERIA/) · [online](https://enheragu.github.io/presentations/2026_07_8_AEMCCO_ALMERIA/) |

## Estructura de un deck

```
2026_07_8_AEMCCO_ALMERIA/
├── index.html               # motor (lee slides.md + data/presentation.json)
├── slides.md                # contenido de las diapositivas (micro-markdown)
├── widgets.js               # widgets nativos en canvas
├── data/presentation.json   # datos pre-cocinados (sin cómputo en vivo)
├── slides.pdf               # versión descargable (generada, no se edita)
└── assets/                  # logos, imágenes, QR, a11y.css
```

Editar una charla: se toca `slides.md` (y, si hace falta, `widgets.js`). Ver
la cabecera de `slides.md` para la sintaxis de diapositivas y widgets.

## PDF descargable

`build_pdf.py` (compartido, en esta carpeta) genera el `slides.pdf` de cada
deck: una página por slide con las animaciones en su estado final y **texto
seleccionable** (print-to-PDF de Chromium, no screenshots), comprimido con
Ghostscript. El botón «PDF ⤓» del índice enlaza a ese archivo.

```sh
../.venv/bin/python build_pdf.py            # todas las charlas
../.venv/bin/python build_pdf.py 2026_07_8_AEMCCO_ALMERIA   # solo una
```

Tras editar `slides.md` hay que regenerar el PDF (y el standalone) y
commitearlos. Requiere el `.venv` del workspace (playwright + pypdf),
un Chromium del sistema y `gs`.

## Publicación (GitHub Pages)

Sitio estático servido tal cual (`.nojekyll` desactiva Jekyll). Cada carpeta es
una charla accesible por su ruta; la raíz muestra este índice.
