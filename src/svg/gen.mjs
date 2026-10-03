// Spec -> self-contained animated SVG (CSS only: no JS, no SMIL, no external resources).
// buildSvg(spec) returns the SVG markup. Every class / id / keyframe is prefixed with `cd-<slug>`.

const COL = {
  light: { paper: "#E9EEF3", card: "#FBFCFD", ink: "#16253B", line: "#4A5F7D", muted: "#5B6B82", request: "#E58A1F", response: "#10857A", error: "#B93A2B" },
  dark: { paper: "#0F1826", card: "#172338", ink: "#E4ECF7", line: "#6C83A6", muted: "#9AA9BF", request: "#F0A040", response: "#2CB5A8", error: "#E0675A" },
};
const ICONS = {
  client: `<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>`,
  server: `<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>`,
  db: `<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>`,
  spark: `<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"/>`,
  device: `<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M19 9h3M19 15h3M2 9h3M2 15h3"/>`,
  web: `<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>`,
  shield: `<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>`,
  calc: `<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>`,
  memory: `<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 7V4M12 7V4M17 7V4M7 20v-3M12 20v-3M17 20v-3"/>`,
  gear: `<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
};
const STAGGER = 0.14, F = 0.2, SAMPLES = 14;
const TONE = { idle: "muted", loading: "ink", done: "response", error: "error" };

export function buildSvg(spec) {
  const P = `cd-${spec.slug}`;
  const W = spec.width, H = spec.height;
  const css = [];
  const tone = (s) => `var(--${P}-${TONE[s]})`;
  const r2 = (n) => +n.toFixed(2);

  /* ---------------------------- geometry ---------------------------- */
  const bez = (a, b, c, d, u) => [0, 1].map((i) => (1 - u) ** 3 * a[i] + 3 * (1 - u) ** 2 * u * b[i] + 3 * (1 - u) * u * u * c[i] + u ** 3 * d[i]);
  // Returns the svg path plus sampled points with their cumulative fraction of the length.
  function route(e, rev) {
    let pts, d;
    if (e.points) {
      pts = rev ? [...e.points].reverse() : [...e.points];
      d = "M" + pts.map((p) => p.join(",")).join(" L");
    } else {
      const [a, b, c, dd] = rev ? [...e.bezier].reverse() : e.bezier;
      pts = Array.from({ length: SAMPLES + 1 }, (_, i) => bez(a, b, c, dd, i / SAMPLES));
      d = `M${a} C${b} ${c} ${dd}`;
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const fr = cum.map((v) => v / cum.at(-1));
    return { d, pts, fr };
  }
  const at = (rt, f) => { // point at fraction f of the route
    let i = 1;
    while (i < rt.fr.length - 1 && rt.fr[i] < f) i++;
    const k = (f - rt.fr[i - 1]) / (rt.fr[i] - rt.fr[i - 1] || 1);
    return [rt.pts[i - 1][0] + (rt.pts[i][0] - rt.pts[i - 1][0]) * k, rt.pts[i - 1][1] + (rt.pts[i][1] - rt.pts[i - 1][1]) * k];
  };

  /* --------------------------- sequencer ---------------------------- */
  const nodes = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));
  const events = {};
  const bursts = [];
  let t = 0;
  for (const step of spec.script) {
    if (step.wait != null) t += step.wait;
    else if (step.set) { const [id, state, text] = step.set; (events[id] ??= []).push({ t, state, text }); }
    else if (step.fire) {
      const b = { reverse: false, ...step.fire, t0: t };
      bursts.push(b);
      t += b.dur + (b.count - 1) * STAGGER + 0.15;
    }
  }
  const R = Math.ceil((t + (spec.hold ?? 3)) * 10) / 10; // reset to idle
  const T = R + 1.5; // loop length

  /* ---------------------------- keyframes --------------------------- */
  const pct = (s) => +((s / T) * 100).toFixed(3);
  const kf = (name, stops) => {
    const m = new Map();
    [...stops].sort((x, y) => x[0] - y[0]).forEach(([s, v]) => m.set(pct(Math.min(Math.max(s, 0), T)), v));
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
  const merge = (spans) => spans.reduce((o, [a, b]) => (o.length && Math.abs(o.at(-1)[1] - a) < 1e-6 ? (o.at(-1)[1] = b, o) : [...o, [a, b]]), []);

  /* ------------------------------ edges ----------------------------- */
  const burstEdges = new Set(bursts.map((b) => b.edge));
  const edgeSvg = [], labelSvg = [];
  for (const [key, e] of Object.entries(spec.edges)) {
    const rt = route(e, false);
    const animated = burstEdges.has(key);
    let on = "";
    if (animated) {
      const wins = merge(bursts.filter((b) => b.edge === key).map((b) => [b.t0, b.t0 + b.dur + (b.count - 1) * STAGGER + 0.15]));
      win(`ea-${key}`, wins, "opacity:1", "opacity:0");
      on = `<path d="${rt.d}" class="${P}-edge ${P}-edge-on" style="${anim(`ea-${key}`)}"/>`;
    }
    const first = rt.pts[0], last = rt.pts.at(-1);
    edgeSvg.push(`<path d="${rt.d}" class="${P}-edge"/>${on}<circle cx="${first[0]}" cy="${first[1]}" r="4" class="${P}-dot"/><circle cx="${last[0]}" cy="${last[1]}" r="4" class="${P}-dot"/>`);
    if (e.label) labelSvg.push(`<text x="${e.label.x}" y="${e.label.y}" text-anchor="${e.label.anchor ?? "middle"}" class="${P}-elabel">${e.label.text}</text>`);
  }

  /* ------------------------------ bursts ---------------------------- */
  const burstSvg = bursts.map((b, i) => {
    const rt = route(spec.edges[b.edge], b.reverse);
    const o = rt.pts[0];
    const colorVar = `var(--${P}-${b.kind})`;
    const tr = (p) => `transform:translate(${r2(p[0] - o[0])}px,${r2(p[1] - o[1])}px)`;
    const q = new Map();
    const put = (s, v) => q.set(pct(s), v);
    rt.pts.forEach((p, j) => put(b.dur * rt.fr[j], `${tr(p)};opacity:${j === 0 ? 0 : 1}`));
    put(b.dur * 0.1, `${tr(at(rt, 0.1))};opacity:1`);
    put(b.dur * 0.85, `${tr(at(rt, 0.85))};opacity:1`);
    put(b.dur, `${tr(rt.pts.at(-1))};opacity:0`);
    put(b.dur + 0.05, `${tr(rt.pts.at(-1))};opacity:0`);
    css.push(`@keyframes ${P}-p${i}{${[...q.entries()].sort((x, y) => x[0] - y[0]).map(([k, v]) => `${k}%{${v}}`).join("")}100%{opacity:0}}`);
    const wm = new Map([[0, "opacity:.9;stroke-dashoffset:1"], [pct(b.dur), "opacity:.9;stroke-dashoffset:0"], [pct((b.dur + 0.6) * 0.6), "opacity:.9;stroke-dashoffset:0"], [pct(b.dur + 0.6), "opacity:0;stroke-dashoffset:0"]]);
    css.push(`@keyframes ${P}-w${i}{${[...wm.entries()].sort((x, y) => x[0] - y[0]).map(([k, v]) => `${k}%{${v}}`).join("")}100%{opacity:0;stroke-dashoffset:0}}`);
    const glow = `filter="url(#${P}-glow)"`;
    const parts = Array.from({ length: b.count }, (_, j) => `<circle ${glow} cx="${o[0]}" cy="${o[1]}" r="${j === 0 ? 6.5 : 4.5}" fill="${colorVar}" style="opacity:0;${anim(`p${i}`, ` ${r2(b.t0 + j * STAGGER)}s both`)}"/>`).join("");
    return `<g><path ${glow} d="${rt.d}" pathLength="1" fill="none" stroke="${colorVar}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" style="opacity:0;${anim(`w${i}`, ` ${r2(b.t0)}s both`)}"/>${parts}</g>`;
  });

  /* ----------------------------- loaders ---------------------------- */
  // Drawn around (0,0); callers translate to the glyph centre.
  const loader = (kind, id) => {
    const c = `var(--${P}-ink)`;
    if (kind === "spinner") return `<circle r="7" fill="none" stroke="${c}" stroke-opacity=".2" stroke-width="2"/><circle r="7" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-dasharray="11 33" class="${P}-spin"/>`;
    if (kind === "bar") return `<clipPath id="${P}-bar-${id}"><rect x="-16" y="-3" width="32" height="6" rx="3"/></clipPath><rect x="-16" y="-3" width="32" height="6" rx="3" fill="${c}" fill-opacity=".15"/><g clip-path="url(#${P}-bar-${id})"><rect x="-16" y="-3" width="12" height="6" rx="3" fill="${c}" class="${P}-slide"/></g>`;
    if (kind === "discs") return [0, 1, 2].map((i) => `<rect x="-10" y="${-7.5 + i * 6}" width="20" height="3" rx="1.5" fill="${c}" class="${P}-disc" style="animation-delay:${i * 0.18}s"/>`).join("");
    return [0, 1, 2].map((i) => `<circle cx="${-10 + i * 10}" r="3" fill="${c}" class="${P}-dotbounce" style="animation-delay:${i * 0.15}s"/>`).join("");
  };
  const iconG = (name, x, y, extra = "") => `<g transform="translate(${x} ${y}) scale(.8333)" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICONS[name]}</g>`;

  /* ------------------------------ nodes ----------------------------- */
  function drawGroup(n) {
    const x0 = n.x - n.w / 2, y0 = n.y - n.h / 2;
    const cap = n.caption ? `<text x="${n.caption.x - x0}" y="${n.caption.y - y0}" class="${P}-caption">${n.caption.text}</text>` : "";
    const ic = n.icon ? `<rect x="14" y="12" width="32" height="32" rx="8" fill="var(--${P}-muted)" fill-opacity=".1"/>${iconG(n.icon, 20, 18, `stroke="var(--${P}-ink)"`)}` : "";
    const tx = n.icon ? 56 : 22;
    return `<g class="${P}-group" transform="translate(${x0} ${y0})"><rect width="${n.w}" height="${n.h}" rx="16" fill="var(--${P}-card)" fill-opacity=".55" stroke="var(--${P}-line)" stroke-width="1.5"/>${ic}<text x="${tx}" y="${n.icon ? 26 : 28}" class="${P}-label">${n.label}</text><text x="${tx}" y="${n.icon ? 43 : 45}" class="${P}-sub">${n.sub}</text>${cap}</g>`;
  }
  function drawStatic(n, dashed) {
    const x0 = n.x - n.w / 2, y0 = n.y - n.h / 2, iy = (n.h - 32) / 2;
    const d = dashed ? ` stroke-dasharray="6 5"` : "";
    const fill = dashed ? `fill="none" stroke="var(--${P}-line)" stroke-opacity=".8"` : `fill="var(--${P}-card)" stroke="var(--${P}-line)"`;
    const lines = Array.isArray(n.sub) ? n.sub : [n.sub];
    const ly = n.h / 2 - 3 - (lines.length - 1) * 7;
    const subs = lines.map((l, i) => `<text x="56" y="${ly + 17 + i * 14}" class="${P}-sub">${l}</text>`).join("");
    return `<g transform="translate(${x0} ${y0})"${dashed ? ` opacity=".85"` : ""}><rect width="${n.w}" height="${n.h}" rx="14" ${fill} stroke-width="1.5"${d}/><rect x="14" y="${iy}" width="32" height="32" rx="8" fill="var(--${P}-muted)" fill-opacity=".1"/>${iconG(n.icon, 20, iy + 6, `stroke="var(--${P}-${dashed ? "muted" : "ink"})"`)}<text x="56" y="${ly}" class="${P}-label${dashed ? ` ${P}-dim` : ""}">${n.label}</text>${subs}</g>`;
  }
  function drawStateful(n) {
    const compact = n.h <= 90;
    const list = [...events[n.id]];
    if (list[0].t > 0) list.unshift({ t: 0, state: "idle", text: "" });
    list.push({ t: R, state: "idle", text: "" });
    const seq = list.map((e, i) => ({ ...e, a: e.t, b: list[i + 1]?.t ?? T }));
    const stateWins = (st) => merge(seq.filter((e) => e.state === st).map((e) => [e.a, e.b]));
    const id = n.id;
    const x0 = n.x - n.w / 2, y0 = n.y - n.h / 2;
    const prop = (suffix, decl) => {
      const stops = [];
      seq.forEach((e, i) => { if (i === 0) stops.push([0, decl(e.state)]); else stops.push([e.a, decl(seq[i - 1].state)], [e.a + F, decl(e.state)]); });
      stops.push([T, decl("idle")]);
      kf(`${id}-${suffix}`, stops);
    };
    prop("stroke", (s) => `stroke:${s === "idle" ? `var(--${P}-line)` : tone(s)}`);
    prop("icon", (s) => `stroke:${tone(s)}`);
    prop("tint", (s) => `fill:${tone(s)}`);
    const pops = seq.filter((e) => e.state === "done").flatMap((e) => [[e.a, "transform:scale(1)"], [e.a + 0.2, "transform:scale(1.03)"], [e.a + 0.4, "transform:scale(1)"]]);
    kf(`${id}-pop`, [[0, "transform:scale(1)"], ...pops, [T, "transform:scale(1)"]]);
    win(`${id}-halo`, stateWins("loading"), "opacity:1", "opacity:0");
    win(`${id}-ring`, stateWins("done"), "opacity:1", "opacity:0");

    // glyph slot + text position
    const pillY = n.h - 14 - 34;
    const arr = Array.isArray(n.sub);
    const g = compact ? { cx: n.w - 26, cy: n.h / 2, tx: 56, ty: arr ? n.h / 2 + 7 : n.h / 2 + 15, size: 11 } : { cx: 38, cy: pillY + 17, tx: 62, ty: pillY + 20.5, size: 11 };
    const layers = ["idle", "loading", "done"].map((st) => {
      const w = stateWins(st);
      if (!w.length || (st === "idle" && compact)) return "";
      win(`${id}-L-${st}`, w, "opacity:1", "opacity:0");
      let glyph;
      if (st === "idle") glyph = `<circle r="5" fill="none" stroke="var(--${P}-line)" stroke-width="1.5"/>`;
      else if (st === "loading") glyph = loader(n.loader, id);
      else {
        const ds = w.flatMap(([a, b]) => [[a, "stroke-dashoffset:1"], [a + 0.35, "stroke-dashoffset:0"], [b, "stroke-dashoffset:0"]]);
        kf(`${id}-check`, [[0, "stroke-dashoffset:1"], ...ds, [T, "stroke-dashoffset:0"]]);
        glyph = `<path d="M-8 .5l3.2 3L2 -3.5" pathLength="1" stroke-dasharray="1" fill="none" stroke="${tone("done")}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="${anim(`${id}-check`)}"/>`;
      }
      const bg = compact ? "" : `<rect x="14" y="${pillY}" width="${n.w - 28}" height="34" rx="6" fill="${tone(st)}" fill-opacity=".1"/>`;
      return `<g style="${anim(`${id}-L-${st}`)};opacity:0">${bg}<g transform="translate(${g.cx} ${g.cy})">${glyph}</g></g>`;
    }).join("");
    const phases = new Map();
    seq.forEach((e) => {
      const text = e.state === "idle" ? (compact ? (arr ? n.sub.join("\n") : n.sub) : "") : e.text;
      const k = `${e.state}|${text}`;
      (phases.get(k) ?? phases.set(k, { state: e.state, text, w: [] }).get(k)).w.push([e.a, e.b]);
    });
    let pi = 0;
    const texts = [...phases.values()].filter((ph) => ph.text).map((ph) => {
      const nm = `${id}-T${pi++}`;
      win(nm, merge(ph.w), "opacity:1", "opacity:0");
      const lines = ph.text.split("\n");
      const inner = lines.length > 1 ? lines.map((l, i) => `<tspan x="${g.tx}" ${i ? 'dy="14"' : `y="${g.ty}"`}>${l}</tspan>`).join("") : ph.text;
      return `<text x="${g.tx}" y="${g.ty}" class="${P}-pill" fill="${ph.state === "idle" && compact ? `var(--${P}-muted)` : tone(ph.state)}" style="${anim(nm)};opacity:0">${inner}</text>`;
    }).join("");
    const iy = compact ? (n.h - 32) / 2 : 14;
    const label = compact ? `<text x="56" y="${arr ? n.h / 2 - 10 : n.h / 2 - 3}" class="${P}-label">${n.label}</text>` : `<text x="56" y="27" class="${P}-label">${n.label}</text><text x="56" y="43.5" class="${P}-sub">${n.sub}</text>`;
    return `<g transform="translate(${x0} ${y0})"><g class="${P}-pop" style="${anim(`${id}-pop`)}">
<g style="${anim(`${id}-halo`)};opacity:0"><rect width="${n.w}" height="${n.h}" rx="14" fill="none" stroke="var(--${P}-ink)" stroke-opacity=".1" class="${P}-pulse"/></g>
<g style="${anim(`${id}-ring`)};opacity:0"><rect width="${n.w}" height="${n.h}" rx="14" fill="none" stroke="var(--${P}-response)" stroke-opacity=".12" stroke-width="8"/></g>
<rect width="${n.w}" height="${n.h}" rx="14" fill="var(--${P}-card)" stroke-width="1.5" style="${anim(`${id}-stroke`)}"/>
<rect x="14" y="${iy}" width="32" height="32" rx="8" fill-opacity=".08" style="${anim(`${id}-tint`)}"/>
${iconG(n.icon, 20, iy + 6, `style="${anim(`${id}-icon`)}"`)}
${label}${layers}${texts}
</g></g>`;
  }
  const nodeSvg = spec.nodes.map((n) => {
    if (n.kind === "group") return drawGroup(n);
    if (n.kind === "placeholder") return drawStatic(n, true);
    return events[n.id] ? drawStateful(n) : drawStatic(n, false);
  });
  /* ------------------------------ css ------------------------------- */
  const vars = (c) => Object.entries(c).map(([k, v]) => `--${P}-${k}:${v}`).join(";");
  const base = `
.${P}{${vars(COL.light)};font-family:'Bricolage Grotesque','Segoe UI',system-ui,-apple-system,sans-serif;display:block;width:100%;height:auto}
/* tema claro por defecto; oscuro solo con data-theme="dark" o data-theme="auto" (sigue al sistema) */
.${P}[data-theme="dark"]{${vars(COL.dark)}}
@media (prefers-color-scheme:dark){.${P}[data-theme="auto"]{${vars(COL.dark)}}}
.${P}[data-bg="transparent"] .${P}-bg{display:none}
.${P}-edge{fill:none;stroke:var(--${P}-line);stroke-width:2;stroke-dasharray:7 7;stroke-linecap:round;stroke-linejoin:round;opacity:.55}
.${P}-edge-on{stroke:var(--${P}-ink);opacity:0}
.${P}-dot{fill:var(--${P}-ink)}
.${P}-elabel{font-size:13px;fill:var(--${P}-muted)}
.${P}-label{font-size:15px;font-weight:600;fill:var(--${P}-ink)}
.${P}-dim{fill:var(--${P}-muted)}
.${P}-sub{font-size:12px;fill:var(--${P}-muted)}
.${P}-caption{font-size:11px;font-weight:600;letter-spacing:.08em;fill:var(--${P}-muted)}
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

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="${P}" data-theme="light" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${P}-t ${P}-d">
<title id="${P}-t">${spec.title}</title><desc id="${P}-d">${spec.description}</desc>
<style>${base}${css.join("")}</style>
<defs><filter id="${P}-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<pattern id="${P}-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="var(--${P}-ink)" stroke-opacity=".07"/></pattern></defs>
<g class="${P}-bg"><rect width="${W}" height="${H}" rx="16" fill="var(--${P}-paper)"/><rect width="${W}" height="${H}" rx="16" fill="url(#${P}-grid)"/><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="none" stroke="var(--${P}-line)"/></g>
<g aria-hidden="true">${nodeSvg.filter((s) => s.startsWith(`<g class="${P}-group"`)).join("\n")}${edgeSvg.join("")}${labelSvg.join("")}${burstSvg.join("")}${nodeSvg.filter((s) => !s.startsWith(`<g class="${P}-group"`)).join("\n")}</g>
</svg>`;
  return { svg, loop: T, reset: R };
}

export const snippetOf = (spec, svg) => `<!-- ${spec.title} · pega este bloque tal cual; sin JS ni dependencias.
     Tema (atributos del <svg>): data-theme="light" (por defecto) | "dark" | "auto" (sigue al sistema)
     Fondo: data-bg="transparent" quita el papel y la rejilla -->
${svg}
`;
