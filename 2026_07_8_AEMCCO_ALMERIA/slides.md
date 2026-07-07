<!-- ===========================================================
     CONTENIDO EN PANTALLA. El GUION (qué contar y por qué) está en guion.md.
     Slide nuevo: línea que abre con  ---   ·   Opciones: depth:0..1 · nobrand · wide · void
     Cuerpo: markdown (# ## > texto **negrita** ![pie](assets/..)) o HTML crudo (línea que empieza por <).
     Acentos: <span class="accent">azul</span> · <span class="accent2">morado</span>
     Widgets (leen data/presentation.json):
       <div class="widget" data-widget="hist-overlap" data-pair="BourginMLP,SparseMLP"></div>
       <div class="widget" data-widget="hist-static" data-models="BourginMLP,SparseMLP,ContextDepNet"></div>
       <div class="widget" data-widget="hist-prob" data-models="BourginMLP,SparseMLP" data-pair="bourginmlp_vs_sparsemlp"></div>
       <div class="widget" data-widget="axis2d" data-n="8"></div>
       <div class="widget" data-widget="heatmap" data-models="BourginMLP,SparseMLP,ContextDepNet"></div>
     =========================================================== -->

--- depth:0 center
<img class="congress-title" src="assets/congress-title.png" alt="XIX Congreso de Metodología de las Ciencias Sociales y de la Salud">
<img class="congress-wordmark" src="assets/congress-wordmark.png" alt="AEMCCO">
<div class="meta" style="font-size:clamp(.8rem,1.7vw,1.12rem)">7–9 Julio 2026 <span class="sep">·</span> Universidad de Almería</div>
<div class="talk-title">Que no te engañe el azar</div>
<div class="talk-sub">Cómo impacta la aleatoriedad en el diseño de redes neuronales</div>
<div class="talk-authors"><span class="me">Enrique Heredia-Aguado</span> · Alejandro Rujano · David Valiente · Arturo Gil</div>
<div class="talk-affil">Universidad Miguel Hernández de Elche <span class="sep">·</span> UNED</div>
<div class="inst-logos">
  <span class="lchip"><img src="assets/logo-i3e.png" alt="I3E · Universidad Miguel Hernández" onerror="this.closest('.lchip').style.display='none'"></span>
  <span class="lchip"><img src="assets/logo-uned.jpg" alt="UNED" onerror="this.closest('.lchip').style.display='none'"></span>
</div>

--- depth:0.05 nobrand bodyc
> El problema
# La aleatoriedad afecta a los <span class="accent">resultados</span>

<pre class="rcode"><span class="cm"># fijamos la semilla y respiramos tranquilos…</span>
<span class="fn">set.seed</span>(<span class="num">42</span>)
modelo <span class="op">&lt;-</span> <span class="fn">entrenar</span>(datos)</pre>

<div style="height:1.1em"></div>

Reproducible, sí. Pero, ¿controlamos lo que esa semilla **esconde**?

--- depth:0.08 nobrand bodyc
> El problema
## La semilla toca la <span class="accent">inicialización</span> y la optimización

Dos ejecuciones «iguales» acaban en sitios distintos.

<ul class="bullets">
<li>Distintos datos generados en nuestra simulación.</li>
<li>Figuras con aspecto diferente.</li>
<li>Modelos de aprendizaje con diferente resultado.</li>
</ul>


--- depth:0.11 nobrand bodyc
> El problema
## ¿Cuánto de lo que concluimos depende del <span class="accent">azar</span>?

Entrenar un modelo de aprendizaje tiene mecanismos de aleatoriedad que pueden influir en la inicialización, carga de datos, entrenamiento o funcionamiento. 

Diferentes configuraciones (hiperparámetros), que no modifican el modelo en sí, también pueden afectar a los resultados o al proceso de aprendizaje.

--- depth:0.14 nobrand
> Trabajo previo
## Replicación de <span class="accent">Visión por Computador</span>


<div class="widget" data-widget="gag-reveal" data-base="assets/captura_titulo_paper.png" data-gif="assets/amiga-soy-yo.gif" data-delay="5000" data-dur="3500"></div>

¿Replicación sobre modelos de aprendizaje en ciencias del comportamiento?

<!-- <div class="cite-chip"><span class="cite-badge">Software</span> Heredia-Aguado <i>et al.</i> (2026) · MLV Tools · enheragu.github.io/mlv-tools</div> -->

--- depth:0.17 nobrand wide
> Trabajo previo
## Una varianza estrecha que <span class="accent">sí importa</span>

<div class="widget" data-widget="baldominos"></div>

<div class="cite-chip"><div class="cite-ref"><span class="cite-badge">Artículo</span><span>Baldominos, A., Sáez, Y., &amp; Isasi, P. (2019). A survey of handwritten character recognition with MNIST and EMNIST. <i>Applied Sciences, 9</i>(15), 3169.</span></div></div>


--- depth:0.2 nobrand center
> Metodología
## ¿Qué hay en el ámbito de las <span class="accent">ciencias del comportamiento</span>?

--- depth:1 nobrand void center
## ¿ ... ?

--- depth:0.99 nobrand
> Metodología
## CPC18: predecir decisiones humanas bajo <span class="accent">riesgo</span>

Varios modelos de la bibliografía · N entrenamientos cada uno.

Simulaciones:
<ul class="bullets">
<li><b>Bootstrap:</b> remuestreo sobre la muestra.</li>
<li><b>Monte Carlo:</b> remuestreo sobre la distribución estimada.</li>
</ul>

Análisis:
<ul class="bullets">
<li>ANOVA de medidas repetidas con dos factores.</li>
</ul>

<div class="cite-chip"><div class="cite-ref"><span class="cite-badge">Informe</span><span>Plonsky, O., Apel, R., Erev, I., Ert, E., &amp; Tennenholtz, M. (2018). <i>When and how can social scientists add value to data scientists? A choice prediction competition for human decision making</i> [Informe técnico]. Technion – Israel Institute of Technology. cpc-18.com</span></div></div>


--- depth:0.91 nobrand wide
> Caso 1: comparando modelos
## Dos modelos, N <span class="accent">ejecuciones</span>

<div style="display:flex;align-items:center;justify-content:center;gap:46px;margin:2.6em 0 1.7em;flex-wrap:wrap">
  <div style="border:1.5px solid rgba(45,140,180,.7);border-radius:20px;padding:1.2em 1.9em;font-weight:700;font-size:1.75rem;color:rgb(var(--ink));background:rgba(45,140,180,.10)">BourginMLP</div>
  <div style="font-size:2.3rem;color:rgba(var(--ink),.45)">vs</div>
  <div style="border:1.5px solid rgba(230,159,0,.7);border-radius:20px;padding:1.2em 1.9em;font-weight:700;font-size:1.75rem;color:rgb(var(--ink));background:rgba(230,159,0,.10)">SparseMLP</div>
</div>

<div style="text-align:center;color:rgba(var(--ink),.82);font-size:1.15rem;margin-top:.2em">Cada uno, <b>N entrenamientos</b> con semillas distintas <span style="opacity:.6">→ una distribución de rendimiento por modelo</span></div>

¿Podemos decir cuál gana con **un solo entrenamiento**?

<div class="cite-chip">
<div class="cite-ref"><span class="cite-badge">Congreso</span><span>Bourgin, D. D., Peterson, J. C., Reichman, D., Russell, S. J., &amp; Griffiths, T. L. (2019). Cognitive model priors for predicting human decisions. <i>Proceedings of the 36th ICML, 97</i>, 5133–5141.</span></div>
<div class="cite-ref"><span class="cite-badge">Artículo</span><span>Mocanu, D. C., Mocanu, E., Stone, P., Nguyen, P. H., Gibescu, M., &amp; Liotta, A. (2018). Scalable training of artificial neural networks with adaptive sparse connectivity inspired by network science. <i>Nature Communications, 9</i>, 2383.</span></div>
</div>

--- depth:0.87 nobrand wide
> Caso 1: comparando modelos
## Semilla y rendimiento no <span class="accent">correlacionan</span>

<div class="widget" data-widget="hist-overlap" data-pair="BourginMLP,SparseMLP"></div>

--- depth:0.71 nobrand wide
> Caso 1: comparando modelos
## Probabilidad de <span class="accent">equivocarse</span> 

<div class="widget" data-widget="hist-prob" data-models="BourginMLP,SparseMLP" data-pair="bourginmlp_vs_sparsemlp"></div>

--- depth:0.67 nobrand wide
> Caso 2: mejorando modelos
## Estudios de Ablación <span style="font-size:.52em;font-weight:600;color:rgb(var(--acc));letter-spacing:0">· sobre BourginMLP</span>

<div style="display:flex;align-items:stretch;justify-content:center;gap:2.8em;margin-top:1.6em">

  <!-- BLOQUE A · qué es una ablación (búsqueda voraz por el árbol de configs) -->
  <div style="flex:1;max-width:545px;display:flex;flex-direction:column;align-items:center">
    <div style="font-weight:700;font-size:1.12rem;color:rgb(var(--acc));margin-bottom:.35em">¿Qué son?</div>
    <svg viewBox="0 0 330 200" style="width:100%;max-width:515px;height:auto">
      <g style="stroke:rgba(var(--ink),.28);stroke-width:1.3;fill:none">
        <path d="M165 34 L52 68"/><path d="M165 34 L165 68"/><path d="M165 34 L278 68"/>
        <path d="M165 96 L52 132"/><path d="M165 96 L165 132"/><path d="M165 96 L278 132"/>
      </g>
      <g style="stroke:#009e73;stroke-width:2.6;fill:none">
        <path d="M165 34 L165 68"/><path d="M165 96 L52 132"/>
      </g>
      <rect x="133" y="6" width="64" height="26" rx="8" style="fill:rgba(var(--ink),.05);stroke:rgba(var(--ink),.3);stroke-width:1.3"/>
      <text x="165" y="23" text-anchor="middle" style="fill:rgb(var(--ink));font:600 11px system-ui">inicio</text>
      <rect x="20"  y="68" width="64" height="26" rx="8" style="fill:rgba(var(--ink),.05);stroke:rgba(var(--ink),.28);stroke-width:1.2"/>
      <text x="52"  y="85" text-anchor="middle" style="fill:rgb(var(--ink));font:600 11px system-ui">L 1e-4</text>
      <rect x="133" y="68" width="64" height="26" rx="8" style="fill:rgba(0,158,115,.16);stroke:#009e73;stroke-width:1.7"/>
      <text x="165" y="85" text-anchor="middle" style="fill:rgb(var(--ink));font:700 11px system-ui">L 1e-3</text>
      <rect x="246" y="68" width="64" height="26" rx="8" style="fill:rgba(var(--ink),.05);stroke:rgba(var(--ink),.28);stroke-width:1.2"/>
      <text x="278" y="85" text-anchor="middle" style="fill:rgb(var(--ink));font:600 11px system-ui">L 1e-2</text>
      <rect x="23"  y="132" width="58" height="26" rx="8" style="fill:rgba(0,158,115,.16);stroke:#009e73;stroke-width:1.7"/>
      <text x="52"  y="149" text-anchor="middle" style="fill:rgb(var(--ink));font:700 11px system-ui">B 16</text>
      <rect x="136" y="132" width="58" height="26" rx="8" style="fill:rgba(var(--ink),.05);stroke:rgba(var(--ink),.28);stroke-width:1.2"/>
      <text x="165" y="149" text-anchor="middle" style="fill:rgb(var(--ink));font:600 11px system-ui">B 32</text>
      <rect x="249" y="132" width="58" height="26" rx="8" style="fill:rgba(var(--ink),.05);stroke:rgba(var(--ink),.28);stroke-width:1.2"/>
      <text x="278" y="149" text-anchor="middle" style="fill:rgb(var(--ink));font:600 11px system-ui">B 64</text>
    </svg>
    <div style="margin-top:.45em;font-size:1.02rem;line-height:1.45;color:rgba(var(--ink),.85);text-align:center;max-width:34ch">Búsqueda iterativa.</div>
  </div>

  <div style="width:1px;background:rgba(var(--ink),.16)"></div>

  <!-- BLOQUE B · cómo medimos la fragilidad (la rejilla completa, cada celda repetida) -->
  <div style="flex:1;max-width:545px;display:flex;flex-direction:column;align-items:center">
    <div style="font-weight:700;font-size:1.12rem;color:rgb(230,159,0);margin-bottom:.35em">¿Cómo medimos los efectos de la varianza?: Experimento factorial</div>
    <div style="display:flex;align-items:center;gap:.5em;margin-top:.3em">
      <div style="writing-mode:vertical-rl;transform:rotate(180deg);font:600 .86rem system-ui;letter-spacing:.04em;color:rgba(var(--ink),.6)">batch size</div>
      <div style="display:inline-grid;grid-template-columns:36px repeat(3,92px);grid-template-rows:repeat(3,70px) 24px;gap:10px;place-items:center">
        <div style="font:700 1rem system-ui;color:rgba(var(--ink),.7)">16</div>
        <div class="ablcell">800</div><div class="ablcell">800</div><div class="ablcell">800</div>
        <div style="font:700 1rem system-ui;color:rgba(var(--ink),.7)">32</div>
        <div class="ablcell">800</div><div class="ablcell">800</div><div class="ablcell">800</div>
        <div style="font:700 1rem system-ui;color:rgba(var(--ink),.7)">64</div>
        <div class="ablcell">800</div><div class="ablcell">800</div><div class="ablcell">800</div>
        <div></div>
        <div style="font:600 .84rem system-ui;color:rgba(var(--ink),.7)">1e-4</div>
        <div style="font:600 .84rem system-ui;color:rgba(var(--ink),.7)">1e-3</div>
        <div style="font:600 .84rem system-ui;color:rgba(var(--ink),.7)">1e-2</div>
      </div>
    </div>
    <div style="font:600 .86rem system-ui;letter-spacing:.04em;color:rgba(var(--ink),.6);margin-top:.15em">learning rate</div>
    <div style="margin-top:.55em;font-size:1.02rem;line-height:1.45;color:rgba(var(--ink),.85);text-align:center;max-width:34ch">9 × 800 = <b>7200</b>.</div>
  </div>

</div>

--- depth:0.63 nobrand wide
> Caso 2: mejorando modelos
## Estudios de ablación: ¿llegamos donde queremos?

<div class="widget" data-widget="ablation-tree" data-case="b1" data-axis="col"></div>

--- depth:0.6 nobrand wide
> Caso 2: mejorando modelos
## Estudios de ablación: ¿Interacción <span class="accent">BL</span>? (ANOVA)

<div class="anova-row">
<div class="widget" data-widget="interaction-plot" data-case="b1"></div>
<div class="widget" data-widget="anova-table" data-source="anova_ablation"></div>
</div>

--- depth:0.56 nobrand wide
> Caso 3: ¿más fuentes de aleatoriedad?
## Variando solo la <span class="accent">inicialización</span>

<div class="widget" data-widget="axis2d" data-n="8" data-mode="line"></div>

Cada punto, una semilla de inicialización distinta.

--- depth:0.55 nobrand wide
> Caso 3: ¿más fuentes de aleatoriedad?
## Variando dos factores de aleatorización

<div class="widget" data-widget="axis2d" data-n="8" data-mode="plane"></div>

Inicialización × orden → 35 × 35 = 1225 entrenamientos.

--- depth:0.45 nobrand wide
> Caso 3: ¿más fuentes de aleatoriedad?
## El mapa de la varianza

<div class="widget" data-widget="heatmap" data-models="BourginMLP,SparseMLP,ContextDepNet"></div>

<div class="cite-chip"><div class="cite-ref"><span class="cite-badge">Artículo</span><span>Peterson, J. C., Bourgin, D. D., Agrawal, M., Reichman, D., &amp; Griffiths, T. L. (2021). Using large-scale experiments and machine learning to discover theories of human decision-making. <i>Science, 372</i>(6547), 1209–1214.</span></div></div>

--- depth:0.35 nobrand wide
> Caso 3: ¿más fuentes de aleatoriedad?
## Cuánta varianza pone cada <span class="accent">fuente</span>

<div class="anova-row anova-row--var">
<div class="widget" data-widget="variance-bar" data-source="anova_variance" data-models="BourginMLP,SparseMLP,ContextDepNet"></div>
<div class="widget" data-widget="anova-table" data-source="anova_variance" data-models="BourginMLP,SparseMLP,ContextDepNet"></div>
</div>

<div class="anova-note">Como el proceso es determinista dadas las semillas, no hay error de medida: la interacción es el término de error de los efectos principales.</div>

--- depth:0.05 nobrand bodyc
> Conclusión
## ¿Y ahora qué?

No dejarse llevar por el azar, pero sí podemos surfearlo. Así mejoraremos la **reproducibilidad, la comparabilidad y las fuentes de evidencia de validez sobre las conclusiones extraídas**<sup class="fn-ref">1</sup>.

<div class="footnote"><sup>1</sup> Alicia, espero que así esté bien dicho.</div> 

--- depth:0 center
<div class="talk-title" style="margin-top:.02em">Que no te engañe el azar</div>
<div class="talk-authors" style="margin-top:.7em"><span class="me">Enrique Heredia-Aguado</span> · Alejandro Rujano · David Valiente · Arturo Gil</div>
<div class="talk-affil">Universidad Miguel Hernández de Elche (I3E) <span class="sep">·</span> UNED</div>
<div class="inst-logos inst-logos--sm">
  <span class="lchip"><img src="assets/logo-i3e.png" alt="I3E · Universidad Miguel Hernández" onerror="this.closest('.lchip').style.display='none'"></span>
  <span class="lchip"><img src="assets/logo-uned.jpg" alt="UNED" onerror="this.closest('.lchip').style.display='none'"></span>
</div>

<div class="wordmark thanks"><span class="t">Graci</span><span class="m">a</span><span class="d">s</span></div>

<div class="qr-block" style="margin-top:.7em"><img src="assets/qr-mlv.png" alt="QR mlv-tools"><div class="qr-label">mlv-tools · (10.5281/zenodo.20268237)</div></div>

<div class="contact">e.heredia@umh.es</div>

<div class="end-congress">XIX Congreso de Metodología de las Ciencias Sociales y de la Salud <span class="sep">·</span> AEMCCO</div>
