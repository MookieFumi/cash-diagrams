import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(here, "svg/request-flow.svg"), "utf8");
const variant = (theme, bg) => `<div class="v" style="background:${bg ? "repeating-linear-gradient(45deg,#fff8e6,#fff8e6 12px,#fff 12px,#fff 24px)" : "transparent"}">${svg.replace(/(class="cd-[^"]+") data-theme="light"/, `$1 data-theme="${theme}"${bg ? ` data-bg="${bg}"` : ""}`).replace(/cd-request-flow/g, `cd-request-flow-${theme}${bg ? "-" + bg : ""}`)}<p class="s">theme=${theme}${bg ? ", bg=" + bg : ""}</p></div>`;
writeFileSync(join(here, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JSX vs SVG · evaluación</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..800&family=Geist+Mono:wght@400..700&display=swap">
<style>body{font:16px/1.6 "Geist",system-ui,sans-serif;margin:0;background:#05070A;color:#E6EDF3}main{max-width:1080px;margin:0 auto;padding:32px 16px}h1{margin:0 0 4px;letter-spacing:-.03em}h2{margin:32px 0 8px;font:500 16px "Geist Mono",ui-monospace,monospace}h2::before{content:"$ ";color:#B8F25B}p.s{color:#8B96A5;margin:0}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;font:14px "Geist Mono",ui-monospace,monospace}.top a{color:#E6EDF3;text-decoration:none;font-weight:700;font-size:20px;letter-spacing:-.04em}.top a span{color:#B8F25B}.top a.back{font-weight:400;font-size:14px;letter-spacing:0;color:#8B96A5}
code{font-family:"Geist Mono",ui-monospace,monospace;background:#1C2230;color:#B8F25B;padding:1px 5px;border-radius:4px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:16px}.v p{margin:4px 0 0}iframe{width:100%;height:1010px;border:1px solid #232B3B;border-radius:14px;background:#0B0E14}table{border-collapse:collapse;width:100%;background:#0B0E14}td,th{border:1px solid #232B3B;padding:8px 10px;text-align:left;vertical-align:top;font-size:14px}th{background:#141925;font-family:"Geist Mono",ui-monospace,monospace;font-weight:600}</style></head><body><main>
<div class="top"><a href="https://mookiefumi.com"><span>~/</span>mookie</a><a class="back" href="../../">← catálogo</a></div>
<h1>Evaluación: JSX vs SVG puro</h1><p class="s">Mismo diagrama, dos implementaciones. El SVG va incrustado inline en esta misma página (sin JS ni dependencias).</p>
<h2>A · SVG inline (bucle automático)</h2>
<p class="s">Por defecto claro, aunque el sistema esté en modo oscuro: <code>data-theme="light"</code>.</p>
${svg}
<h2>A2 · Variantes de tema y fondo</h2>
<p class="s"><code>data-theme="dark"</code> · <code>data-theme="auto"</code> (sigue al sistema) · <code>data-bg="transparent"</code></p>
<div class="grid">${variant("dark", "")}${variant("auto", "")}${variant("light", "transparent")}</div>
<h2>B · JSX original (React + framer-motion + Tailwind, interactivo)</h2>
<iframe src="jsx/dist/index.html" title="JSX original"></iframe>
<h2>Comparativa</h2>
<table><tr><th></th><th>JSX</th><th>SVG puro</th></tr>
<tr><td>Peso (JS+CSS)</td><td>~280 KB (≈91 KB gzip) + fuente externa</td><td>~42 KB (≈5 KB gzip), sin recursos externos</td></tr>
<tr><td>Dependencias en la web destino</td><td>React, framer-motion, Tailwind y build</td><td>Ninguna</td></tr>
<tr><td>Incrustar inline</td><td>Requiere montar la app (iframe o bundle)</td><td>Pegar el &lt;svg&gt;</td></tr>
<tr><td>Interactividad</td><td>Botones, simular fallo, log, clic en nodos</td><td>Solo bucle (decisión tomada)</td></tr>
<tr><td>Fidelidad</td><td>Referencia</td><td>Muy cercana: estados, loaders, partículas con glow, check animado</td></tr>
<tr><td>Accesibilidad</td><td>aria-live en estados, botones</td><td>title/desc; reduced-motion congela el estado final</td></tr>
<tr><td>Añadir un diagrama</td><td>Escribir otro componente JSX</td><td>Spec + generador (el prototipo ya lo hace)</td></tr></table>
</main></body></html>`);
