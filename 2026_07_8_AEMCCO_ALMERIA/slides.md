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
<div class="wordmark" style="font-size:clamp(2rem,6.2vw,4.1rem);margin:.08em 0 .04em"><span class="t">AE</span><span class="m">M</span><span class="d">CCO</span></div>
<div class="meta" style="font-size:clamp(.8rem,1.7vw,1.12rem)">7–9 Julio 2026 <span class="sep">·</span> Almería <span class="sep">·</span> Universidad de Almería</div>
<div class="talk-title">Que no te engañe el azar</div>
<div class="talk-sub">Cómo impacta la aleatoriedad en el diseño de redes neuronales</div>
<div class="talk-authors">Enrique Heredia-Aguado · Alejandro Rujano · David Valiente · Arturo Gil</div>
<div class="talk-affil">Universidad Miguel Hernández de Elche <span class="sep">·</span> UNED</div>

--- depth:0.05 nobrand
> El problema
# La aleatoriedad afecta a los <span class="accent">resultados</span>

<pre class="rcode"><span class="cm"># fijamos la semilla y respiramos tranquilos…</span>
<span class="fn">set.seed</span>(<span class="num">42</span>)
modelo <span class="op">&lt;-</span> <span class="fn">entrenar</span>(datos)</pre>

Reproducible, sí. Pero, ¿controlamos lo que esa semilla **esconde**?

--- depth:0.1 nobrand
> El problema
## La semilla toca la <span class="accent">inicialización</span> y la optimización

Dos ejecuciones «iguales» acaban en sitios distintos.

<ul class="bullets">
<li>Distintos datos generados en nuestra simulación.</li>
<li>Figuras con aspecto diferente.</li>
<li>Modelos de aprendizaje con diferente resultad.</li>
</ul>

--- depth:0.13 nobrand
> Trabajo previo
## Replicación de otro <span class="accent">ámbito  </span>


<div class="widget" data-widget="gag-reveal" data-base="assets/captura_titulo_paper.png" data-gif="assets/amiga-soy-yo.gif" data-delay="5000" data-dur="3500"></div>

¿Replicación sobre modelos de aprendizaje en ciencias del comportamiento?

<!-- <div class="cite-chip"><span class="cite-badge">Software</span> Heredia-Aguado <i>et al.</i> (2026) · MLV Tools · enheragu.github.io/mlv-tools</div> -->

--- depth:0.15 nobrand wide
> Trabajo previo
## Una varianza estrecha que <span class="accent">sí importa</span>

<div class="widget" data-widget="baldominos"></div>

<div class="cite-chip"><span class="cite-badge">Artículo</span> Baldominos, Sáez, Isasi (2019) · <i>Applied Sciences</i> 9(15):3169</div>

--- depth:0.2 nobrand
> Metodología
## Cómo medimos y qué conclusiones sostenemos

Bajemos a mirar.

--- depth:1 nobrand void center
> ¿Hola? ¿Buenos días?

--- depth:0.95 nobrand
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


--- depth:0.87 nobrand wide
> set_seed no nos vale
## Semilla y rendimiento no <span class="accent">correlacionan</span>

<div class="widget" data-widget="hist-overlap" data-pair="BourginMLP,SparseMLP"></div>

--- depth:0.71 nobrand wide
> ¿Cuánto me fío?
## Probabilidad de <span class="accent">confundirlos</span> según N

<div class="widget" data-widget="hist-prob" data-models="BourginMLP,SparseMLP" data-pair="bourginmlp_vs_sparsemlp"></div>

--- depth:0.63 nobrand wide
> Comparar es optimizar
## La ablación es optimización <span class="accent">manual</span>

<div class="widget" data-widget="ablation-tree" data-case="b1" data-axis="col"></div>

--- depth:0.55 nobrand wide
> CPC18 entrena rápido → más versatilidad
## No es una recta: es un <span class="accent">plano</span>

<div class="widget" data-widget="axis2d" data-n="8"></div>

Inicialización × orden → 35 × 35 = 1225 entrenamientos.

--- depth:0.45 nobrand wide
> Cómo interacciona
## El mapa de la varianza

<div class="widget" data-widget="heatmap" data-models="BourginMLP,SparseMLP,ContextDepNet"></div>

--- depth:0.35 nobrand
## Para llevarse a casa

Analizarla —no solo controlarla— mejora la **reproducibilidad, la comparabilidad y la validez**.

--- depth:0 center
<div class="titlebar">XIX Congreso de Metodología de las<br>Ciencias Sociales y de la Salud</div>
<div class="authors"><span class="me">Enrique Heredia-Aguado</span>, Alejandro Rujano, David Valiente, Arturo Gil</div>
<div class="affil">Univ. Miguel Hernández de Elche <span class="sep">·</span> UNED</div>
<div class="wordmark thanks"><span class="t">Graci</span><span class="m">a</span><span class="d">s</span></div>
<div class="contact">e.heredia@umh.es</div>
<div class="qr-block"><img src="assets/qr-mlv.png" alt="QR mlv-tools"><div class="qr-label">mlv-tools · Zenodo (10.5281/zenodo.20268237)</div></div>
<div class="congress-info"><div class="meta">7–9 Julio 2026 <span class="sep">·</span> Almería</div><div class="univ">Universidad de Almería</div></div>
