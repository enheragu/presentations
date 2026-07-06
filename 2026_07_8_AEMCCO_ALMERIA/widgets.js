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
    .widget{ width:min(1100px,92vw); margin:.3em auto 0; }
    .widget canvas{ width:100%; display:block; }
    /* panel translúcido bajo los widgets de datos: los separa de las olas */
    .w-hist, .w-static, .w-pswap, .w-heatmap, .w-tree, .w-axis{
      background: var(--panel-bg, rgba(10,24,38,.66)); border:1px solid var(--panel-bd, rgba(150,190,220,.22));
      border-radius:14px; padding:16px 18px 12px; backdrop-filter: blur(1.5px);
      box-shadow:0 14px 40px rgba(0,0,0,.26);
    }
    .w-heatmap canvas{ height:min(50vh,400px); }
    .w-tree canvas{ height:min(42vh,340px); }
    .w-tree .w-verdict, .w-tree .w-tally{ text-align:center; }
    .w-gag{ text-align:center; }
    .gag-media{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) scale(.96);
      width:min(720px,58vw); height:auto; opacity:0; transition:opacity .45s ease, transform .45s ease;
      border-radius:14px; box-shadow:0 24px 70px rgba(0,0,0,.55); pointer-events:none; }
    .gag-media.on{ opacity:1; transform:translate(-50%,-50%) scale(1); }
    .w-hist canvas, .w-static canvas{ height:min(40vh,300px); }
    .w-pswap canvas{ height:min(37vh,278px); }
    .w-axis canvas{ height:min(54vh,430px); }
    .w-verdict{ margin-top:.7em; font-size:clamp(.95rem,2.1vw,1.35rem); min-height:1.6em; }
    .w-chip{ display:inline-block; padding:.18em .9em; border-radius:999px; font-weight:700; color:#fff; transition:background .25s; }
    .w-tally{ margin-top:.45em; font-size:clamp(.82rem,1.7vw,1.08rem); opacity:.9; font-variant-numeric:tabular-nums; }
    .w-legend{ display:flex; flex-wrap:wrap; gap:1.1em; justify-content:center; margin-top:.55em; font-size:clamp(.78rem,1.5vw,.98rem); opacity:.92; }
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

  // ============================================================ axis2d
  class Axis2D extends W {
    build() {
      this.el.classList.add('w-axis');
      this.N = parseInt(this.el.dataset.n || '8', 10);
      this.cv = document.createElement('canvas'); this.el.appendChild(this.cv);
      this.clicked = false; this.el.style.cursor = 'pointer';
      this.el.addEventListener('click', () => { if (!this.clicked) { this.clicked = true; this.tClick = performance.now(); } });
    }
    onStart() { this.clicked = false; }
    render() {
      const { ctx, w, h } = fit(this.cv);
      ctx.clearRect(0, 0, w, h);
      const pLoad = (performance.now() - this.t0) / 1000; const tc = this.clicked ? (performance.now() - this.tClick) / 3200 : 0;   // una sola vez (no bucle: confunde)
      const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
      const p1 = ease(Math.min(1, pLoad)), p2 = ease(tc / 0.5), p3 = ease((tc - 0.45) / 0.55);
      const m = 54, L = Math.min(w - 2 * m, h - 2 * m), ox = (w - L) / 2, oy = h - m;   // centrado
      const dx = L / (this.N - 1), dy = L / (this.N - 1), R = Math.max(3, L / this.N * 0.22);

      // eje X + segundo eje que "gira" hacia arriba
      ctx.strokeStyle = inkC(.5); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + L * p1, oy); ctx.stroke();
      if (p2 > 0) {
        const ang = p2 * Math.PI / 2;                                     // 0 → 90°
        ctx.strokeStyle = colB(.6);
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(ang) * L, oy - Math.sin(ang) * L); ctx.stroke();
      }
      // puntos: fila única → rejilla N×N
      const rows = p3 > 0 ? this.N : 1;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < this.N; i++) {
          if (i / this.N > p1 && j === 0) continue;
          const yy = oy - (j === 0 ? 0 : j * dy * p3);
          const a = j === 0 ? 1 : p3;
          ctx.fillStyle = j === 0 ? colA(1) : colA(.35 + .5 * p3);
          ctx.beginPath(); ctx.arc(ox + i * dx, yy, R, 0, 6.283); ctx.globalAlpha = a; ctx.fill(); ctx.globalAlpha = 1;
        }
      }
      // etiquetas
      ctx.fillStyle = inkC(.9); ctx.font = '600 15px system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.textAlign = 'center'; ctx.fillText('seed inicialización', ox + L / 2, oy + 34); ctx.textAlign = 'left';
      if (p2 > .3) { ctx.save(); ctx.translate(ox - 30, oy - L / 2); ctx.rotate(-Math.PI / 2); ctx.fillStyle = colB(.9); ctx.textAlign = 'center'; ctx.fillText('seed orden', 0, 0); ctx.restore(); }
      if (!this.clicked) { ctx.fillStyle = inkC(.6); ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▶ clic para animar', w / 2, 22); }
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
      this.verdict = document.createElement('div'); this.verdict.className = 'w-verdict';
      this.verdict.innerHTML = '<span class="w-chip">…</span>';
      this.tally = document.createElement('div'); this.tally.className = 'w-tally';
      const lg = document.createElement('div'); lg.className = 'w-legend';
      lg.innerHTML = `<span><span class="sw" style="background:${colA(.9)}"></span>${pretty2(this.names[0])}</span>`
        + `<span><span class="sw" style="background:${colB(.9)}"></span>${pretty2(this.names[1])}</span>`;
      this.el.append(this.verdict, this.tally, lg);
      this.k = 0; this.cA = 0; this.cB = 0; this.vA = this.A.mean; this.vB = this.B.mean;
    }
    onStart() {
      this.k = 0; this.cA = 0; this.cB = 0;
      clearInterval(this.timer);
      this.timer = setInterval(() => this.step(), 560);
      this.step();
    }
    step() {
      if (!this.order.length) return;
      const idx = this.order[this.k % this.order.length];
      this.vA = this.A.mse_x100[idx % this.A.mse_x100.length];
      this.vB = this.B.mse_x100[idx % this.B.mse_x100.length];
      const aWins = this.vA < this.vB;               // menor MSE gana
      if (aWins) this.cA++; else this.cB++;
      this.k++;
      const win = aWins ? 0 : 1;
      const chip = this.verdict.firstChild;
      chip.textContent = 'Este seed → ' + pretty2(this.names[win]) + ' mejor';
      chip.style.background = (win === 0 ? colA(1) : colB(1));
      const tot = this.cA + this.cB;
      this.tally.innerHTML = `${pretty2(this.names[0])} gana <b>${Math.round(this.cA / tot * 100)}%</b> · `
        + `${pretty2(this.names[1])} gana <b>${Math.round(this.cB / tot * 100)}%</b> &nbsp;<span style="opacity:.6">(tras ${tot} seeds)</span>`;
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
      lg.innerHTML = `<span>mejor</span>`
        + `<span style="display:inline-block;width:150px;height:.8em;border-radius:3px;background:linear-gradient(90deg,${cmap(0)},${cmap(.35)},${cmap(.7)},${cmap(1)})"></span>`
        + `<span>peor · MSE×100 · cada modelo a su escala · fila=init, col=orden</span>`;
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
          ctx.fillStyle = cmapA(t, prog * 0.95); ctx.fillRect(ox + b * cw, oy + a * ch, cw + 0.6, ch + 0.6);
        }
        ctx.fillStyle = inkC(.92); ctx.font = '600 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(pretty2(x.name), bx + cellW / 2, oy + S + 6);
      });
    }
  }

  // pretty para nombres CamelCase de modelos (los de models{}); si no, tal cual
  function pretty2(n) { return PRETTY[n.toLowerCase()] || n; }

  // ============================================================ ablation-tree (búsqueda voraz uno-a-uno)
  class AblationTree extends W {
    build() {
      this.el.classList.add('w-tree');                         // panel oscuro translúcido (regla .w-tree)
      const d = NS.data; if (!d || !d.ablation_tree) throw new Error('sin ablation_tree');
      const key = this.el.dataset.case || Object.keys(d.ablation_tree)[0];
      this.c = d.ablation_tree[key];
      if (!this.c) throw new Error('caso no encontrado: ' + key);

      // eje del árbol: 'row' (por defecto) o 'col' → filtra a 3 arranques (solo uno de los dos árboles)
      this.axis = (this.el.dataset.axis === 'col') ? 'col' : 'row';
      this.starts = this.c.starts.filter(s => s.start_axis === this.axis);
      if (!this.starts.length) this.starts = this.c.starts.slice(0, 3);   // salvaguarda
      // factor FIJO en el arranque (raíz) y factor BARRIDO en el paso 1
      this.fixed = this.axis === 'row' ? this.c.factors.row : this.c.factors.col;
      this.swept = this.axis === 'row' ? this.c.factors.col : this.c.factors.row;

      this.cv = document.createElement('canvas'); this.el.appendChild(this.cv);
      this.verdict = document.createElement('div'); this.verdict.className = 'w-verdict';
      this.tally = document.createElement('div'); this.tally.className = 'w-tally';
      const lg = document.createElement('div'); lg.className = 'w-legend';
      lg.innerHTML =
        `<span><span class="sw" style="background:${colC(.95)}"></span>alcanza el óptimo</span>` +
        `<span><span class="sw" style="background:${colB(.9)}"></span>se queda corta</span>`;
      this.el.append(this.verdict, this.tally, lg);

      // resumen ESTÁTICO (sin ciclado): cuántas ramas de este eje alcanzan el óptimo, + el global
      const nS = this.starts.length;
      const reach = this.starts.filter(s => s.reaches_optimum_mean).length;
      const reachAll = this.c.starts.filter(s => s.reaches_optimum_mean).length;
      const go = this.c.global_optimum, pct = v => Math.round(v * 100);
      const chip = document.createElement('span'); chip.className = 'w-chip';
      chip.textContent = `${reach} de ${nS} arranques por ${this.fixed.label} alcanzan el óptimo`;
      chip.style.background = reach === nS ? colC(1) : reach === 0 ? colB(1) : colA(1);
      this.verdict.appendChild(chip);
      this.tally.innerHTML =
        `óptimo global: <b>${go.label}</b>` +
        ` &nbsp;·&nbsp; en total <b>${reachAll} de ${this.c.starts.length}</b> arranques lo alcanzan` +
        ` &nbsp;·&nbsp; <span style="opacity:.7">P(óptimo) global</span> <b>${pct(this.c.p_optimum_overall)}%</b>` +
        ` <span style="opacity:.6">de ${this.c.n_seeds} semillas</span>`;
    }

    cellLabel(a, b) {
      const c = this.c;
      return c.factors.row.label + '=' + c.factors.row.levels[a] + ' | ' + c.factors.col.label + '=' + c.factors.col.levels[b];
    }
    fieldLabel(f) { return String(f.field || '').replace(/_/g, ' '); }

    // ---- primitivas de dibujo (canvas) — copiadas del árbol original ----
    roundRect(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath(); ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    // tarjeta con borde redondeado + título (+ subtítulo | + líneas)
    card(ctx, x, y, cw, ch, o) {
      const col = o.col || inkC, muted = (col === inkC);
      this.roundRect(ctx, x, y, cw, ch, 9);
      ctx.fillStyle = muted ? inkC(o.fill != null ? o.fill : .05) : col(o.fill != null ? o.fill : .14);
      ctx.fill();
      ctx.lineWidth = o.bold ? 2 : 1.4; ctx.strokeStyle = col(o.bd != null ? o.bd : .6); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cx = x + cw / 2;
      if (o.lines) {                                            // título + N líneas (endpoint)
        ctx.fillStyle = inkC(o.txt != null ? o.txt : .92); ctx.font = '700 13px system-ui, sans-serif';
        ctx.fillText(o.title, cx, y + 16);
        let yy = y + 34;
        o.lines.forEach((ln, i) => {
          const strong = o.lineStrong && o.lineStrong[i];
          ctx.fillStyle = strong ? col(1) : inkC(.72);
          ctx.font = (strong ? '700 ' : '') + '11.5px system-ui, sans-serif';
          ctx.fillText(ln, cx, yy); yy += 16;
        });
      } else {                                                  // título (+ subtítulo)
        ctx.fillStyle = inkC(o.txt != null ? o.txt : .9);
        ctx.font = (o.bold ? '700 ' : '600 ') + (o.small ? '12.5px' : '13px') + ' system-ui, sans-serif';
        ctx.fillText(o.title, cx, y + (o.sub ? ch / 2 - 7 : ch / 2));
        if (o.sub) {
          ctx.fillStyle = muted ? inkC(.5) : col(.85); ctx.font = '10.5px system-ui, sans-serif';
          ctx.fillText(o.sub, cx, y + ch / 2 + 9);
        }
      }
    }
    // conexión ortogonal redondeada, revelada de izquierda a derecha por `prog`
    elbow(ctx, x1, y1, x2, y2, col, prog, lw) {
      if (prog <= 0) return;
      ctx.save();
      ctx.beginPath(); ctx.rect(x1 - 3, 0, (x2 - x1) * prog + 6, 1e5); ctx.clip();   // reveal x1→x2
      const r = 8, xm = (x1 + x2) / 2, dir = Math.sign(y2 - y1) || 0;
      ctx.beginPath(); ctx.moveTo(x1, y1);
      if (Math.abs(y2 - y1) < 1 || Math.abs(x2 - x1) < 2 * r || Math.abs(y2 - y1) < 2 * r) {
        ctx.lineTo(x2, y2);                                     // recto / demasiado corto para arco
      } else {
        ctx.lineTo(xm - r, y1); ctx.arcTo(xm, y1, xm, y1 + dir * r, r);
        ctx.lineTo(xm, y2 - dir * r); ctx.arcTo(xm, y2, xm + r, y2, r); ctx.lineTo(x2, y2);
      }
      ctx.strokeStyle = col(.9); ctx.lineWidth = lw || 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
      if (prog > 0.985) {                                       // punta de flecha en la tarjeta destino
        const hs = 8; ctx.fillStyle = col(1);
        ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - hs, y2 - hs * .55); ctx.lineTo(x2 - hs, y2 + hs * .55); ctx.closePath(); ctx.fill();
      }
    }

    render() {
      const { ctx, w, h } = fit(this.cv); ctx.clearRect(0, 0, w, h);
      const c = this.c, starts = this.starts, nB = starts.length;

      // título arriba-izquierda
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = inkC(.94); ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillText(pretty2(c.model) + ' · rutas voraces fijando ' + this.fixed.label, 14, 19);
      ctx.textBaseline = 'middle';

      // ---- layout de 4 niveles (raíz · arranque · paso 1 · endpoint), CENTRADO ----
      const mg = 14, topPad = 30, botPad = 22, availH = Math.max(60, h - topPad - botPad);
      const T = 4;
      const cardW = Math.max(86, Math.min(166, (w - 2 * mg - 3 * 24) / T));
      const gapX = Math.min(120, Math.max(22, (w - 2 * mg - T * cardW) / (T - 1)));
      const contentW = T * cardW + (T - 1) * gapX, ox = Math.max(mg, (w - contentW) / 2);
      const tierX = t => ox + t * (cardW + gapX);
      const t0x = tierX(0), t1x = tierX(1), t2x = tierX(2), t3x = tierX(3);
      const midY = topPad + availH / 2;
      const rowCY = i => topPad + availH * (i + 0.5) / nB;        // centro Y de cada rama
      const rootH = 48, startH = 40, step1H = 44, endH = 62;

      // ---- fases del revelado (una sola vez; luego queda estático) ----
      const dt = performance.now() - this.t0;
      const cl = (a, b) => Math.max(0, Math.min(1, (dt - a) / (b - a))), e = x => x * x * (3 - 2 * x);
      const aRoot = e(cl(0, 320)), eFan = cl(240, 880), aStart = e(cl(520, 940));
      const eE1 = cl(820, 1300), aStep1 = e(cl(1020, 1440));
      const eE2 = cl(1320, 1820), aEnd = e(cl(1560, 2040));

      // ---- aristas (detrás de las tarjetas), coloreadas por el resultado de cada rama ----
      for (let i = 0; i < nB; i++) {
        const route = starts[i].reaches_optimum_mean ? colC : colB, cy = rowCY(i);
        this.elbow(ctx, t0x + cardW, midY, t1x, cy, route, eFan, 2.6);          // raíz → arranque (abanico)
        if (aStart > .1) this.elbow(ctx, t1x + cardW, cy, t2x, cy, route, eE1, 2.6);   // arranque → paso 1
        if (aStep1 > .1) this.elbow(ctx, t2x + cardW, cy, t3x, cy, route, eE2, 2.6);   // paso 1 → endpoint
      }

      // ---- raíz: factor fijo compartido ----
      ctx.globalAlpha = aRoot;
      this.card(ctx, t0x, midY - rootH / 2, cardW, rootH,
        { title: this.fixed.label + ' fijo', sub: this.fieldLabel(this.fixed), col: inkC, fill: .06, bd: .5, txt: .92, bold: true });
      ctx.globalAlpha = 1;

      // ---- por rama: arranque (nivel del factor fijo) · paso 1 (barre el otro) · endpoint ----
      for (let i = 0; i < nB; i++) {
        const s = starts[i], ok = s.reaches_optimum_mean, route = ok ? colC : colB, cy = rowCY(i);
        if (aStart > 0) {
          ctx.globalAlpha = aStart;
          this.card(ctx, t1x, cy - startH / 2, cardW, startH,
            { title: s.start_label, sub: 'arranque', col: route, fill: .09, bd: .55, txt: .92, small: true });
          ctx.globalAlpha = 1;
        }
        if (aStep1 > 0) {
          ctx.globalAlpha = aStep1;
          this.card(ctx, t2x, cy - step1H / 2, cardW, step1H,
            { title: this.cellLabel(s.path[0][0], s.path[0][1]), sub: 'paso 1 · barre ' + this.swept.label, col: route, fill: .10, bd: .68, txt: .93 });
          ctx.globalAlpha = 1;
        }
        if (aEnd > 0) {
          ctx.globalAlpha = aEnd;
          const end = s.path[1], val = c.grid_mean[end[0]][end[1]];
          this.card(ctx, t3x, cy - endH / 2, cardW, endH, {
            title: (ok ? '✓ ' : '✗ ') + this.cellLabel(end[0], end[1]),
            lines: ['MSE×100 = ' + val.toFixed(2), 'P(óptimo) = ' + Math.round(s.p_optimum * 100) + '%'],
            lineStrong: [false, true], col: route, fill: .2, bd: 1, txt: .96, bold: true
          });
          ctx.globalAlpha = 1;
        }
      }

      // ---- rótulos de nivel (fila inferior) ----
      ctx.fillStyle = inkC(.5); ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(this.fixed.label + ' (3 niveles)', t0x + cardW / 2, h - 7);
      ctx.fillText('arranque', t1x + cardW / 2, h - 7);
      ctx.fillText('paso 1', t2x + cardW / 2, h - 7);
      ctx.fillText('endpoint', t3x + cardW / 2, h - 7);
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
      this.pub = (b.published || []).filter(p => typeof p.value === 'number');
      if (!this.model || !this.pub.length) throw new Error('baldominos incompleto');
      this.unit = b.unit || '%';

      // rango del eje X: cubre modelo + publicados con un pequeño margen
      const vals = this.pub.map(p => p.value).concat(this.model.band);
      const vlo = Math.min(...vals), vhi = Math.max(...vals), pad = (vhi - vlo) * 0.06 || 0.05;
      this.lo = vlo - pad; this.hi = vhi + pad;

      // histograma del modelo: de las semillas si están horneadas; si no, derivado
      // (determinista) de la normal ajustada → siempre hay una campana que mostrar.
      this.bins = 34;
      this.hist = this._modelHist();          // alturas [0..1], bin más alto = 1

      this.cv = document.createElement('canvas'); this.el.appendChild(this.cv);

      // UNA sola línea de texto (la cifra 50 de 75) + leyenda mínima
      this.verdict = document.createElement('div'); this.verdict.className = 'w-verdict';
      this.verdict.innerHTML = '<span class="w-chip">…</span>';
      const lg = document.createElement('div'); lg.className = 'w-legend';
      lg.innerHTML =
        `<span><span class="sw" style="background:${colA(.8)}"></span>${pretty2(this.model.name)} · ${this.model.n_seeds} semillas</span>` +
        `<span><span class="sw" style="background:${colB(.95)}"></span>publicado en la banda</span>` +
        `<span><span class="sw" style="background:${inkC(.4)}"></span>fuera</span>`;
      this.el.append(this.verdict, lg);
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
      // fuera de banda → tick corto gris punteado en el eje
      ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.strokeStyle = inkC(.34);
      for (const p of pts) { if (p.inBand) continue; ctx.beginPath(); ctx.moveTo(p.x, P.y); ctx.lineTo(p.x, baseY); ctx.stroke(); }
      ctx.setLineDash([]);
      // dentro de banda → regla naranja de altura completa; se enciende cuando la banda la alcanza
      for (const p of pts) {
        if (!p.inBand) continue;
        const covered = p.x >= xa && p.x <= xb; if (covered) shown++;
        ctx.strokeStyle = covered ? colB(.9) : colB(.22); ctx.lineWidth = covered ? 1.5 : 1.1;
        ctx.beginPath(); ctx.moveTo(p.x, P.y); ctx.lineTo(p.x, baseY); ctx.stroke();
      }

      // ---- eje X ----
      ctx.strokeStyle = inkC(.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.x, baseY); ctx.lineTo(P.x + P.w, baseY); ctx.stroke();
      ctx.fillStyle = inkC(.75); ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center';
      for (let t = 0; t <= 4; t++) { const v = this.lo + (this.hi - this.lo) * t / 4; ctx.fillText(v.toFixed(2), P.x + P.w * t / 4, baseY + 16); }
      ctx.fillStyle = inkC(.6);
      const lbl = (b.metric || 'precisión') + ' (' + this.unit + ')';
      ctx.fillText(this.hib ? 'peor ←    ' + lbl + '    → mejor' : 'mejor ←    ' + lbl + '    → peor', P.x + P.w / 2, baseY + 34);

      // ---- UNA sola cifra (dicha una vez) ----
      const total = b.n_published != null ? b.n_published : this.pub.length;
      const inside = (lit >= 1 && b.overlap_count != null) ? b.overlap_count : shown;
      const chip = this.verdict.firstChild;
      chip.textContent = `${inside} de ${total} resultados publicados caen dentro de la banda de una sola red`;
      chip.style.background = colB(1);
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
      font-size:clamp(.72rem,1.5vw,.98rem);
      color:rgba(var(--ink,20,53,67),.92);
    }
    .w-histprob caption{
      caption-side:top; text-align:left; font-weight:700;
      font-size:clamp(.82rem,1.7vw,1.02rem);
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

      const lg = document.createElement('div'); lg.className = 'w-legend';
      lg.innerHTML =
        `<span><span class="sw" style="background:${colA(.9)}"></span>${pretty2(this.names[0])}</span>` +
        `<span><span class="sw" style="background:${colB(.9)}"></span>${pretty2(this.names[1])}</span>`;
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

    onStart() { this._revealed = false; this.table.classList.remove('on'); }

    render() {
      const { ctx, w, h } = fit(this.cv); ctx.clearRect(0, 0, w, h);
      const elapsed = performance.now() - this.t0;
      const DELAY = 2500, DUR = 1000;
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
