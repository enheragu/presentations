#!/usr/bin/env python3
"""
Genera slides.pdf de una presentación (motor de olas): una página por slide,
con TEXTO SELECCIONABLE (no screenshots) vía print-to-PDF de Chromium.

Cómo funciona:
  - Sirve la carpeta de la presentación por HTTP local (index.html hace fetch de slides.md).
  - Abre Chromium headless a 1280×720 (tamaño de diseño del escenario) emulando
    prefers-reduced-motion: el motor salta al estado final de profundidad/olas al instante.
  - Avanza slide a slide con ArrowRight, espera a que asienten las animaciones
    one-shot de los widgets (~3 s), congela los widgets (MLVWidgets.deactivate)
    y "imprime" la página con CSS de pantalla (texto vectorial, canvas rasterizado).
  - Estado estable capturado: capturas con tour → imagen .result visible (estado
    final del tour), sin foco/anillo/cursor; HUD y cronómetro ocultos.
  - Une las páginas con pypdf y comprime con Ghostscript (submuestrea las
    imágenes a --dpi y las pasa a JPEG; el texto sigue vectorial/seleccionable;
    a 200 dpi ~20 MB → ~6 MB sin pérdida apreciable) → <presentacion>/slides.pdf

Requisitos: .venv del workspace con playwright + pypdf, un Chromium
(usa /usr/bin/chromium; se puede cambiar con --chromium o $CHROMIUM) y gs.

Run:  ../.venv/bin/python build_pdf.py 2026_07_09_AEMCCO_ALMERIA [más_dirs...]
      (sin argumentos: construye todas las subcarpetas con index.html + slides.md)
"""
import argparse
import io
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = pathlib.Path(__file__).parent

# CSS inyectado solo durante la captura (no toca los archivos de la presentación):
# oculta el HUD/cronómetro/barra de progreso y el chrome del tour, fija el estado
# final del crossfade base→result y desactiva el fundido entre slides.
PDF_CSS = """
.hud, .progress { display: none !important; }
.tool-shot .tour-spot, .tool-shot .tour-ring,
.tool-shot .tour-cursor, .tool-shot .tour-cap { display: none !important; }
.tool-shot img.shot.result { opacity: 1 !important; transition: none !important; }
.deck.ready .slide { transition: none !important; }
"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def find_chromium(cli_path):
    for cand in [cli_path, os.environ.get("CHROMIUM"),
                 "/usr/bin/chromium", shutil.which("chromium"),
                 shutil.which("google-chrome"), shutil.which("chromium-browser")]:
        if cand and pathlib.Path(cand).exists():
            return cand
    return None  # deja que Playwright use su Chromium empaquetado (si está instalado)


def compress(pdf_path, dpi):
    """Submuestrea las imágenes a `dpi` y las recomprime a JPEG (gs). Texto intacto."""
    if not shutil.which("gs"):
        print("[WARN] ghostscript no encontrado; slides.pdf queda sin comprimir")
        return
    raw = pdf_path.stat().st_size
    with tempfile.NamedTemporaryFile(suffix=".pdf", dir=pdf_path.parent, delete=False) as tmp:
        out = pathlib.Path(tmp.name)
    try:
        subprocess.run(
            ["gs", "-q", "-dNOPAUSE", "-dBATCH", "-sDEVICE=pdfwrite",
             "-dCompatibilityLevel=1.5",
             "-dDownsampleColorImages=true", f"-dColorImageResolution={dpi}",
             "-dColorImageDownsampleType=/Bicubic",
             "-dDownsampleGrayImages=true", f"-dGrayImageResolution={dpi}",
             "-dGrayImageDownsampleType=/Bicubic",
             "-dDownsampleMonoImages=true", f"-dMonoImageResolution={dpi}",
             "-dAutoFilterColorImages=false", "-dColorImageFilter=/DCTEncode",
             "-dJPEGQ=85", f"-sOutputFile={out}", str(pdf_path)],
            check=True)
        out.replace(pdf_path)
        print(f"     comprimido {raw / 1024:.0f} KB → {pdf_path.stat().st_size / 1024:.0f} KB ({dpi} dpi)")
    except subprocess.CalledProcessError as e:
        out.unlink(missing_ok=True)
        print(f"[WARN] gs falló ({e.returncode}); slides.pdf queda sin comprimir")


def build_pdf(pres_dir, browser, settle_ms, dpi):
    from pypdf import PdfReader, PdfWriter

    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(pres_dir)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]
    try:
        context = browser.new_context(viewport={"width": 1280, "height": 720},
                                      reduced_motion="reduce", device_scale_factor=1)
        page = context.new_page()
        # media 'screen': el PDF usa los estilos de pantalla, no los de impresión
        page.emulate_media(media="screen", reduced_motion="reduce")
        page.goto(f"http://127.0.0.1:{port}/index.html#1", wait_until="networkidle")
        page.wait_for_selector("#deck.ready", state="attached", timeout=20000)
        page.add_style_tag(content=PDF_CSS)

        n = page.evaluate("document.querySelectorAll('.slide').length")
        writer = PdfWriter()
        for i in range(n):
            if i > 0:
                page.keyboard.press("ArrowRight")
                page.wait_for_function(f"location.hash === '#{i + 1}'")
            page.wait_for_timeout(settle_ms)
            # congela los widgets (para rAF/temporizadores; el canvas conserva su último frame)
            page.evaluate("window.MLVWidgets && document.querySelectorAll('.slide.active')"
                          ".forEach(s => MLVWidgets.deactivate(s))")
            pdf_page = page.pdf(width="1280px", height="720px",
                                print_background=True, page_ranges="1")
            writer.append(PdfReader(io.BytesIO(pdf_page)))
            print(f"\r  [{pres_dir.name}] slide {i + 1}/{n}", end="", flush=True)
        print()

        title = page.evaluate("document.title")
        writer.add_metadata({"/Title": title})
        context.close()

        out = pres_dir / "slides.pdf"
        with open(out, "wb") as f:
            writer.write(f)
        if dpi > 0:
            compress(out, dpi)
        print(f"[OK] {out}  ({out.stat().st_size / 1024:.0f} KB, {n} páginas)")
    finally:
        server.shutdown()


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("dirs", nargs="*", help="carpetas de presentación (por defecto: todas)")
    ap.add_argument("--chromium", help="ruta al ejecutable de Chromium")
    ap.add_argument("--settle-ms", type=int, default=3200,
                    help="espera por slide para que asienten las animaciones (def. 3200)")
    ap.add_argument("--dpi", type=int, default=200,
                    help="resolución de imágenes tras comprimir con gs; 0 = sin comprimir (def. 200)")
    args = ap.parse_args()

    if args.dirs:
        dirs = [pathlib.Path(d).resolve() for d in args.dirs]
    else:
        dirs = sorted(d for d in HERE.iterdir()
                      if (d / "index.html").exists() and (d / "slides.md").exists())
    for d in dirs:
        if not (d / "index.html").exists():
            sys.exit(f"[ABORT] {d} no parece una presentación (falta index.html)")
    if not dirs:
        sys.exit("[ABORT] ninguna presentación encontrada")

    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        exe = find_chromium(args.chromium)
        browser = p.chromium.launch(executable_path=exe, headless=True)
        for d in dirs:
            build_pdf(d, browser, args.settle_ms, args.dpi)
        browser.close()


if __name__ == "__main__":
    main()
