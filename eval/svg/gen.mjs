// Prototype generator: spec + sequencer -> self-contained animated SVG (CSS only, no JS, no SMIL).
// Usage: node gen.mjs [slug]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const slug = process.argv[2] || "request-flow";
const P = `cd-${slug}`; // prefix for every class / id / keyframe => safe to inline many diagrams

/* ------------------------------ spec ------------------------------------ */
const W = 1000, H = 560, NW = 200, NH = 128, STAGGER = 0.14, F = 0.2, SAMPLES = 14;
const COL = { // light / dark tokens
  light: { paper: "#E9EEF3", card: "#FBFCFD", ink: "#16253B", line: "#4A5F7D", muted: "#5B6B82", request: "#E58A1F", response: "#10857A", error: "#B93A2B" },
  dark: { paper: "#0F1826", card: "#172338", ink: "#E4ECF7", line: "#6C83A6", muted: "#9AA9BF", request: "#F0A040", response: "#2CB5A8", error: "#E0675A" },
};
const NODES = {
  client: { label: "Cliente", sub: "App web o móvil", x: 130, y: 280, loader: "spinner", icon: "client" },
  api: { label: "Servidor API", sub: "Orquesta la petición", x: 470, y: 280, loader: "bar", icon: "server" },
  db: { label: "Base de datos", sub: "Contexto y sesiones", x: 860, y: 130, loader: "discs", icon: "db" },
  llm: { label: "Modelo LLM", sub: "Inferencia", x: 860, y: 430, loader: "dots", icon: "spark" },
};
const EDGES = {
  clientApi: { from: [230, 280], c1: [263, 280], c2: [337, 280], to: [370, 280] },
  apiDb: { from: [570, 255], c1: [665, 255], c2: [665, 130], to: [760, 130] },
  apiLlm: { from: [570, 305], c1: [665, 305], c2: [665, 430], to: [760, 430] },
};
const EDGE_LABELS = [
  { text: "POST /api/v1/chat", x: 300, y: 262, anchor: "middle" },
  { text: "GET /context", x: 652, y: 190, anchor: "end" },
  { text: "POST /completions", x: 652, y: 372, anchor: "end" },
];
const ICONS = {
  client: `<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>`,
  server: `<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>`,
  db: `<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>`,
  spark: `<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"/>`,
};
const TITLE = "El recorrido de una petición hasta el modelo";
const DESC = "El cliente envía una petición al servidor API, que consulta la base de datos para obtener contexto, llama al modelo LLM y devuelve la respuesta al cliente.";

/* --------------------------- sequencer ---------------------------------- *
 * Mirrors the async script of the JSX version: each step advances a clock. */
const events = Object.fromEntries(Object.keys(NODES).map((k) => [k, []]));
const bursts = [];
let t = 0;
const set = (node, state, text) => events[node].push({ t, state, text });
const fire = (edge, reverse, kind, count, dur) => {
  bursts.push({ edge, reverse, kind, count, dur, t0: t });
  t += dur + (count - 1) * STAGGER + 0.15;
};
const wait = (s) => (t += s);

set("client", "loading", "Enviando petición");
wait(0.6);
set("client", "loading", "Esperando respuesta");
set("api", "loading", "Validando sesión");
fire("clientApi", false, "request", 3, 1.1);
set("api", "loading", "Leyendo contexto");
set("db", "loading", "Buscando documentos");
fire("apiDb", false, "request", 2, 0.9);
wait(0.7);
fire("apiDb", true, "response", 4, 0.9);
set("db", "done", "5 documentos listos");
set("api", "loading", "Construyendo prompt");
wait(0.5);
set("llm", "loading", "Generando respuesta");
fire("apiLlm", false, "request", 3, 1.0);
wait(2.0);
fire("apiLlm", true, "response", 7, 1.0);
set("llm", "done", "Respuesta generada");
set("api", "loading", "Enviando respuesta");
wait(0.3);
fire("clientApi", true, "response", 4, 1.0);
set("api", "done", "Petición atendida");
set("client", "done", "Respuesta recibida");
const R = Math.ceil((t + 3) * 10) / 10; // reset to idle after a ~3 s hold
const T = R + 1.5; // total loop length (s)

