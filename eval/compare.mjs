import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(here, "svg/request-flow.svg"), "utf8");
writeFileSync(join(here, "index.html"), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JSX vs SVG · evaluación</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#f4f6f9;color:#16253B}main{max-width:1080px;margin:0 auto;padding:32px 16px}h1{margin:0 0 4px}h2{margin:32px 0 8px}p.s{color:#5B6B82;margin:0}
iframe{width:100%;height:1010px;border:1px solid #4A5F7D;border-radius:12px;background:#fff}table{border-collapse:collapse;width:100%;background:#fff}td,th{border:1px solid #d5dce6;padding:8px 10px;text-align:left;vertical-align:top;font-size:14px}th{background:#e9eef3}</style></head><body><main>
<h1>Evaluación: JSX vs SVG puro</h1><p class="s">Mismo diagrama, dos implementaciones. El SVG va incrustado inline en esta misma página (sin JS ni dependencias).</p>
<h2>A · SVG inline (bucle automático)</h2>
${svg}
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
