/* ============================================================
   Widgets nativos de la presentación AEMCCO.
   - Autocontenidos, sin dependencias, sin cómputo en vivo.
   - Leen data/presentation.json (pre-horneado) una sola vez.
   - Se recolorean con las variables --ink/--acc/--acc2 del motor de
     profundidad (cambian de tono al sumergirse).
   API:  MLVWidgets.load()  ·  mountAll(root)  ·  activate(slide)  ·  deactivate(slide)
   Mount en slides.md:  <div class="widget" data-widget="TIPO" ...></div>
     tipos: axis2d · hist-overlap · hist-static · pswap
   ============================================================ */
(function () {
  "use strict";
  const NS = (window.MLVWidgets = { data: null });

  // ---- CSS propio ----
  const style = document.createElement('style');
  style.textContent = `
    .widget{ width:1100px; margin:.3em auto 0; }
    .widget canvas{ width:100%; display:block; }
    /* panel translúcido bajo los widgets de datos: los separa de las olas */
    .w-hist, .w-static, .w-pswap, .w-heatmap, .w-tree, .w-axis{
      background: var(--panel-bg, rgba(10,24,38,.66)); border:1px solid var(--panel-bd, rgba(150,190,220,.22));
      border-radius:14px; padding:16px 18px 12px; backdrop-filter: blur(1.5px);
      box-shadow:0 14px 40px rgba(0,0,0,.26);
    }
    .w-heatmap canvas{ height:404px; }
    .w-tree canvas{ height:302px; }
    .w-tree .w-verdict, .w-tree .w-tally{ text-align:center; }
    .w-gag{ text-align:center; }
    .gag-media{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) scale(.96);
      width:720px; height:auto; opacity:0; transition:opacity .45s ease, transform .45s ease;
      border-radius:14px; box-shadow:0 24px 70px rgba(0,0,0,.55); pointer-events:none; }
    .gag-media.on{ opacity:1; transform:translate(-50%,-50%) scale(1); }
    .w-hist canvas, .w-static canvas{ height:398px; }
    .w-pswap canvas{ height:266px; }
    .w-axis canvas{ height:418px; }
    .w-verdict{ margin-top:.7em; font-size:1.35rem; min-height:1.6em; }
    .w-chip{ display:inline-block; padding:.18em .9em; border-radius:999px; font-weight:700; color:#fff; transition:background .25s; }
    .w-tally{ margin-top:.45em; font-size:1.08rem; opacity:.9; font-variant-numeric:tabular-nums; }
    .w-legend{ display:flex; flex-wrap:wrap; gap:1.1em; justify-content:center; margin-top:.55em; font-size:.98rem; opacity:.92; }
    .w-legend .sw{ display:inline-block; width:.85em; height:.85em; border-radius:3px; margin-right:.4em; vertical-align:middle; }
    .w-err{ color:#d9738a; font-size:.95rem; padding:1em; }
  `;
  document.head.appendChild(style);

  // ---- helpers de color (leen las variables del deck en vivo) ----
  const cssVar = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb);
  const rgba = (n, a, fb) => `rgba(${cssVar(n, fb)},${a})`;
  // Colores de DATOS fijos y seguros para daltonismo (Okabe-Ito): teal / naranja / verde.
  // Fijos (no siguen la profundidad) → legibilidad constante sobre paneles oscuros.
  const colA = a => `rgba(45,140,180,${a})`;    // teal
  const colB = a => `rgba(230,159,0,${a})`;     // naranja
  const colC = a => `rgba(0,158,115,${a})`;     // verde azulado
  const colD = a => `rgba(204,121,167,${a})`;   // púrpura rojizo (Okabe-Ito) — 3ª serie de histograma, distinta del teal
  const inkC = a => rgba('--ink', a, '20,53,67');   // texto de widget: sigue la profundidad (oscuro en panel claro, claro en oscuro)
  const PAL = [colA, colB, colD];               // hist-static: teal / naranja / púrpura (colC=verde queda para el árbol)
  // colormap secuencial para el heatmap (frío = mejor, cálido = peor)
  // cividis: perceptualmente uniforme y seguro para daltonismo (azul oscuro = mejor → amarillo = peor)
  const CMAP = [[0,34,78],[45,86,120],[124,123,120],[190,178,110],[255,233,69]];
  function cmapRGB(t){ const n=CMAP.length-1, s=Math.max(0,Math.min(1,t))*n, i=Math.min(n-1,Math.floor(s)), f=s-i, a=CMAP[i], b=CMAP[i+1];
    return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f, a[2]+(b[2]-a[2])*f]; }
  const cmap  = t => `rgb(${cmapRGB(t).map(Math.round).join(',')})`;
  const cmapA = (t,a) => `rgba(${cmapRGB(t).map(Math.round).join(',')},${a})`;

  const PRETTY = { bourginmlp:'BourginMLP', psychforest:'PsychForest', beast_gb:'BEAST-GB',
    sparsemlp:'SparseMLP', contextdepnet:'ContextDepNet', linearlogistic:'LinearLogistic',
    mlp_1l:'MLP-1L', mlp_3l:'MLP-3L' };
  const pretty = k => PRETTY[k] || k;
  const pairTitle = key => key.split('_vs_').map(pretty).join('  vs  ');

  // ---- canvas / dibujo ----
  function fit(cv) {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  }
  function binify(vals, lo, hi, bins) {
    const w = (hi - lo) / bins, h = new Array(bins).fill(0);
    for (const v of vals) { const k = Math.floor((v - lo) / w); if (k < 0 || k >= bins) continue; h[k]++; }   // descarta la cola (sin barra-espiga)
    const mx = Math.max(...h) || 1; return h.map(c => c / mx);
  }
  function quantile(sorted, q) {
    const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }
  function drawHist(ctx, vals, lo, hi, bins, P, colFn, alpha) {
    const h = binify(vals, lo, hi, bins), bw = P.w / bins;
    ctx.beginPath(); ctx.moveTo(P.x, P.y + P.h);
    for (let i = 0; i < bins; i++) { const x = P.x + i * bw, y = P.y + P.h * (1 - h[i]); ctx.lineTo(x, y); ctx.lineTo(x + bw, y); }
    ctx.lineTo(P.x + P.w, P.y + P.h); ctx.closePath();
    ctx.fillStyle = colFn(alpha * 0.42); ctx.fill();
    ctx.strokeStyle = colFn(0.95); ctx.lineWidth = 2; ctx.stroke();
  }
  function axisX(ctx, lo, hi, P, label) {
    ctx.strokeStyle = inkC(.35); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(P.x, P.y + P.h); ctx.lineTo(P.x + P.w, P.y + P.h); ctx.stroke();
    ctx.fillStyle = inkC(.75); ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center';
    for (let t = 0; t <= 4; t++) {
      const v = lo + (hi - lo) * t / 4, x = P.x + P.w * t / 4;
      ctx.fillText(v.toFixed(2), x, P.y + P.h + 16);
    }
    ctx.fillStyle = inkC(.6); ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('mejor ←    ' + (label || 'MSE×100') + '    → peor', P.x + P.w / 2, P.y + P.h + 34);
  }

  // ============================================================ Widget base
  class W {
    constructor(el) { this.el = el; this.raf = 0; this.t0 = 0; try { this.build(); } catch (e) { el.innerHTML = '<div class="w-err">widget error: ' + e.message + '</div>'; console.error(e); } }
    start() { if (!this.raf) { this.t0 = performance.now(); this.onStart && this.onStart(); const loop = () => { this.render(); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); } }
    stop() { if (this.raf) cancelAnimationFrame(this.raf), this.raf = 0; if (this.timer) clearInterval(this.timer), this.timer = 0; }
    build() {} render() {}
  }

  // ============================================================ axis2d (auto-anima al entrar en el slide)
  class Axis2D extends W {
    build() {
      this.el.classList.add('w-axis');
      this.N = parseInt(this.el.dataset.n || '8', 10);
      // 'line'  = recta 1D estática (centrada), para explicar la primera fuente de azar.
      // 'plane' = arranca como esa MISMA recta centrada, baja y se despliega en matriz (2ª fuente).
      this.mode = this.el.dataset.mode === 'line' ? 'line' : 'plane';
      this.cv = document.createElement('canvas'); this.el.appendChild(this.cv);
    }
    // geometría compartida por ambos modos → la recta cae SIEMPRE en el mismo sitio y no hay salto al pasar de slide
    _geom(w, h) {
      const m = 54, L = Math.min(w - 2 * m, h - 2 * m), ox = (w - L) / 2;
      return { m, L, ox, dx: L / (this.N - 1), R: Math.max(3, L / this.N * 0.22),
        yTop: (h - L) / 2 - 6, yCenter: h / 2, yBottom: (h + L) / 2 - 6 };
    }
    _row(ctx, ox, dx, R, y, col, alpha) {
      ctx.globalAlpha = alpha;
      for (let i = 0; i < this.N; i++) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ox + i * dx, y, R, 0, 6.283); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    render() {
      const { ctx, w, h } = fit(this.cv); ctx.clearRect(0, 0, w, h);
      const g = this._geom(w, h);
      ctx.font = '600 15px system-ui, sans-serif'; ctx.textAlign = 'center';

      if (this.mode === 'line') {
        // recta 1D centrada verticalmente (misma Y que el arranque del modo plano) → continuidad
        const oy = g.yCenter;
        ctx.strokeStyle = inkC(.5); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(g.ox, oy); ctx.lineTo(g.ox + g.L, oy); ctx.stroke();
        this._row(ctx, g.ox, g.dx, g.R, oy, colA(1), 1);
        ctx.fillStyle = inkC(.9); ctx.fillText('seed inicialización', g.ox + g.L / 2, oy + 34);
        return;
      }

      // modo plano: la recta arranca CENTRADA (idéntica al slide anterior), baja al borde inferior
      // y crecen las filas hacia arriba formando la matriz. Una vez, sin bucle.
      const T = Math.min(1, (performance.now() - this.t0) / 2600);
      const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
      const pDrop = ease(T / 0.42);           // la recta baja: yCenter → yBottom
      const pOpen = ease((T - 0.34) / 0.66);  // se despliegan las filas de arriba
      const oy = g.yCenter + (g.yBottom - g.yCenter) * pDrop;
      const dy = g.L / (this.N - 1);

      if (pOpen > 0) { ctx.strokeStyle = colB(.55); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g.ox, oy); ctx.lineTo(g.ox, oy - g.L * pOpen); ctx.stroke(); }
      ctx.strokeStyle = inkC(.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g.ox, oy); ctx.lineTo(g.ox + g.L, oy); ctx.stroke();
      const rows = pOpen > 0 ? this.N : 1;
      for (let j = 0; j < rows; j++) {
        this._row(ctx, g.ox, g.dx, g.R, oy - j * dy * pOpen, j === 0 ? colA(1) : colA(.4 + .5 * pOpen), j === 0 ? 1 : pOpen);
      }
      ctx.fillStyle = inkC(.9); ctx.fillText('seed inicialización', g.ox + g.L / 2, oy + 34);
      if (pOpen > .3) { ctx.save(); ctx.translate(g.ox - 30, oy - g.L / 2); ctx.rotate(-Math.PI / 2); ctx.fillStyle = colB(.9); ctx.textAlign = 'center'; ctx.fillText('seed orden', 0, 0); ctx.restore(); }
    }
  }

  // ============================================================ hist-overlap (auto-animado)
  class HistOverlap extends W {
    build() {
      this.el.classList.add('w-hist');
      const d = NS.data; if (!d) throw new Error('sin datos');
      const pair = (this.el.dataset.pair ? this.el.dataset.pair.split(',') : d.overlap_pair).map(s => s.trim());
      this.A = d.models[pair[0]]; this.B = d.models[pair[1]]; this.names = pair;
      if (!this.A || !this.B) throw new Error('modelos no encontrados: ' + pair.join(','));
      this.order = d.draw_order || [];
      const all = this.A.mse_x100.concat(this.B.mse_x100).sort((a, b) => a - b);
      this.lo = all[0]; this.hi = quantile(all, 0.94);   // recorta la cola de outliers para que las campanas se vean
      this.cv = document.createElement('canvas'); this.el.appendChild(this.cv);
      // leyenda con el tamaño de muestra por modelo (mismo formato en #9 y #10 → transición limpia)
      const nA = this.A.mse_x100.length, nB = this.B.mse_x100.length;
      const lg = document.createElement('div'); lg.className = 'w-legend';
      lg.innerHTML = `<span><span class="sw" style="background:${colA(.9)}"></span>${pretty2(this.names[0])} <span style="opacity:.6">(n=${nA})</span></span>`
        + `<span><span class="sw" style="background:${colB(.9)}"></span>${pretty2(this.names[1])} <span style="opacity:.6">(n=${nB})</span></span>`;
      this.el.append(lg);
      this.k = 0; this.vA = this.A.mean; this.vB = this.B.mean;
    }
    onStart() {
      this.k = 0;
      clearInterval(this.timer);
      this.timer = setInterval(() => this.step(), 560);
      this.step();
    }
    step() {                                          // solo mueve los marcadores (semilla a semilla); sin texto debajo
      if (!this.order.length) return;
      const idx = this.order[this.k % this.order.length];
      this.vA = this.A.mse_x100[idx % this.A.mse_x100.length];
      this.vB = this.B.mse_x100[idx % this.B.mse_x100.length];
      this.k++;
    }
    render() {
      const { ctx, w, h } = fit(this.cv); ctx.clearRect(0, 0, w, h);
      const P = { x: 46, y: 14, w: w - 60, h: h - 54 };
      drawHist(ctx, this.A.mse_x100, this.lo, this.hi, 42, P, colA, .28);
      drawHist(ctx, this.B.mse_x100, this.lo, this.hi, 42, P, colB, .28);
      axisX(ctx, this.lo, this.hi, P);
      this._marker(ctx, this.vA, P, colA); this._marker(ctx, this.vB, P, colB);
    }
    _marker(ctx, v, P, col) {
      const x = P.x + P.w * Math.max(0, Math.min(1, (v - this.lo) / (this.hi - this.lo)));   // clamp al borde si cae en la cola
      ctx.strokeStyle = col(1); ctx.lineWidth = 2.2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x, P.y); ctx.lineTo(x, P.y + P.h); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col(1); ctx.beginPath(); ctx.arc(x, P.y + 9, 5.5, 0, 6.283); ctx.fill();
    }
  }

  // ============================================================ hist-static
  class HistStatic extends W {
    build() {
      this.el.classList.add('w-static');
      const d = NS.data; if (!d) throw new Error('sin datos');
      this.names = (this.el.dataset.models || d.overlap_pair.join(',')).split(',').map(s => s.trim());
      this.M = this.names.map(n => d.models[n]).filter(Boolean);
      if (!this.M.length) throw new Error('modelos no encontrados');
      const all = [].concat(...this.M.map(m => m.mse_x100)).sort((a, b) => a - b);
      this.lo = all[0]; this.hi = quantile(all, 0.94);   // recorta la cola de outliers para que las campanas se vean
      this.cv = document.createElement('canvas'); this.el.appendChild(this.cv);
      const lg = document.createElement('div'); lg.className = 'w-legend';
      lg.innerHTML = this.names.map((n, i) => this.M[i]
        ? `<span><span class="sw" style="background:${PAL[i % 3](.9)}"></span>${pretty2(n)} <span style="opacity:.65">skew ${this.M[i].skew >= 0 ? '+' : ''}${this.M[i].skew}</span></span>` : '').join('');
      this.el.appendChild(lg);
    }
    render() {
      const { ctx, w, h } = fit(this.cv); ctx.clearRect(0, 0, w, h);
      const P = { x: 46, y: 14, w: w - 60, h: h - 54 };
      this.M.forEach((m, i) => drawHist(ctx, m.mse_x100, this.lo, this.hi, 46, P, PAL[i % 3], .26));
      axisX(ctx, this.lo, this.hi, P);
    }
  }

  // ============================================================ pswap (P(swap) vs N)
  class PSwap extends W {
    build() {
      this.el.classList.add('w-pswap');
      const d = NS.data; if (!d) throw new Error('sin datos');
      const key = this.el.dataset.pair || Object.keys(d.switch_prob)[0];
      this.S = d.switch_prob[key]; this.key = key;
      if (!this.S) throw new Error('par no encontrado: ' + key);
      this.cv = document.createElement('canvas'); this.el.appendChild(this.cv);
      const lg = document.createElement('div'); lg.className = 'w-legend';
      lg.innerHTML = `<span><span class="sw" style="background:${colA(.9)}"></span>Bootstrap (empírico)</span>`
        + `<span><span class="sw" style="background:${colB(.9)}"></span>Monte Carlo (normal)</span>`;
      this.el.appendChild(lg);
    }
    render() {
      const { ctx, w, h } = fit(this.cv); ctx.clearRect(0, 0, w, h);
      const P = { x: 52, y: 30, w: w - 74, h: h - 66 };
      const N = this.S.N, xn = i => P.x + P.w * (N.length > 1 ? i / (N.length - 1) : .5), yv = v => P.y + P.h * (1 - v);
      // ejes
      ctx.strokeStyle = inkC(.35); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x, P.y + P.h); ctx.lineTo(P.x + P.w, P.y + P.h); ctx.stroke();
      ctx.fillStyle = inkC(.7); ctx.font = '12px system-ui'; ctx.textAlign = 'right';
      [0, .5, 1].forEach(g => { ctx.fillText(g.toFixed(1), P.x - 6, yv(g) + 4); ctx.strokeStyle = inkC(.12); ctx.beginPath(); ctx.moveTo(P.x, yv(g)); ctx.lineTo(P.x + P.w, yv(g)); ctx.stroke(); });
      ctx.textAlign = 'center';
      N.forEach((n, i) => ctx.fillText('N=' + n, xn(i), P.y + P.h + 18));
      const prog = Math.min(1, (performance.now() - this.t0) / 900);
      const line = (arr, col, dash) => {
        ctx.strokeStyle = col(.95); ctx.lineWidth = 2.6; ctx.setLineDash(dash);
        ctx.beginPath();
        const last = Math.max(1, Math.floor(arr.length * prog));
        for (let i = 0; i < last; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, xn(i), yv(arr[i]));
        ctx.stroke(); ctx.setLineDash([]);
        for (let i = 0; i < last; i++) { ctx.fillStyle = col(1); ctx.beginPath(); ctx.arc(xn(i), yv(arr[i]), 4, 0, 6.283); ctx.fill(); }
      };
      line(this.S.bootstrap, colA, []); line(this.S.montecarlo, colB, [6, 4]);
      ctx.fillStyle = inkC(.92); ctx.font = '700 15px system-ui'; ctx.textAlign = 'left';
      ctx.fillText('P(confundir el orden) — ' + pairTitle(this.key), P.x, 18);
    }
  }

  // ============================================================ heatmap (rejilla 35x35 init×orden)
  class Heatmap extends W {
    build() {
      this.el.classList.add('w-heatmap');
      const d = NS.data; if (!d || !d.grids) throw new Error('sin rejillas');
      const list = (this.el.dataset.models || this.el.dataset.model || Object.keys(d.grids).join(','))
        .split(',').map(s => s.trim()).filter(Boolean);
      this.G = list.map(m => ({ name: m, g: d.grids[m] })).filter(x => x.g);
      if (!this.G.length) throw new Error('rejillas no encontradas');
      this.G.forEach(x => { const f = x.g.z.flat().filter(v => v === v).sort((a, b) => a - b); x.lo = f[0]; x.hi = quantile(f, 0.98); });
      this.cv = document.createElement('canvas'); this.el.appendChild(this.cv);
      const lg = document.createElement('div'); lg.className = 'w-legend';
      lg.innerHTML = `<span>peor</span>`
        + `<span style="display:inline-block;width:150px;height:.8em;border-radius:3px;background:linear-gradient(90deg,${cmap(0)},${cmap(.35)},${cmap(.7)},${cmap(1)})"></span>`
        + `<span>mejor · MSE×100 · cada modelo a su escala · fila=init, col=orden</span>`;
      this.el.appendChild(lg);
    }
    render() {
      const { ctx, w, h } = fit(this.cv); ctx.clearRect(0, 0, w, h);
      const n = this.G.length, cols = n, rows = 1;   // una sola fila
      const gx = 34, gy = 32, labelH = 22;
      const cellW = (w - gx * (cols - 1)) / cols, cellH = (h - gy * (rows - 1)) / rows;
      const prog = Math.min(1, (performance.now() - this.t0) / 900);
      this.G.forEach((x, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const bx = c * (cellW + gx), by = r * (cellH + gy);
        const S = Math.min(cellW, cellH - labelH);
        const ox = bx + (cellW - S) / 2, oy = by + (cellH - labelH - S) / 2;
        const ni = x.g.n_init, nj = x.g.n_order, cw = S / nj, ch = S / ni;
        for (let a = 0; a < ni; a++) for (let b = 0; b < nj; b++) {
          const v = x.g.z[a][b]; if (v !== v) continue;
          const t = (v - x.lo) / (x.hi - x.lo);
          // invertido: MSE bajo (mejor) → amarillo brillante · MSE alto (peor) → azul oscuro (resalta lo bueno)
          ctx.fillStyle = cmapA(1 - t, prog * 0.95); ctx.fillRect(ox + b * cw, oy + a * ch, cw + 0.6, ch + 0.6);
        }
        ctx.fillStyle = inkC(.92); ctx.font = '600 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(pretty2(x.name), bx + cellW / 2, oy + S + 6);
      });
    }
  }

  // pretty para nombres CamelCase de modelos (los de models{}); si no, tal cual
  function pretty2(n) { return PRETTY[n.toLowerCase()] || n; }

  // filtra/ordena una lista de modelos según data-models (case-insensitive); sin atributo → todos.
  function pickModels(el, all) {
    const req = el && el.dataset && el.dataset.models;
    if (!req) return all.slice();
    const low = {}; all.forEach(m => { low[String(m).toLowerCase()] = m; });
    return req.split(',').map(s => low[s.trim().toLowerCase()]).filter(Boolean);
  }

  // ============================================================ ablation-tree (árbol de decisión CICLANTE al estilo mlv-tools)
  //  Réplica del árbol de mlv-tools con un ARRANQUE FIJO (variable=valor): fija B →
  //  paso 1 barre L (3 nodos) → paso 2 barre B en la L ganadora (3 nodos). Hay 3
  //  arranques (B=16/32/64) que CICLAN en bucle: al cambiar de arranque los porcentajes
  //  de cada nodo se interpolan (tween) en su sitio y la ruta óptima (verde) se
  //  actualiza. Layout fijo (posiciones estables) para que anime en el mismo lugar.
  //  Lee reach_tree.by_start (baked por el export): step1[L]{mc,bs,best} · step2[B]{mc,bs,best}.
  class AblationTree extends W {
    build() {
      this.el.classList.add('w-tree', 'w-treeflow');           // panel translúcido + estilo de flujo
      const d = NS.data; if (!d || !d.ablation_tree) throw new Error('sin ablation_tree');
      const key = this.el.dataset.case || Object.keys(d.ablation_tree)[0];
      this.c = d.ablation_tree[key];
      if (!this.c) throw new Error('caso no encontrado: ' + key);
      const rt = this.c.reach_tree;
      if (!rt || !rt.by_start || !rt.by_start.length) throw new Error('sin reach_tree.by_start (re-exporta presentation.json)');
      this.starts = rt.by_start;                               // 3 arranques (fija B=16/32/64)
      this.colF = this.c.factors.col;                          // L (paso 1)
      this.rowF = this.c.factors.row;                          // B (paso 2)
      this.nL = this.starts[0].step1.length;
      this.nB = this.starts[0].step2.length;
      this.SLOT = 2000; this.TWEEN = 520;                      // cada arranque ~2.0 s · tween ~0.52 s (ciclado algo más rápido)
      this._tierDelay = [140, 520, 900];                       // revelado inicial raíz → L → B
      this._buildTree();                                       // árbol fijo + enlaces SVG

      // ---- leyenda mínima + indicador de ciclo ----
      const lg = document.createElement('div'); lg.className = 'w-legend';
      lg.innerHTML =
        `<span>MC = Monte&nbsp;Carlo</span>` +
        `<span>Boot = Bootstrap</span>` +
        `<span><span class="sw" style="background:${colC(.92)}"></span>ruta óptima</span>` +
        `<span class="tree-cycle-note">ciclando arranques</span>`;
      this.el.appendChild(lg);
      const dots = document.createElement('div'); dots.className = 'tree-dots';
      this.dots = this.starts.map(s => {
        const dv = document.createElement('span'); dv.className = 'tree-dot'; dv.title = s.start_label;
        dots.appendChild(dv); return dv;
      });
      this.el.appendChild(dots);
    }

    // ---- LAYOUT FIJO: raíz (ARRANQUE, cicla) arriba → fila de 3 L (paso 1) → fila de 3 B (paso 2).
    //      Nodos en posiciones estables (grid de 3 col) para animar los % en su sitio. Tarjetas
    //      .tree-node (estilo .decision-node) + enlaces SVG en codo vertical. ----
    _buildTree() {
      const s0 = this.starts[0];
      const flow = document.createElement('div'); flow.className = 'tree-flow';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'tree-links');
      flow.appendChild(svg);
      this.nodes = [];

      // fila de ARRANQUES: las 3 opciones (B=16/32/64) visibles a la vez en una rejilla de
      // 3 col; la activa se resalta en verde y CICLA. El árbol de abajo se redibuja para ella.
      const startRow = document.createElement('div'); startRow.className = 'tree-row tree-row--starts';
      flow.appendChild(startRow);
      this.startCards = this.starts.map(s => this._startCard(startRow, s.start_label));

      // fila L (paso 1): nL nodos en columnas fijas — se redibujan para el arranque activo
      const lRow = document.createElement('div'); lRow.className = 'tree-row tree-row--l';
      flow.appendChild(lRow);
      this.lNodes = s0.step1.map(n1 => this._card(lRow, 1, n1.label, n1.mc, n1.bs));

      // fila B (paso 2): 9 nodos = 3 B bajo CADA L (rejilla de 9 col alineada con las 3 L).
      // Cada hoja = P(una búsqueda voraz desde el arranque termine en esa config (L,B)).
      const bRow = document.createElement('div'); bRow.className = 'tree-row tree-row--b';
      flow.appendChild(bRow);
      this.bNodes = [];
      for (let c = 0; c < this.nL; c++)
        for (let r = 0; r < this.nB; r++) {
          const lf = (s0.leaf && s0.leaf[c] && s0.leaf[c][r]) || { mc: null, bs: null };
          this.bNodes.push(this._card(bRow, 2, s0.step2[r].label, lf.mc, lf.bs));
        }

      this.el.appendChild(flow);
      this.flow = flow; this.svg = svg;
    }
    // tarjeta de ARRANQUE (fila superior): rótulo "arranque" + B fijo. Tier 0 (revelado primero).
    _startCard(parent, label) {
      const el = document.createElement('div');
      el.className = 'tree-node tree-node--start';
      el.innerHTML = '<div class="tree-node-tag">arranque</div><div class="tree-node-head">' + label + '</div>';
      parent.appendChild(el);
      const rec = { el: el, tier: 0, head: el.querySelector('.tree-node-head') };
      this.nodes.push(rec);
      return rec;
    }
    // tarjeta boxy estilo mlv-tools .decision-node: cabecera + dos P (MC · Boot). Devuelve
    // refs a los elementos mutables (cabecera + <b> de cada %) para tween en su sitio.
    _card(parent, tier, head, mc, bs) {
      const pct = v => (v == null || isNaN(v)) ? '·' : Math.round(v * 100) + '%';
      const el = document.createElement('div');
      el.className = 'tree-node tree-node--t' + tier;
      let html = '<div class="tree-node-head">' + head + '</div>';
      if (mc != null || bs != null) {
        html += '<div class="tree-node-probs">MC <b class="v-mc">' + pct(mc) + '</b>' +
          '<span class="dot">·</span>Boot <b class="v-bs">' + pct(bs) + '</b></div>';
      }
      el.innerHTML = html;
      parent.appendChild(el);
      const rec = { el: el, tier: tier, head: el.querySelector('.tree-node-head'),
        mc: el.querySelector('.v-mc'), bs: el.querySelector('.v-bs') };
      this.nodes.push(rec);
      return rec;
    }
    // enlace en codo redondeado VERTICAL (baja · gira · horizontal · gira · baja) → path SVG
    _elbow(x1, y1, x2, y2) {
      const f = n => n.toFixed(2);
      if (Math.abs(x2 - x1) < 0.5) return 'M ' + f(x1) + ' ' + f(y1) + ' V ' + f(y2);
      const r = Math.max(2, Math.min(9, Math.abs(y2 - y1) / 2, Math.abs(x2 - x1) / 2));
      const ym = (y1 + y2) / 2, dx = x2 > x1 ? 1 : -1;
      return 'M ' + f(x1) + ' ' + f(y1) +
        ' V ' + f(ym - r) +
        ' Q ' + f(x1) + ' ' + f(ym) + ' ' + f(x1 + dx * r) + ' ' + f(ym) +
        ' H ' + f(x2 - dx * r) +
        ' Q ' + f(x2) + ' ' + f(ym) + ' ' + f(x2) + ' ' + f(ym + r) +
        ' V ' + f(y2);
    }

    // al entrar: reinicia el revelado y el ciclo para que la animación vuelva a empezar
    onStart() {
      for (let i = 0; i < this.nodes.length; i++) {
        this.nodes[i].el.classList.remove('is-on', 'tree-node--best', 'tree-node--active');
      }
      if (this.svg) this.svg.innerHTML = '';
    }

    render() {
      const S = this.starts, nS = S.length, dt = performance.now() - this.t0;
      const slot = Math.floor(dt / this.SLOT), within = dt - slot * this.SLOT;
      const idx = ((slot % nS) + nS) % nS;
      const prevIdx = slot === 0 ? idx : (((slot - 1) % nS) + nS) % nS;
      const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
      const p = ease(within / this.TWEEN);                     // 0→1 tween del arranque actual
      const A = S[prevIdx], B = S[idx];
      const curIdx = (p >= 0.5) ? idx : prevIdx;               // arranque vigente (cambia al cruzar el medio)
      const cur = S[curIdx];                                   // estado discreto (verde/etiqueta)
      const lerp = (a, b) => a + (b - a) * p;
      const pctTxt = v => Math.round(v * 100) + '%';

      // revelado inicial por niveles (una vez): arranques → L → B
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        if (dt >= this._tierDelay[n.tier] && !n.el.classList.contains('is-on')) n.el.classList.add('is-on');
      }

      // fila de ARRANQUES: resalta el activo (verde), atenúa los otros dos
      for (let i = 0; i < this.startCards.length; i++)
        this.startCards[i].el.classList.toggle('tree-node--active', i === curIdx);

      // paso 1 (L): interpola % en su sitio + verde al ganador del arranque activo
      for (let l = 0; l < this.nL; l++) {
        const nd = this.lNodes[l];
        nd.mc.textContent = pctTxt(lerp(A.step1[l].mc, B.step1[l].mc));
        nd.bs.textContent = pctTxt(lerp(A.step1[l].bs, B.step1[l].bs));
        nd.el.classList.toggle('tree-node--best', !!cur.step1[l].best);
      }
      // paso 2 (9 hojas: 3 B bajo cada L): interpola leaf[c][r] en su sitio.
      // verde SOLO en la hoja óptima (winL, winB) del arranque vigente.
      for (let c = 0; c < this.nL; c++)
        for (let r = 0; r < this.nB; r++) {
          const nd = this.bNodes[c * this.nB + r];
          nd.mc.textContent = pctTxt(lerp(A.leaf[c][r].mc, B.leaf[c][r].mc));
          nd.bs.textContent = pctTxt(lerp(A.leaf[c][r].bs, B.leaf[c][r].bs));
          nd.el.classList.toggle('tree-node--best', c === cur.win_col && r === cur.win_row);
        }
      // puntos de ciclo
      for (let i = 0; i < this.dots.length; i++) this.dots[i].classList.toggle('on', i === curIdx);

      // enlaces SVG (codos): ARRANQUE activo → 3 L · L ganadora → 3 B. Verde = ruta óptima.
      const winL = cur.win_col;
      const flow = this.flow, svg = this.svg, fr = flow.getBoundingClientRect();
      if (fr.width < 2) return;
      const W = Math.round(fr.width), H = Math.round(fr.height);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      const aB = el => { const r = el.getBoundingClientRect(); return { x: r.left - fr.left + r.width / 2, y: r.bottom - fr.top }; };
      const aT = el => { const r = el.getBoundingClientRect(); return { x: r.left - fr.left + r.width / 2, y: r.top - fr.top }; };
      const op1 = Math.max(0, Math.min(1, (dt - this._tierDelay[1]) / 300));
      const op2 = Math.max(0, Math.min(1, (dt - this._tierDelay[2]) / 300));
      let out = '';
      if (op1 > 0) {
        const s = aB(this.startCards[curIdx].el);              // sale del arranque ACTIVO
        for (let l = 0; l < this.nL; l++) {
          const t = aT(this.lNodes[l].el), best = (l === winL);
          out += '<path class="' + (best ? 'tl-best' : 'tl-short') + '" style="opacity:' + op1.toFixed(2) + '" d="' + this._elbow(s.x, s.y, t.x, t.y) + '"/>';
        }
      }
      if (op2 > 0) {
        for (let c = 0; c < this.nL; c++) {
          const s = aB(this.lNodes[c].el);
          for (let r = 0; r < this.nB; r++) {
            const t = aT(this.bNodes[c * this.nB + r].el);
            const best = (c === winL && r === cur.win_row);
            out += '<path class="' + (best ? 'tl-best' : 'tl-short') + '" style="opacity:' + op2.toFixed(2) + '" d="' + this._elbow(s.x, s.y, t.x, t.y) + '"/>';
          }
        }
      }
      svg.innerHTML = out;
    }
  }

  // ============================================================ gag-reveal (imagen base + gif/vídeo temporizado encima)
  class GagReveal extends W {
    build() {
      this.el.classList.add('w-gag');
      const base = this.el.dataset.base, src = this.el.dataset.gif || '';
      this.delay = +(this.el.dataset.delay || 5000);
      this.dur = +(this.el.dataset.dur || 3500);
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;display:inline-block;max-width:100%';
      this.img = document.createElement('img'); this.img.className = 'slide-img'; this.img.alt = ''; this.img.src = base;
      this.isVideo = /\.(mp4|webm)$/i.test(src);
      this.g = document.createElement(this.isVideo ? 'video' : 'img');
      if (this.isVideo) { this.g.muted = true; this.g.loop = true; this.g.setAttribute('playsinline', ''); }
      this.g.className = 'gag-media'; this.g.alt = '';
      this.gOk = false;
      this.g.addEventListener(this.isVideo ? 'loadeddata' : 'load', () => this.gOk = true);
      this.g.addEventListener('error', () => this.gOk = false);
      if (src) this.g.src = src;
      wrap.append(this.img, this.g); this.el.appendChild(wrap);
    }
    start() {                                   // sin canvas/rAF: solo temporizadores
      if (this._on) return; this._on = true;
      clearTimeout(this.t1); clearTimeout(this.t2); this.hideGag();
      this.t1 = setTimeout(() => { if (this.gOk) this.showGag(); }, this.delay);
      this.t2 = setTimeout(() => this.hideGag(), this.delay + this.dur);
    }
    stop() { this._on = false; clearTimeout(this.t1); clearTimeout(this.t2); this.hideGag(); }
    showGag() { this.g.classList.add('on'); if (this.isVideo) { try { this.g.currentTime = 0; this.g.play(); } catch (e) {} } }
    hideGag() { this.g.classList.remove('on'); if (this.isVideo) { try { this.g.pause(); } catch (e) {} } }
  }

  // ============================================================ baldominos (banda de una red vs. review publicada · MNIST)
  class Baldominos extends W {
    build() {
      this.el.classList.add('w-hist');
      const d = NS.data; if (!d || !d.baldominos) throw new Error('sin datos baldominos');
      const b = d.baldominos; this.b = b;
      this.hib = b.higher_is_better !== false;
      this.model = b.model;
      // valor reportado por los autores de la arquitectura (SimpleNet 99.75 % para CNN_14L).
      // Trazable: scripts/export_presentation_data.py build_baldominos() + src/models/CNN_14L.py.
      const R = this.model.reported;
      this.reported = (R && typeof R.value === 'number') ? R.value : null;
      this.repLabel = (R && R.label) || 'reportado';
      this.pub = (b.published || []).filter(p => typeof p.value === 'number');
      if (!this.model || !this.pub.length) throw new Error('baldominos incompleto');
      this.unit = b.unit || '%';

      // rango del eje X: cubre modelo + publicados con un pequeño margen
      const vals = this.pub.map(p => p.value).concat(this.model.band);
      if (this.reported != null) vals.push(this.reported);
      const vlo = Math.min(...vals), vhi = Math.max(...vals), pad = (vhi - vlo) * 0.06 || 0.05;
      this.lo = vlo - pad; this.hi = vhi + pad;

      // histograma del modelo: de las semillas si están horneadas; si no, derivado
      // (determinista) de la normal ajustada → siempre hay una campana que mostrar.
      this.bins = 34;
      this.hist = this._modelHist();          // alturas [0..1], bin más alto = 1

      this.cv = document.createElement('canvas'); this.el.appendChild(this.cv);

      // leyenda simple con los conteos (sin banner): en el rango del modelo vs. otros
      const inb = b.overlap_count != null ? b.overlap_count : this.pub.filter(p => p.in_band).length;
      const tot = b.n_published != null ? b.n_published : this.pub.length;
      const out = Math.max(0, tot - inb);
      const nm = pretty2(this.model.name);
      const lg = document.createElement('div'); lg.className = 'w-legend';
      lg.innerHTML =
        `<span><span class="sw" style="background:${colB(.95)}"></span>rango ${nm} (${inb})</span>` +
        `<span><span class="sw" style="background:${inkC(.4)}"></span>otros (${out})</span>` +
        (this.reported != null ? `<span><span class="sw" style="background:#d1495b"></span>${this.repLabel} ${this.reported}%</span>` : '');
      this.el.append(lg);
    }

    // normal PDF ajustada (sólo mean/std, sin RNG)
    _pdf(x) { const s = this.model.std, m = this.model.mean; return Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)); }

    // alturas del histograma normalizadas a [0..1] (bin más alto = 1)
    _modelHist() {
      const seeds = this.model.seeds;
      if (Array.isArray(seeds) && seeds.length) return binify(seeds, this.lo, this.hi, this.bins);  // binify normaliza al máx. y descarta la cola
      // sin semillas → histograma derivado de la normal ajustada (determinista)
      const bw = (this.hi - this.lo) / this.bins, h = new Array(this.bins);
      for (let i = 0; i < this.bins; i++) h[i] = this._pdf(this.lo + (i + 0.5) * bw);
      const mx = Math.max(...h) || 1; return h.map(v => v / mx);
    }

    onStart() { this.t0 = performance.now(); }

    render() {
      const { ctx, w, h } = fit(this.cv); ctx.clearRect(0, 0, w, h);
      const b = this.b, m = this.model;
      const P = { x: 40, y: 20, w: w - 56, h: h - 60 }, baseY = P.y + P.h;
      const xv = v => P.x + P.w * (v - this.lo) / (this.hi - this.lo);
      const topFrac = 0.86;                              // deja aire sobre el pico de la campana

      const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
      const elapsed = performance.now() - this.t0;
      const grow = ease(elapsed / 1150);                 // sube histograma+campana desde la base
      const lit = ease((elapsed - 700) / 1200);          // la banda crece desde la media y enciende las reglas

      // ---- banda de la red (crece desde la media) — contexto tenue detrás ----
      const bLo = m.mean - (m.mean - m.band[0]) * lit, bHi = m.mean + (m.band[1] - m.mean) * lit;
      const xa = xv(bLo), xb = xv(bHi);
      ctx.fillStyle = colA(.10); ctx.fillRect(xa, P.y, xb - xa, P.h);

      // ---- histograma del modelo (teal translúcido) ----
      const bw = P.w / this.bins;
      ctx.beginPath(); ctx.moveTo(P.x, baseY);
      for (let i = 0; i < this.bins; i++) { const x = P.x + i * bw, y = baseY - this.hist[i] * P.h * topFrac * grow; ctx.lineTo(x, y); ctx.lineTo(x + bw, y); }
      ctx.lineTo(P.x + P.w, baseY); ctx.closePath();
      ctx.fillStyle = colA(.30); ctx.fill();
      ctx.strokeStyle = colA(.62); ctx.lineWidth = 1.2; ctx.stroke();

      // ---- campana normal ajustada (teal discontinua) ----
      const pk = this._pdf(m.mean), topY = baseY - P.h * topFrac * grow;
      ctx.strokeStyle = colA(.95); ctx.lineWidth = 2.2; ctx.setLineDash([6, 4]); ctx.beginPath();
      const steps = 140;
      for (let i = 0; i <= steps; i++) { const x = this.lo + (this.hi - this.lo) * i / steps, y = baseY - (this._pdf(x) / pk) * P.h * topFrac * grow; (i ? ctx.lineTo : ctx.moveTo).call(ctx, xv(x), y); }
      ctx.stroke(); ctx.setLineDash([]);

      // línea de la media (sólida, hasta el pico de la campana)
      const xm = xv(m.mean);
      ctx.strokeStyle = colA(1); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xm, topY); ctx.lineTo(xm, baseY); ctx.stroke();

      // ---- reglas verticales: resultados publicados (encima, finas) ----
      const pts = this.pub.map(p => ({ x: xv(p.value), inBand: !!p.in_band })).filter(p => p.x >= P.x - 1 && p.x <= P.x + P.w + 1);
      let shown = 0;
      // fuera de banda → regla gris de ALTURA COMPLETA (como las naranjas, pero tenue):
      // son contexto, y al ser semitransparentes la densidad se acumula donde varios
      // modelos publicados casi coinciden (17 se apiñan en 99.67–99.79, 8 en 99.05–99.16).
      ctx.setLineDash([]); ctx.lineWidth = 1.1; ctx.strokeStyle = inkC(.28);
      for (const p of pts) { if (p.inBand) continue; ctx.beginPath(); ctx.moveTo(p.x, P.y); ctx.lineTo(p.x, baseY); ctx.stroke(); }
      ctx.setLineDash([]);
      // dentro de banda → regla naranja de altura completa; se enciende cuando la banda la alcanza
      for (const p of pts) {
        if (!p.inBand) continue;
        const covered = p.x >= xa && p.x <= xb; if (covered) shown++;
        ctx.strokeStyle = covered ? colB(.9) : colB(.22); ctx.lineWidth = covered ? 1.5 : 1.1;
        ctx.beginPath(); ctx.moveTo(p.x, P.y); ctx.lineTo(p.x, baseY); ctx.stroke();
      }

      // ---- valor REPORTADO por los autores (línea rosa; trazable: build_baldominos + CNN_14L.py) ----
      if (this.reported != null) {
        const xr = xv(this.reported);
        ctx.save(); ctx.globalAlpha = lit;
        ctx.strokeStyle = '#d1495b'; ctx.lineWidth = 2.4; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(xr, P.y); ctx.lineTo(xr, baseY); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#d1495b'; ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(this.reported + '% ', xr - 3, P.y + 9);
        ctx.restore();
      }
      // ---- eje X ----
      ctx.strokeStyle = inkC(.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.x, baseY); ctx.lineTo(P.x + P.w, baseY); ctx.stroke();
      ctx.fillStyle = inkC(.75); ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center';
      for (let t = 0; t <= 4; t++) { const v = this.lo + (this.hi - this.lo) * t / 4; ctx.fillText(v.toFixed(2), P.x + P.w * t / 4, baseY + 16); }
      ctx.fillStyle = inkC(.6);
      const lbl = (b.metric || 'precisión') + ' (' + this.unit + ')';
      ctx.fillText(this.hib ? 'peor ←    ' + lbl + '    → mejor' : 'mejor ←    ' + lbl + '    → peor', P.x + P.w / 2, baseY + 34);

      // (banner "50 de 75" retirado: los conteos ya van en la leyenda)
    }
  }

  const REG = { 'axis2d': Axis2D, 'hist-overlap': HistOverlap, 'hist-static': HistStatic, 'pswap': PSwap, 'heatmap': Heatmap, 'ablation-tree': AblationTree, 'gag-reveal': GagReveal, 'baldominos': Baldominos };

  // ============================================================ hist-prob
  //  Histograma de solape (BourginMLP vs SparseMLP) + tabla de P(confundir el orden).
  //  Fase 1 (0–2.5 s): el histograma ocupa TODO el ancho.
  //  Fase 2 (>2.5 s): el histograma se encoge/desliza a la izquierda (~58%) y
  //                   una TABLA HTML aparece con fundido a la derecha (~38%).
  //  Sólo usa NS.data (models[].mse_x100, models[].mean, switch_prob[key]) y los
  //  helpers ya presentes en widgets.js: fit, drawHist, axisX, quantile, colA/colB,
  //  inkC, pretty2. Ningún global/lib nuevo.
  //
  //  Mount en slides.md (sustituye al pswap del slide 11):
  //    <div class="widget" data-widget="hist-prob"
  //         data-models="BourginMLP,SparseMLP" data-pair="bourginmlp_vs_sparsemlp"></div>
  //  (data-pair es opcional: si falta, se deriva de los modelos en minúsculas.)

  // CSS propio: se añade al <style> del deck ya creado arriba en el IIFE.
  style.textContent += `
    .w-histprob .hp-stage{ position:relative; }
    .w-histprob .hp-table{
      position:absolute; top:50%; right:0;
      width:min(38%,340px);
      transform:translateY(-50%) translateX(14px);
      opacity:0; pointer-events:none;
      transition:opacity .6s ease, transform .6s cubic-bezier(.22,.61,.36,1);
    }
    .w-histprob .hp-table.on{ opacity:1; transform:translateY(-50%) translateX(0); }
    .w-histprob table{
      width:100%; border-collapse:collapse; table-layout:fixed;
      font-variant-numeric:tabular-nums;
      font-size:.98rem;
      color:rgba(var(--ink,20,53,67),.92);
    }
    .w-histprob caption{
      caption-side:top; text-align:left; font-weight:700;
      font-size:1.02rem;
      color:rgba(var(--ink,20,53,67),.95); margin-bottom:.5em; line-height:1.25;
    }
    .w-histprob th, .w-histprob td{ padding:.34em .45em; text-align:center; }
    .w-histprob thead th{
      font-weight:700; border-bottom:1.5px solid rgba(var(--ink,20,53,67),.30);
      padding-bottom:.42em;
    }
    .w-histprob tbody tr + tr td{ border-top:1px solid rgba(var(--ink,20,53,67),.12); }
    .w-histprob .hp-n{ text-align:left; font-weight:600; color:rgba(var(--ink,20,53,67),.72); }
    .w-histprob thead .hp-n{ color:rgba(var(--ink,20,53,67),.55); font-weight:600; }
    .w-histprob .hp-boot{ color:rgba(45,140,180,1); }    /* teal  = colA (Bootstrap)   */
    .w-histprob .hp-mc{   color:rgba(230,159,0,1); }      /* naranja = colB (Monte Carlo) */
    .w-histprob tbody .hp-boot, .w-histprob tbody .hp-mc{ font-weight:600; }
  `;

  // CSS del árbol de ablación CICLANTE: réplica del árbol de decisión de mlv-tools
  //  (.decision-node boxy + enlaces SVG en codo). Layout FIJO en 3 filas: ARRANQUE (cicla) ·
  //  3 nodos L (paso 1) · 3 nodos B (paso 2). Posiciones estables → los % animan en su sitio.
  style.textContent += `
    /* 3 FILAS en rejilla de 3 col alineada: ARRANQUES (3 opciones, activa resaltada) → 3 L →
       3 B. min-height + space-between → el árbol RELLENA la altura del panel (sin hueco muerto). */
    .w-treeflow .tree-flow{ position:relative; display:flex; flex-direction:column; justify-content:space-between;
      gap:30px; min-height:392px; padding:16px 8px 12px; }
    .w-treeflow .tree-links{ position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:0; overflow:visible; }
    .w-treeflow .tree-links path{ fill:none; stroke-linecap:round; stroke-linejoin:round; transition:opacity .25s linear; }
    .w-treeflow .tree-links .tl-best{ stroke:rgba(0,158,115,.92); stroke-width:2.8; }
    .w-treeflow .tree-links .tl-short{ stroke:rgba(var(--ink,20,53,67),.30); stroke-width:1.5; }
    .w-treeflow .tree-row{ position:relative; z-index:1; display:grid; grid-template-columns:repeat(3,1fr); gap:22px; align-items:center; }
    /* fila de 9 hojas (3 B bajo cada L): rejilla de 9 col + nodos compactos */
    .w-treeflow .tree-row--b{ grid-template-columns:repeat(9,1fr); gap:6px; }
    .w-treeflow .tree-row--b .tree-node{ min-width:0; padding:.34rem .26rem; }
    .w-treeflow .tree-row--b .tree-node-head{ font-size:12.5px; }
    .w-treeflow .tree-row--b .tree-node-probs{ font-size:9.5px; margin-top:2px; }
    .w-treeflow .tree-row--b .tree-node-probs .dot{ margin:0 .2em; }
    .w-treeflow .tree-row .tree-node{ justify-self:center; }
    /* tarjeta boxy — copia de .decision-node de mlv-tools (radio ~10px, borde/fondo sutil) */
    .w-treeflow .tree-node{ border:1.4px solid rgba(var(--ink,20,53,67),.26); border-radius:10px;
      padding:.5rem .95rem; background:rgba(var(--ink,20,53,67),.06); text-align:center; max-width:100%; min-width:116px;
      opacity:0; transform:translateY(6px);
      transition:opacity .4s ease, transform .4s ease, border-color .4s ease, background .4s ease, box-shadow .4s ease; }
    .w-treeflow .tree-node.is-on{ opacity:1; transform:none; }
    /* fila de ARRANQUES: tarjetas mayores; la activa verde con glow, las otras dos atenuadas */
    .w-treeflow .tree-node--start{ padding:.5rem 1.3rem; min-width:134px; }
    .w-treeflow .tree-node--start.is-on{ opacity:.5; }
    .w-treeflow .tree-node--start.tree-node--active.is-on{ opacity:1; }
    .w-treeflow .tree-node--start.tree-node--active{ border-color:rgba(0,158,115,.72);
      background:rgba(0,158,115,.16); box-shadow:0 0 0 1px rgba(0,158,115,.3) inset, 0 0 22px rgba(0,158,115,.28); }
    .w-treeflow .tree-node-tag{ font:600 9.5px system-ui,sans-serif; letter-spacing:.16em; text-transform:uppercase;
      color:rgba(var(--ink,20,53,67),.5); margin-bottom:2px; }
    .w-treeflow .tree-node--start.tree-node--active .tree-node-tag{ color:rgba(0,158,115,.92); }
    /* verde = ruta óptima (copia de .decision-node--best) */
    .w-treeflow .tree-node--best{ border-color:rgba(0,158,115,.6); background:rgba(0,158,115,.15);
      box-shadow:0 0 0 1px rgba(0,158,115,.26) inset; }
    .w-treeflow .tree-node-head{ font:700 15px system-ui,sans-serif; line-height:1.15;
      color:rgba(var(--ink,20,53,67),.96); white-space:nowrap; }
    .w-treeflow .tree-node--start .tree-node-head{ font-size:17px; }
    .w-treeflow .tree-node-probs{ margin-top:3px; font:600 11.5px system-ui,sans-serif; line-height:1.2;
      color:rgba(var(--ink,20,53,67),.62); font-variant-numeric:tabular-nums; white-space:nowrap; }
    .w-treeflow .tree-node-probs b{ font-weight:700; color:rgba(var(--ink,20,53,67),.9); }
    .w-treeflow .tree-node-probs .dot{ margin:0 .34em; opacity:.5; }
    .w-treeflow .tree-node--best .tree-node-probs{ color:rgba(0,158,115,.85); }
    .w-treeflow .tree-node--best .tree-node-probs b{ color:rgba(0,158,115,1); }
    /* indicador de ciclo: 3 puntos, el activo relleno en verde */
    .w-treeflow .tree-cycle-note{ opacity:.72; font-style:italic; }
    .w-treeflow .tree-dots{ display:flex; justify-content:center; gap:.55em; margin-top:.5em; }
    .w-treeflow .tree-dot{ width:.62em; height:.62em; border-radius:50%;
      background:rgba(var(--ink,20,53,67),.22); transition:background .3s ease, transform .3s ease; }
    .w-treeflow .tree-dot.on{ background:rgba(0,158,115,.9); transform:scale(1.2); }
  `;

  class HistProb extends W {
    build() {
      this.el.classList.add('w-hist', 'w-histprob');       // reutiliza el panel translúcido de .w-hist
      const d = NS.data; if (!d) throw new Error('sin datos');
      // Modelos del histograma (por defecto el par de la historia: BourginMLP vs SparseMLP).
      this.names = (this.el.dataset.models || 'BourginMLP,SparseMLP').split(',').map(s => s.trim());
      this.A = d.models[this.names[0]]; this.B = d.models[this.names[1]];
      if (!this.A || !this.B) throw new Error('modelos no encontrados: ' + this.names.join(','));
      // Tabla de probabilidad: clave explícita o derivada de los modelos en minúsculas.
      const key = this.el.dataset.pair || this.names.map(n => n.toLowerCase()).join('_vs_');
      this.S = d.switch_prob[key] || d.switch_prob[Object.keys(d.switch_prob)[0]];
      if (!this.S) throw new Error('par de switch_prob no encontrado: ' + key);
      // Rango del histograma: recorta la cola de outliers (idéntico a HistOverlap).
      const all = this.A.mse_x100.concat(this.B.mse_x100).sort((a, b) => a - b);
      this.lo = all[0]; this.hi = quantile(all, 0.94);

      // --- DOM: escenario (canvas) + tabla + leyenda ---
      const stage = document.createElement('div'); stage.className = 'hp-stage';
      this.cv = document.createElement('canvas'); stage.appendChild(this.cv);
      this.table = document.createElement('div'); this.table.className = 'hp-table';
      this.table.innerHTML = this._tableHTML();
      stage.appendChild(this.table);
      this.el.appendChild(stage);

      const nA = this.A.mse_x100.length, nB = this.B.mse_x100.length;
      const lg = document.createElement('div'); lg.className = 'w-legend';
      lg.innerHTML =
        `<span><span class="sw" style="background:${colA(.9)}"></span>${pretty2(this.names[0])} <span style="opacity:.6">(n=${nA})</span></span>` +
        `<span><span class="sw" style="background:${colB(.9)}"></span>${pretty2(this.names[1])} <span style="opacity:.6">(n=${nB})</span></span>`;
      this.el.appendChild(lg);

      this._revealed = false;
    }

    _tableHTML() {
      const S = this.S, pct = v => (v * 100).toFixed(0) + '%';
      let rows = '';
      for (let i = 0; i < S.N.length; i++) {
        rows += `<tr><td class="hp-n">N=${S.N[i]}</td>` +
          `<td class="hp-boot">${pct(S.bootstrap[i])}</td>` +
          `<td class="hp-mc">${pct(S.montecarlo[i])}</td></tr>`;
      }
      return `<table>
        <caption>P(confundir el orden)</caption>
        <thead><tr>
          <th class="hp-n">N</th>
          <th class="hp-boot">Bootstrap</th>
          <th class="hp-mc">Monte&nbsp;Carlo</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    }

    onStart() {
      this._revealed = false;
      // ocultar la tabla AL INSTANTE (sin la transición de salida) para que no se vea
      // "cargar → desaparecer" al re-entrar; el revelado (con fade) llega luego en render().
      this.table.style.transition = 'none';
      this.table.classList.remove('on');
      void this.table.offsetWidth;              // fuerza reflow → aplica el estado oculto ya
      this.table.style.transition = '';
    }

    render() {
      const { ctx, w, h } = fit(this.cv); ctx.clearRect(0, 0, w, h);
      const elapsed = performance.now() - this.t0;
      const DELAY = 760, DUR = 620;                      // espera a que acabe el fundido de slide (~0.7s) → sin salto lateral; luego mete la tabla
      const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
      const prog = ease((elapsed - DELAY) / DUR);        // 0 = ancho completo · 1 = encogido a la izquierda

      // dispara el fundido de la tabla una sola vez
      if (!this._revealed && elapsed >= DELAY) { this._revealed = true; this.table.classList.add('on'); }

      // ancho del área de dibujo: interpola de completo a ~58% (deja hueco a la tabla de la derecha)
      const fullW = w - 60;
      const shrunkW = Math.max(120, w * 0.58 - 46);
      const P = { x: 46, y: 14, w: fullW + (shrunkW - fullW) * prog, h: h - 54 };

      drawHist(ctx, this.A.mse_x100, this.lo, this.hi, 42, P, colA, .28);
      drawHist(ctx, this.B.mse_x100, this.lo, this.hi, 42, P, colB, .28);
      axisX(ctx, this.lo, this.hi, P);
      // marcadores de la media de cada modelo (por qué se confunden: campanas casi solapadas)
      // título arriba-izquierda
      ctx.fillStyle = inkC(.94); ctx.font = '700 15px system-ui, sans-serif'; ctx.textAlign = 'left';
    }

    _mean(ctx, v, P, col) {
      if (typeof v !== 'number') return;
      const x = P.x + P.w * Math.max(0, Math.min(1, (v - this.lo) / (this.hi - this.lo)));
      ctx.strokeStyle = col(.9); ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x, P.y + 6); ctx.lineTo(x, P.y + P.h); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col(1); ctx.beginPath(); ctx.arc(x, P.y + 12, 4.5, 0, 6.283); ctx.fill();
    }
  }

  // registrar el widget (añadir a REG del IIFE)
  REG['hist-prob'] = HistProb;

  // ============================================================ CSS de los widgets de ANOVA
  //  Paneles con el mismo look translúcido de .w-hist + fila flex para poner el gráfico de
  //  interacción y la tabla lado a lado (slide ①) + estilo de tabla (reutiliza el aire de hp-table).
  style.textContent += `
    .w-interact, .w-varbar, .w-anovatable{
      background: var(--panel-bg, rgba(10,24,38,.66)); border:1px solid var(--panel-bd, rgba(150,190,220,.22));
      border-radius:14px; padding:16px 18px 12px; backdrop-filter: blur(1.5px);
      box-shadow:0 14px 40px rgba(0,0,0,.26);
    }
    .w-interact canvas{ height:400px; }
    /* varbar: columna flex → leyenda arriba (order:-1) + canvas que RELLENA la altura del panel,
       para que cada barra se alinee con la sección de su modelo en la tabla vecina. */
    .w-varbar{ display:flex; flex-direction:column; }
    .w-varbar canvas{ flex:1 1 auto; height:auto; min-height:230px; }
    .w-varbar .w-legend--top{ order:-1; margin-top:0; margin-bottom:.5em; }
    /* fila flex: gráfico (izq) + tabla (der). Slide ①: interacción 62 / tabla 38.
       Slide ② (--var): barra 40 / tabla ANOVA 60. */
    .anova-row{ display:flex; gap:22px; width:1100px; margin:.3em auto 0; align-items:stretch; }
    .anova-row .widget{ width:auto; margin:0; }
    .anova-row .w-interact{ flex:1 1 56%; min-width:0; }
    .anova-row .w-anovatable{ flex:1 1 44%; min-width:0; }
    .anova-row--var .w-varbar{ flex:1 1 40%; min-width:0; }
    .anova-row--var .w-anovatable{ flex:1 1 60%; min-width:0; }
    /* nota-advertencia breve bajo las cajas (caveat metodológico) */
    .anova-note{ width:1100px; margin:.55em auto 0; text-align:center;
      font-size:.9rem; line-height:1.4; font-weight:500; color:rgba(var(--ink),.9); }
    /* tabla de estadísticos (reutilizable) */
    .w-anovatable{ display:flex; flex-direction:column; justify-content:center; }
    .w-anovatable .at-box{ width:100%; overflow-x:auto; }
    .w-anovatable table{
      width:100%; border-collapse:collapse; table-layout:auto;
      font-variant-numeric:tabular-nums; font-size:1rem;
      color:rgba(var(--ink,20,53,67),.92);
    }
    .w-anovatable caption{
      caption-side:top; text-align:left; font-weight:700; font-size:1.02rem;
      color:rgba(var(--ink,20,53,67),.95); margin-bottom:.55em; line-height:1.3;
    }
    .w-anovatable th, .w-anovatable td{ padding:.4em .5em; text-align:center; white-space:nowrap; }
    .w-anovatable thead th{
      font-weight:700; border-bottom:1.5px solid rgba(var(--ink,20,53,67),.30); padding-bottom:.44em;
    }
    .w-anovatable tbody tr + tr td{ border-top:1px solid rgba(var(--ink,20,53,67),.12); }
    .w-anovatable .at-src{ text-align:left; font-weight:600; color:rgba(var(--ink,20,53,67),.82); white-space:nowrap; }
    .w-anovatable .at-eta{ font-weight:700; color:rgba(45,140,180,1); }   /* teal = colA */
    /* tabla ANOVA agrupada por modelo (slide ②): más compacta + separadores de grupo */
    .w-anovatable table.at-var{ font-size:.92rem; }
    .w-anovatable .at-var th, .w-anovatable .at-var td{ padding:.28em .45em; }
    .w-anovatable .at-model{ text-align:left; font-weight:700; white-space:nowrap;
      color:rgba(var(--ink,20,53,67),.92); vertical-align:middle; }
    .w-anovatable .at-var tbody tr.at-grp td{ border-top:1.5px solid rgba(var(--ink,20,53,67),.28); }
  `;

  // ============================================================ interaction-plot (ANOVA de dos factores B×L)
  //  Gráfico de interacción: x = learning_rate L (3 niveles), una línea por batch_size B
  //  (3 líneas, colA/colB/colD), y = media MSE×100 con barras de error ±SE. Líneas NO
  //  paralelas ⇒ interacción. Lee anova_ablation.cell_mean[B][L] / cell_se[B][L].
  class InteractionPlot extends W {
    build() {
      this.el.classList.add('w-interact');
      const d = NS.data; if (!d || !d.anova_ablation) throw new Error('sin anova_ablation');
      this.A = d.anova_ablation; this.cols = [colA, colB, colD];
      this.cv = document.createElement('canvas'); this.el.appendChild(this.cv);
      const Bf = this.A.factors.B;
      const lg = document.createElement('div'); lg.className = 'w-legend';
      lg.innerHTML = Bf.levels.map((v, i) =>
        `<span><span class="sw" style="background:${this.cols[i % 3](.95)}"></span>${Bf.label}=${v}</span>`).join('');
      this.el.appendChild(lg);
    }
    render() {
      const { ctx, w, h } = fit(this.cv); ctx.clearRect(0, 0, w, h);
      const A = this.A, Bl = A.factors.B.levels, Ll = A.factors.L.levels;
      const nB = Bl.length, nL = Ll.length, cols = this.cols;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < nB; i++) for (let j = 0; j < nL; j++) {
        const m = A.cell_mean[i][j], s = A.cell_se[i][j];
        if (m - s < lo) lo = m - s; if (m + s > hi) hi = m + s;
      }
      const pad = (hi - lo) * 0.10 || 0.1; lo -= pad; hi += pad;
      if (A.lower_is_better && lo < 0) lo = 0;   // MSE×100 ≥ 0: sin marcas negativas
      const P = { x: 62, y: 16, w: w - 82, h: h - 52 };
      const xj = j => P.x + P.w * (nL > 1 ? j / (nL - 1) : 0.5);
      const yv = v => P.y + P.h * (1 - (v - lo) / (hi - lo));
      // ejes + rejilla horizontal + escala Y
      ctx.strokeStyle = inkC(.35); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x, P.y + P.h); ctx.lineTo(P.x + P.w, P.y + P.h); ctx.stroke();
      ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'right';
      for (let t = 0; t <= 4; t++) {
        const v = lo + (hi - lo) * t / 4, y = yv(v);
        ctx.fillStyle = inkC(.7); ctx.fillText(v.toFixed(1), P.x - 7, y + 4);
        ctx.strokeStyle = inkC(.10); ctx.beginPath(); ctx.moveTo(P.x, y); ctx.lineTo(P.x + P.w, y); ctx.stroke();
      }
      ctx.textAlign = 'center'; ctx.fillStyle = inkC(.78);
      for (let j = 0; j < nL; j++) ctx.fillText('L=' + Ll[j], xj(j), P.y + P.h + 18);
      ctx.fillStyle = inkC(.6); ctx.fillText('learning rate  L', P.x + P.w / 2, P.y + P.h + 36);
      ctx.save(); ctx.translate(15, P.y + P.h / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.fillStyle = inkC(.6); ctx.fillText('media MSE×100  (mejor ↓)', 0, 0); ctx.restore();
      // líneas por B + barras de error ±SE. Revelado izq→der SUAVE (~0.8 s, eased):
      // la línea se dibuja de forma continua (segmento parcial interpolado), sin saltos
      // discretos punto-a-punto (antes iba «a trompicones» con Math.round).
      const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
      const prog = ease(Math.min(1, (performance.now() - this.t0) / 800));
      const xr = prog * (nL - 1);              // frente de revelado en [0, nL-1]
      const kFull = Math.floor(xr + 1e-9);     // último punto totalmente alcanzado
      const frac = xr - kFull;                 // avance hacia el siguiente punto
      for (let i = 0; i < nB; i++) {
        const col = cols[i % 3];
        // trazo continuo: segmentos completos + un tramo parcial hasta el punto interpolado
        ctx.strokeStyle = col(.95); ctx.lineWidth = 2.6; ctx.beginPath();
        ctx.moveTo(xj(0), yv(A.cell_mean[i][0]));
        for (let j = 1; j <= kFull; j++) ctx.lineTo(xj(j), yv(A.cell_mean[i][j]));
        if (frac > 0 && kFull < nL - 1) {
          const x0 = xj(kFull), y0 = yv(A.cell_mean[i][kFull]);
          const x1 = xj(kFull + 1), y1 = yv(A.cell_mean[i][kFull + 1]);
          ctx.lineTo(x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac);
        }
        ctx.stroke();
        // puntos + barras de error en los puntos ya alcanzados (el punto que aún dibuja aparece con el trazo)
        for (let j = 0; j <= kFull; j++) {
          const x = xj(j), m = A.cell_mean[i][j], s = A.cell_se[i][j];
          ctx.strokeStyle = col(.85); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(x, yv(m - s)); ctx.lineTo(x, yv(m + s));
          ctx.moveTo(x - 4, yv(m - s)); ctx.lineTo(x + 4, yv(m - s));
          ctx.moveTo(x - 4, yv(m + s)); ctx.lineTo(x + 4, yv(m + s)); ctx.stroke();
          ctx.fillStyle = col(1); ctx.beginPath(); ctx.arc(x, yv(m), 4.5, 0, 6.283); ctx.fill();
        }
      }
    }
  }

  // ============================================================ variance-bar (componentes de varianza por modelo)
  //  Barras horizontales apiladas (una por modelo) partidas en inicialización / orden /
  //  interacción (η² = % de la varianza observada, descriptivo). Lee anova_variance.varpct.
  class VarianceBar extends W {
    build() {
      this.el.classList.add('w-varbar');
      const d = NS.data; if (!d || !d.anova_variance) throw new Error('sin anova_variance');
      this.V = d.anova_variance;
      this.models = pickModels(this.el, this.V.models);        // respeta data-models (subconjunto/orden)
      // leyenda ARRIBA (order:-1 en CSS) → deja el contenido más abajo/apretado
      const lg = document.createElement('div'); lg.className = 'w-legend w-legend--top';
      lg.innerHTML =
        `<span><span class="sw" style="background:${colA(.9)}"></span>Inicialización</span>` +
        `<span><span class="sw" style="background:${colB(.9)}"></span>Orden</span>` +
        `<span><span class="sw" style="background:${inkC(.4)}"></span>Interacción</span>`;
      this.el.appendChild(lg);
      this.cv = document.createElement('canvas'); this.el.appendChild(this.cv);
    }
    // centros verticales (en px de canvas, ya escalados) de cada sección de modelo en la
    // tabla ANOVA vecina → cada barra se alinea con la fila de su modelo. null si no hay tabla.
    _rowCenters(cvRect) {
      const row = this.el.closest('.anova-row');
      const tbl = row && row.querySelector('.w-anovatable');
      if (!tbl) return null;
      const byName = {};
      tbl.querySelectorAll('.at-model').forEach(c => { byName[c.textContent.trim()] = c; });
      const out = this.models.map(m => {
        const c = byName[pretty2(m)]; if (!c) return null;
        const r = c.getBoundingClientRect();
        if (r.height < 1) return null;
        return { cy: r.top - cvRect.top + r.height / 2, hh: r.height };
      });
      return out.every(v => v) ? out : null;
    }
    render() {
      const cvRect = this.cv.getBoundingClientRect();
      const { ctx, w, h } = fit(this.cv); ctx.clearRect(0, 0, w, h);
      const V = this.V, models = this.models, n = models.length;
      const P = { x: 132, y: 10, w: w - 132 - 46, h: h - 34 };
      const centers = this._rowCenters(cvRect);               // alinear con la tabla vecina
      const rowH = P.h / n;
      // altura de barra: a partir de la sección de tabla si la hay (algo menos), si no proporción de fila
      const bh = centers ? Math.max(16, Math.min(34, centers[0].hh * 0.34)) : Math.min(30, rowH * 0.56);
      const prog = Math.min(1, (performance.now() - this.t0) / 1000);
      const segs = [['init', colA], ['order', colB], ['inter', null]];
      // rejilla vertical 0–100%
      ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center';
      for (let t = 0; t <= 4; t++) {
        const x = P.x + P.w * t / 4;
        ctx.strokeStyle = inkC(.10); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, P.y); ctx.lineTo(x, P.y + P.h); ctx.stroke();
        ctx.fillStyle = inkC(.55); ctx.fillText((t * 25) + '%', x, P.y + P.h + 15);
      }
      models.forEach((m, i) => {
        // centro vertical de la barra: alineado con la sección del modelo en la tabla, o repartido
        const cy = centers ? centers[i].cy : (P.y + i * rowH + rowH / 2);
        const y = cy - bh / 2, e = V.varpct[m];
        ctx.fillStyle = inkC(.94); ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(pretty2(m), P.x - 12, cy);
        let x = P.x, xf = P.x;
        segs.forEach(([k, cf]) => {
          const frac = e[k] || 0, seg = P.w * frac * prog, fseg = P.w * frac;
          ctx.fillStyle = cf ? cf(.85) : inkC(.32);
          ctx.fillRect(x, y, seg, bh); x += seg;
          if (fseg > 30) {
            ctx.globalAlpha = prog; ctx.fillStyle = cf ? '#fff' : inkC(.92);
            ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(Math.round(frac * 100) + '%', xf + fseg / 2, cy); ctx.globalAlpha = 1;
          }
          xf += fseg;
        });
      });
      ctx.textBaseline = 'alphabetic';
    }
  }

  // ============================================================ anova-table (tabla de estadísticos, reutilizable)
  //  data-source="anova_ablation" → Fuente · gl · F · p · η² (ANOVA inferencial de dos factores)
  //  data-source="anova_variance" → η² por modelo × fuente (descomposición factorial, sin F/p)
  class AnovaTable extends W {
    build() {
      this.el.classList.add('w-anovatable');
      const d = NS.data; if (!d) throw new Error('sin datos');
      const src = this.el.dataset.source || 'anova_ablation';
      const box = document.createElement('div'); box.className = 'at-box';
      box.innerHTML = (src === 'anova_variance') ? this._variance(d.anova_variance) : this._ablation(d.anova_ablation);
      this.el.appendChild(box);
    }
    start() {}   // tabla estática: sin bucle de animación
    _ablation(A) {
      if (!A) return '<div class="w-err">sin anova_ablation</div>';
      const rows = A.table.map(r => {
        const F = (r.F == null) ? '—'
          : (r.F >= 1000 ? Math.round(r.F).toLocaleString('es-ES') : r.F.toLocaleString('es-ES'));
        const p = r.p_disp || '—';
        const pct = r.eta2 * 100, eta = pct.toFixed(pct < 1 ? 2 : 1) + '%';
        return `<tr><td class="at-src">${r.source}</td><td>${r.df}</td>` +
          `<td>${F}</td><td>${p}</td><td class="at-eta">${eta}</td></tr>`;
      }).join('');
      return `<table><caption>${A.test}</caption>
        <thead><tr><th class="at-src">Fuente</th><th>gl</th><th>F</th><th>p</th><th>η²</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    }
    _variance(V) {
      if (!V || !V.anova) return '<div class="w-err">sin anova_variance</div>';
      let body = '';
      const models = pickModels(this.el, V.models);            // respeta data-models (p.ej. sin LinearLogistic)
      models.forEach((m, mi) => {
        const rows = V.anova[m].table;
        rows.forEach((r, ri) => {
          const pc = r.pct * 100, pct = pc.toFixed(pc < 1 ? 2 : 1) + '%';
          const model = (ri === 0) ? `<td class="at-model" rowspan="${rows.length}">${pretty2(m)}</td>` : '';
          const grp = (ri === 0 && mi > 0) ? ' class="at-grp"' : '';
          body += `<tr${grp}>${model}<td class="at-src">${r.source}</td><td>${r.df}</td>` +
            `<td class="at-eta">${pct}</td></tr>`;
        });
      });
      return `<table class="at-var"><caption>${V.test}</caption>
        <thead><tr><th class="at-model">Modelo</th><th class="at-src">Fuente</th><th>gl</th><th class="at-eta">η² (% var)</th></tr></thead>
        <tbody>${body}</tbody></table>`;
    }
  }

  REG['interaction-plot'] = InteractionPlot;
  REG['variance-bar'] = VarianceBar;
  REG['anova-table'] = AnovaTable;



  NS.load = async function () {
    // 1) datos incrustados (build standalone, funciona con file://)
    const inl = document.getElementById('pres-data');
    if (inl && inl.textContent.trim()) {
      try { NS.data = JSON.parse(inl.textContent); return; }
      catch (e) { console.warn('pres-data incrustado inválido:', e); }
    }
    // 2) por HTTP
    try { NS.data = await fetch('data/presentation.json', { cache: 'no-cache' }).then(r => r.json()); }
    catch (e) { NS.data = null; console.warn('presentation.json no cargó:', e); }
  };
  NS.mountAll = function (root) {
    root.querySelectorAll('.widget').forEach(el => {
      const T = REG[el.dataset.widget];
      if (T && !el._w) el._w = new T(el);
      else if (!T) el.innerHTML = '<div class="w-err">widget desconocido: ' + el.dataset.widget + '</div>';
    });
  };
  NS.activate = function (slide) { slide && slide.querySelectorAll('.widget').forEach(el => el._w && el._w.start()); };
  NS.deactivate = function (slide) { slide && slide.querySelectorAll('.widget').forEach(el => el._w && el._w.stop()); };
})();