/* ------------------------------ helpers --------------------------------- */
const pct = (s) => +((s / T) * 100).toFixed(3);
const r2 = (n) => +n.toFixed(2);
const bez = (a, b, c, d, u) => [0, 1].map((i) => (1 - u) ** 3 * a[i] + 3 * (1 - u) ** 2 * u * b[i] + 3 * (1 - u) * u * u * c[i] + u ** 3 * d[i]);
const route = (e, rev) => {
  const [a, b, c, d] = rev ? [e.to, e.c2, e.c1, e.from] : [e.from, e.c1, e.c2, e.to];
  return { d: `M${a} C${b} ${c} ${d}`, pts: Array.from({ length: SAMPLES + 1 }, (_, i) => bez(a, b, c, d, i / SAMPLES)) };
};
const css = [];
const kf = (name, stops) => {
  // stops: [seconds, declarations]; sorted, deduped (last wins), padded to 0 and T
  const m = new Map();
  stops.sort((x, y) => x[0] - y[0]).forEach(([s, v]) => m.set(pct(Math.min(Math.max(s, 0), T)), v));
  const keys = [...m.keys()].sort((a, b) => a - b);
  if (keys[0] > 0) m.set(0, m.get(keys[0]));
  if (keys.at(-1) < 100) m.set(100, m.get(keys.at(-1)));
  css.push(`@keyframes ${P}-${name}{${[...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}%{${v}}`).join("")}}`);
};
const anim = (name, extra = "") => `animation:${P}-${name} ${T}s linear infinite${extra}`;
const win = (name, windows, inV, outV) => {
  const stops = [];
  for (const [a, b] of windows) {
    if (a > 0) stops.push([a, outV], [a + F, inV]); else stops.push([0, inV]);
    if (b < T) stops.push([b, inV], [b + F, outV]); else stops.push([T, inV]);
  }
  kf(name, stops);
};

/* ------------------------- per-node timelines --------------------------- */
const tl = {};
for (const [id, ev] of Object.entries(events)) {
  const list = [...ev];
  if (list[0].t > 0) list.unshift({ t: 0, state: "idle", text: "En espera" });
  list.push({ t: R, state: "idle", text: "En espera" });
  tl[id] = list.map((e, i) => ({ ...e, a: e.t, b: list[i + 1]?.t ?? T }));
}
const merge = (spans) => spans.reduce((o, [a, b]) => (o.length && Math.abs(o.at(-1)[1] - a) < 1e-6 ? (o.at(-1)[1] = b, o) : [...o, [a, b]]), []);
const stateWins = (id, st) => merge(tl[id].filter((e) => e.state === st).map((e) => [e.a, e.b]));
const TONE = { idle: "muted", loading: "ink", done: "response", error: "error" };
const tone = (s) => `var(--${P}-${TONE[s]})`;

/* ------------------------------- svg ------------------------------------ */
const out = [];
const defs = [];

// edges
const edgeSvg = [];
for (const [key, e] of Object.entries(EDGES)) {
  const d = route(e).d;
  const wins = merge(bursts.filter((b) => b.edge === key).map((b) => [b.t0, b.t0 + b.dur + (b.count - 1) * STAGGER + 0.15]));
  win(`ea-${key}`, wins, "opacity:1", "opacity:0");
  edgeSvg.push(`<path d="${d}" class="${P}-edge"/><path d="${d}" class="${P}-edge ${P}-edge-on" style="${anim(`ea-${key}`)}"/>`);
  edgeSvg.push(`<circle cx="${e.from[0]}" cy="${e.from[1]}" r="4" class="${P}-dot"/><circle cx="${e.to[0]}" cy="${e.to[1]}" r="4" class="${P}-dot"/>`);
}
const labels = EDGE_LABELS.map((l) => `<text x="${l.x}" y="${l.y}" text-anchor="${l.anchor}" class="${P}-elabel">${l.text}</text>`).join("");

// bursts: shared keyframes per burst, particles differ only by animation-delay
const burstSvg = bursts.map((b, i) => {
  const { d, pts } = route(EDGES[b.edge], b.reverse);
  const o = pts[0];
  const colorVar = `var(--${P}-${b.kind})`;
  const tr = (x, y) => `transform:translate(${r2(x - o[0])}px,${r2(y - o[1])}px)`;
  const stopsP = pts.map((p, j) => [(b.dur * j) / SAMPLES, `${tr(p[0], p[1])};opacity:${j === 0 ? 0 : 1}`]);
  stopsP.splice(1, 0, [b.dur * 0.1, `${tr(pts[1][0] * 0.1 + pts[0][0] * 0.9, pts[1][1] * 0.1 + pts[0][1] * 0.9)};opacity:1`]);
  stopsP.push([b.dur * 0.85 + 1e-4, `${stopsP.at(-1)[1].replace(/opacity:\d/, "opacity:1")}`]);
  stopsP.push([b.dur, `${stopsP.at(-2)[1].replace(/opacity:\d/, "opacity:0")}`]);
  // keyframes start at the particle's own t=0, so build them with a local timeline
  const local = [];
  const q = new Map();
  stopsP.forEach(([s, v]) => q.set(pct(s), v));
  q.set(pct(b.dur + 0.05), q.get(pct(b.dur)));
  css.push(`@keyframes ${P}-p${i}{${[...q.entries()].sort((a, c) => a[0] - c[0]).map(([k, v]) => `${k}%{${v}}`).join("")}100%{opacity:0}}`);
  const w = [[0, "opacity:0;stroke-dashoffset:1"], [b.dur, "opacity:.9;stroke-dashoffset:0"], [(b.dur + 0.6) * 0.6, "opacity:.9;stroke-dashoffset:0"], [b.dur + 0.6, "opacity:0;stroke-dashoffset:0"]];
  const wm = new Map();
  w.forEach(([s, v]) => wm.set(pct(s), v));
  wm.set(0, "opacity:.9;stroke-dashoffset:1");
  css.push(`@keyframes ${P}-w${i}{${[...wm.entries()].sort((a, c) => a[0] - c[0]).map(([k, v]) => `${k}%{${v}}`).join("")}100%{opacity:0;stroke-dashoffset:0}}`);
  const parts = Array.from({ length: b.count }, (_, j) => `<circle filter="url(#${P}-glow)" cx="${o[0]}" cy="${o[1]}" r="${j === 0 ? 6.5 : 4.5}" fill="${colorVar}" style="opacity:0;${anim(`p${i}`, ` ${r2(b.t0 + j * STAGGER)}s both`)}"/>`).join("");
  return `<g><path filter="url(#${P}-glow)" d="${d}" pathLength="1" fill="none" stroke="${colorVar}" stroke-width="3" stroke-linecap="round" stroke-dasharray="1" style="${anim(`w${i}`, ` ${r2(b.t0)}s both`)}"/>${parts}</g>`;
});

// loaders (always looping; visibility is gated by the loading-state layer)
const loader = (kind) => {
  const c = `var(--${P}-ink)`;
  if (kind === "spinner") return `<circle cx="38" cy="97" r="7" fill="none" stroke="${c}" stroke-opacity=".2" stroke-width="2"/><circle cx="38" cy="97" r="7" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-dasharray="11 33" class="${P}-spin"/>`;
  if (kind === "bar") return `<clipPath id="${P}-bar"><rect x="22" y="94" width="32" height="6" rx="3"/></clipPath><rect x="22" y="94" width="32" height="6" rx="3" fill="${c}" fill-opacity=".15"/><g clip-path="url(#${P}-bar)"><rect x="22" y="94" width="12" height="6" rx="3" fill="${c}" class="${P}-slide"/></g>`;
  if (kind === "discs") return [0, 1, 2].map((i) => `<rect x="28" y="${89.5 + i * 6}" width="20" height="3" rx="1.5" fill="${c}" class="${P}-disc" style="animation-delay:${i * 0.18}s"/>`).join("");
  return [0, 1, 2].map((i) => `<circle cx="${28 + i * 10}" cy="97" r="3" fill="${c}" class="${P}-dotbounce" style="animation-delay:${i * 0.15}s"/>`).join("");
};

// nodes
const nodeSvg = Object.entries(NODES).map(([id, n]) => {
  const x0 = n.x - NW / 2, y0 = n.y - NH / 2;
  const seq = tl[id];
  // border + icon colours follow the state timeline
  const prop = (suffix, decl) => {
    const stops = [];
    seq.forEach((e, i) => {
      if (i === 0) { stops.push([0, decl(e.state)]); return; }
      stops.push([e.a, decl(seq[i - 1].state)], [e.a + F, decl(e.state)]);
    });
    stops.push([T, decl("idle")]);
    kf(`${id}-${suffix}`, stops);
  };
  prop("stroke", (s) => `stroke:${s === "idle" ? `var(--${P}-line)` : tone(s)}`);
  prop("icon", (s) => `stroke:${tone(s)}`);
  prop("tint", (s) => `fill:${tone(s)}`);
  // pop when something turns done
  const pops = seq.filter((e) => e.state === "done").map((e) => [[e.a, "transform:scale(1)"], [e.a + 0.2, "transform:scale(1.03)"], [e.a + 0.4, "transform:scale(1)"]]).flat();
  kf(`${id}-pop`, [[0, "transform:scale(1)"], ...pops, [T, "transform:scale(1)"]]);
  const loadW = stateWins(id, "loading"), doneW = stateWins(id, "done");
  win(`${id}-halo`, loadW, "opacity:1", "opacity:0");
  win(`${id}-ring`, doneW, "opacity:1", "opacity:0");
  // per-state layers: pill background + glyph
  const layers = ["idle", "loading", "done"].map((st) => {
    const w = stateWins(id, st);
    if (!w.length) return "";
    win(`${id}-L-${st}`, w, "opacity:1", "opacity:0");
    let glyph;
    if (st === "idle") glyph = `<circle cx="38" cy="97" r="5" fill="none" stroke="var(--${P}-line)" stroke-width="1.5"/>`;
    else if (st === "loading") glyph = loader(n.loader);
    else {
      const ds = w.flatMap(([a, b]) => [[a, "stroke-dashoffset:1"], [a + 0.35, "stroke-dashoffset:0"], [b, "stroke-dashoffset:0"]]);
      kf(`${id}-check`, [[0, "stroke-dashoffset:1"], ...ds, [T, "stroke-dashoffset:0"]]);
      glyph = `<path d="M30 97.5l3.2 3L40 93.5" pathLength="1" stroke-dasharray="1" fill="none" stroke="${tone("done")}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="${anim(`${id}-check`)}"/>`;
    }
    return `<g style="${anim(`${id}-L-${st}`)};opacity:0"><rect x="${14 + x0 * 0}" y="80" width="172" height="34" rx="6" fill="${tone(st)}" fill-opacity=".1"/>${glyph}</g>`;
  }).join("");
  // per-phase text layers
  const phases = new Map();
  seq.forEach((e) => { const k = `${e.state}|${e.text}`; (phases.get(k) ?? phases.set(k, { ...e, w: [] }).get(k)).w.push([e.a, e.b]); });
  let pi = 0;
  const texts = [...phases.values()].map((ph) => {
    const nm = `${id}-T${pi++}`;
    win(nm, merge(ph.w), "opacity:1", "opacity:0");
    return `<text x="62" y="100.5" class="${P}-pill" fill="${tone(ph.state)}" style="${anim(nm)};opacity:0">${ph.text}</text>`;
  }).join("");
  return `<g transform="translate(${x0} ${y0})"><g class="${P}-pop" style="${anim(`${id}-pop`)}">
<g style="${anim(`${id}-halo`)};opacity:0"><rect width="${NW}" height="${NH}" rx="14" fill="none" stroke="var(--${P}-ink)" stroke-opacity=".1" class="${P}-pulse"/></g>
<g style="${anim(`${id}-ring`)};opacity:0"><rect width="${NW}" height="${NH}" rx="14" fill="none" stroke="var(--${P}-response)" stroke-opacity=".12" stroke-width="8"/></g>
<rect width="${NW}" height="${NH}" rx="14" fill="var(--${P}-card)" stroke-width="1.5" style="${anim(`${id}-stroke`)}"/>
<rect x="14" y="14" width="32" height="32" rx="8" fill-opacity=".08" style="${anim(`${id}-tint`)}"/>
<g transform="translate(20 20) scale(.8333)" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="${anim(`${id}-icon`)}">${ICONS[n.icon]}</g>
<text x="56" y="27" class="${P}-label">${n.label}</text><text x="56" y="43.5" class="${P}-sub">${n.sub}</text>
${layers}${texts}
</g></g>`;
});

/* ------------------------------- css ------------------------------------ */
const vars = (c) => Object.entries(c).map(([k, v]) => `--${P}-${k}:${v}`).join(";");
const base = `
.${P}{${vars(COL.light)};font-family:'Bricolage Grotesque','Segoe UI',system-ui,-apple-system,sans-serif;display:block;width:100%;height:auto}
@media (prefers-color-scheme:dark){.${P}{${vars(COL.dark)}}}
.${P}-edge{fill:none;stroke:var(--${P}-line);stroke-width:2;stroke-dasharray:7 7;stroke-linecap:round;opacity:.55}
.${P}-edge-on{stroke:var(--${P}-ink);opacity:0}
.${P}-dot{fill:var(--${P}-ink)}
.${P}-elabel{font-size:13px;fill:var(--${P}-muted)}
.${P}-label{font-size:15px;font-weight:600;fill:var(--${P}-ink)}
.${P}-sub{font-size:12px;fill:var(--${P}-muted)}
.${P}-pill{font-size:11px;font-weight:500}
.${P}-pop{transform-box:fill-box;transform-origin:center}
.${P}-pulse{animation:${P}-pulse 1.6s ease-out infinite}
.${P}-spin{transform-box:fill-box;transform-origin:center;animation:${P}-spin .9s linear infinite}
.${P}-slide{animation:${P}-slide 1.1s ease-in-out infinite}
.${P}-disc{transform-box:fill-box;transform-origin:center;animation:${P}-disc 1.2s ease-in-out infinite}
.${P}-dotbounce{animation:${P}-bounce .9s ease-in-out infinite}
@keyframes ${P}-pulse{0%{stroke-width:0}50%{stroke-width:18}100%{stroke-width:0}}
@keyframes ${P}-spin{to{transform:rotate(360deg)}}
@keyframes ${P}-slide{from{transform:translateX(-12px)}to{transform:translateX(32px)}}
@keyframes ${P}-disc{0%,100%{opacity:.25;transform:scaleX(.7)}50%{opacity:1;transform:scaleX(1)}}
@keyframes ${P}-bounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-5px);opacity:1}}
@media (prefers-reduced-motion:reduce){.${P} *{animation-play-state:paused!important;animation-delay:-${(R - 1).toFixed(1)}s!important}}
`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="${P}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${P}-t ${P}-d">
<title id="${P}-t">${TITLE}</title><desc id="${P}-d">${DESC}</desc>
<style>${base}${css.join("")}</style>
<defs><filter id="${P}-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<pattern id="${P}-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="var(--${P}-ink)" stroke-opacity=".07"/></pattern></defs>
<rect width="${W}" height="${H}" rx="16" fill="var(--${P}-paper)"/><rect width="${W}" height="${H}" rx="16" fill="url(#${P}-grid)"/><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="none" stroke="var(--${P}-line)"/>
<g aria-hidden="true">${edgeSvg.join("")}${labels}${burstSvg.join("")}${nodeSvg.join("\n")}</g>
</svg>`;

writeFileSync(join(here, `${slug}.svg`), svg);
writeFileSync(join(here, `${slug}.snippet.html`), `<!-- ${TITLE} · pega este bloque tal cual; sin JS ni dependencias -->\n${svg}\n`);
console.log(`${slug}.svg  ${(svg.length / 1024).toFixed(1)} KB  loop=${T}s  reset@${R}s`);
