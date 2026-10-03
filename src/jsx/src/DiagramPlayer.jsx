import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/* Generic player: renders any diagram described by a spec.json (same spec the SVG generator uses). */

const C = {
  paper: "#E9EEF3",
  card: "#FBFCFD",
  ink: "#16253B",
  line: "#4A5F7D",
  muted: "#5B6B82",
  request: "#E58A1F",
  response: "#10857A",
  error: "#B93A2B",
};
const PAPER_STYLE = {
  backgroundColor: C.paper,
  backgroundImage: `linear-gradient(${C.ink}12 1px, transparent 1px), linear-gradient(90deg, ${C.ink}12 1px, transparent 1px)`,
  backgroundSize: "28px 28px",
};
const STAGGER = 0.14;
const SAMPLES = 14;
const STATE_COLOR = { idle: C.muted, loading: C.ink, done: C.response, error: C.error };

/* ------------------------------ icons ---------------------------------- */
const ICONS = {
  client: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  server: <><rect x="3" y="3" width="18" height="7" rx="2" /><rect x="3" y="14" width="18" height="7" rx="2" /><path d="M7 6.5h.01M7 17.5h.01" /></>,
  db: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  spark: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" /></>,
  device: <><rect x="5" y="5" width="14" height="14" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M19 9h3M19 15h3M2 9h3M2 15h3" /></>,
  web: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /></>,
  shield: <><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></>,
  calc: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};
function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/* ----------------------------- geometry -------------------------------- */
const bezier = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
};
function route(edge, reverse = false) {
  let pts, d;
  if (edge.points) {
    pts = reverse ? [...edge.points].reverse() : [...edge.points];
    d = "M" + pts.map((p) => p.join(",")).join(" L");
  } else {
    const [a, b, c, e] = reverse ? [...edge.bezier].reverse() : edge.bezier;
    pts = Array.from({ length: SAMPLES + 1 }, (_, i) => bezier(a, b, c, e, i / SAMPLES));
    d = `M${a} C${b} ${c} ${e}`;
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { d, xs: pts.map((p) => p[0]), ys: pts.map((p) => p[1]), times: cum.map((v) => v / cum.at(-1)) };
}

/* ----------------------------- loaders --------------------------------- */
function Loader({ kind, color, reduce }) {
  if (reduce)
    return (
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: color, opacity: 0.45 + i * 0.25 }} />)}
      </span>
    );
  switch (kind) {
    case "spinner":
      return <motion.span className="block h-4 w-4 rounded-full border-2" style={{ borderColor: `${color}33`, borderTopColor: color }} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }} />;
    case "bar":
      return (
        <span className="relative block h-1.5 w-8 overflow-hidden rounded-full" style={{ background: `${color}26` }}>
          <motion.span className="absolute inset-y-0 left-0 w-3 rounded-full" style={{ background: color }} animate={{ x: [-12, 32] }} transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }} />
        </span>
      );
    case "discs":
      return (
        <span className="flex flex-col gap-[3px]">
          {[0, 1, 2].map((i) => <motion.span key={i} className="block h-[3px] w-5 rounded-full" style={{ background: color }} animate={{ opacity: [0.25, 1, 0.25], scaleX: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.18, ease: "easeInOut" }} />)}
        </span>
      );
    default:
      return (
        <span className="flex h-4 items-end gap-1">
          {[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: color }} animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15, ease: "easeInOut" }} />)}
        </span>
      );
  }
}
function StateGlyph({ state, color, kind, reduce }) {
  if (state === "loading") return <Loader kind={kind} color={color} reduce={reduce} />;
  if (state === "done")
    return (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <motion.path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35 }} />
      </svg>
    );
  return <span className="block h-2.5 w-2.5 rounded-full border-[1.5px]" style={{ borderColor: C.line }} />;
}

/* ------------------------------- nodes --------------------------------- */
const box = (n, W, H) => ({
  left: `${((n.x - n.w / 2) / W) * 100}%`,
  top: `${((n.y - n.h / 2) / H) * 100}%`,
  width: `${(n.w / W) * 100}%`,
  height: `${(n.h / H) * 100}%`,
});

function Group({ node, W, H }) {
  return (
    <div className="absolute rounded-2xl border-[1.5px]" style={{ ...box(node, W, H), borderColor: C.line, background: `${C.card}8c` }}>
      <div className="px-[22px] pt-[14px] leading-tight">
        <div className="text-[15px] font-semibold">{node.label}</div>
        <div className="text-xs" style={{ color: C.muted }}>{node.sub}</div>
      </div>
      {node.caption && (
        <div className="absolute text-[11px] font-semibold tracking-[0.08em]" style={{ color: C.muted, left: node.caption.x - (node.x - node.w / 2), top: node.caption.y - (node.y - node.h / 2) - 9 }}>
          {node.caption.text}
        </div>
      )}
    </div>
  );
}

function StaticNode({ node, W, H, dashed }) {
  return (
    <div className="absolute flex items-center gap-2.5 rounded-[14px] border-[1.5px] px-3.5" style={{ ...box(node, W, H), borderColor: dashed ? `${C.line}cc` : C.line, borderStyle: dashed ? "dashed" : "solid", background: dashed ? "transparent" : C.card, opacity: dashed ? 0.85 : 1 }}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${C.muted}1a`, color: dashed ? C.muted : C.ink }}>
        <Icon name={node.icon} />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-[15px] font-semibold" style={{ color: dashed ? C.muted : C.ink }}>{node.label}</span>
        <span className="text-xs" style={{ color: C.muted }}>{node.sub}</span>
      </span>
    </div>
  );
}

function StateNode({ node, state, text, reduce, W, H }) {
  const tone = STATE_COLOR[state];
  const compact = node.h <= 90;
  const animate = {
    loading: { borderColor: C.ink, scale: 1, boxShadow: reduce ? "0 0 0 6px rgba(22,37,59,0.10)" : ["0 0 0 0px rgba(22,37,59,0)", "0 0 0 9px rgba(22,37,59,0.10)", "0 0 0 0px rgba(22,37,59,0)"] },
    done: { borderColor: C.response, scale: reduce ? 1 : [1, 1.03, 1], boxShadow: "0 0 0 4px rgba(16,133,122,0.12)" },
    error: { borderColor: C.error, scale: 1, boxShadow: "0 0 0 4px rgba(185,58,43,0.12)" },
    idle: { borderColor: C.line, scale: 1, boxShadow: "0 0 0 0px rgba(22,37,59,0)" },
  }[state];
  const label = compact ? node.label : node.label;
  const shown = text || (compact ? node.sub : "En espera");
  const textEl = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={shown} aria-live="polite" className="text-[11px] font-medium leading-tight" style={{ color: state === "idle" && compact ? C.muted : tone }} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.15 }}>
        {shown}
      </motion.span>
    </AnimatePresence>
  );
  return (
    <motion.div
      className="absolute rounded-[14px] border-[1.5px]"
      style={{ ...box(node, W, H), background: C.card, color: C.ink }}
      initial={false}
      animate={animate}
      transition={{ boxShadow: state === "loading" && !reduce ? { repeat: Infinity, duration: 1.6, ease: "easeOut" } : { duration: 0.3 }, default: { duration: 0.4 } }}
    >
      {compact ? (
        <div className="flex h-full items-center gap-2.5 px-3.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${tone}14`, color: tone }}><Icon name={node.icon} /></span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[15px] font-semibold">{label}</span>
            {textEl}
          </span>
          <span className="flex h-5 w-8 shrink-0 items-center justify-center"><StateGlyph state={state} color={tone} kind={node.loader} reduce={reduce} /></span>
        </div>
      ) : (
        <div className="flex h-full flex-col justify-between p-3.5">
          <span className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${tone}14`, color: tone }}><Icon name={node.icon} /></span>
            <span className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold">{node.label}</span>
              <span className="text-xs" style={{ color: C.muted }}>{node.sub}</span>
            </span>
          </span>
          <span className="flex items-center gap-2.5 rounded-md px-2 py-1.5" style={{ background: `${tone}10` }}>
            <span className="flex h-5 w-8 shrink-0 items-center justify-center"><StateGlyph state={state} color={tone} kind={node.loader} reduce={reduce} /></span>
            {textEl}
          </span>
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------ bursts --------------------------------- */
function Burst({ edges, edge, reverse, kind, count, dur }) {
  const color = C[kind];
  const { d, xs, ys, times } = useMemo(() => route(edges[edge], reverse), [edges, edge, reverse]);
  return (
    <g filter="url(#glow)">
      <motion.path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0, opacity: 0.9 }} animate={{ pathLength: 1, opacity: [0.9, 0.9, 0] }} transition={{ pathLength: { duration: dur, ease: "linear" }, opacity: { duration: dur + 0.6, times: [0, 0.6, 1] } }} />
      {Array.from({ length: count }, (_, i) => {
        const delay = i * STAGGER;
        return (
          <motion.circle key={i} r={i === 0 ? 6.5 : 4.5} fill={color} initial={{ cx: xs[0], cy: ys[0], opacity: 0 }} animate={{ cx: xs, cy: ys, opacity: [0, 1, 1, 0] }}
            transition={{ cx: { duration: dur, delay, ease: "linear", times }, cy: { duration: dur, delay, ease: "linear", times }, opacity: { duration: dur, delay, times: [0, 0.1, 0.85, 1], ease: "linear" } }} />
        );
      })}
    </g>
  );
}

/* ------------------------------- player -------------------------------- */
export default function DiagramPlayer({ specUrl }) {
  const [spec, setSpec] = useState(null);
  useEffect(() => { fetch(specUrl).then((r) => r.json()).then(setSpec); }, [specUrl]);
  return spec ? <Player spec={spec} /> : <div className="p-8 text-sm" style={{ color: C.muted }}>Cargando…</div>;
}

function Player({ spec }) {
  const reduce = useReducedMotion();
  const { width: W, height: H } = spec;
  const nodes = useMemo(() => Object.fromEntries(spec.nodes.map((n) => [n.id, n])), [spec]);
  const initial = useMemo(() => Object.fromEntries(spec.nodes.filter((n) => n.kind === "service").map((n) => [n.id, { state: "idle", text: "" }])), [spec]);

  const [status, setStatus] = useState(initial);
  const [bursts, setBursts] = useState([]);
  const [running, setRunning] = useState(false);
  const [loop, setLoop] = useState(true);

  const timers = useRef(new Set());
  const runId = useRef(0);
  const loopRef = useRef(true);
  const uid = useRef(0);
  loopRef.current = loop;

  // responsive: the scene is scaled to the width of its frame
  const frameRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);

  const wait = useCallback((ms) => new Promise((resolve) => { const t = setTimeout(() => { timers.current.delete(t); resolve(); }, ms); timers.current.add(t); }), []);
  const clearAll = useCallback(() => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);
  useEffect(() => clearAll, [clearAll]);

  const stop = () => { runId.current++; clearAll(); setRunning(false); setBursts([]); setStatus(initial); };

  const play = useCallback(async () => {
    const my = ++runId.current;
    const alive = () => runId.current === my;
    clearAll();
    setBursts([]);
    setStatus(initial);
    setRunning(true);
    for (const step of spec.script) {
      if (!alive()) return;
      if (step.wait != null) await wait(step.wait * 1000);
      else if (step.set) { const [id, state, text] = step.set; setStatus((p) => ({ ...p, [id]: { state, text } })); }
      else if (step.fire) {
        const b = { reverse: false, ...step.fire, id: ++uid.current };
        setBursts((x) => [...x, b]);
        await wait((b.dur + (b.count - 1) * STAGGER) * 1000 + 150);
        if (!alive()) return;
        setBursts((x) => x.filter((y) => y.id !== b.id));
      }
    }
    await wait((spec.hold ?? 3) * 1000);
    if (!alive()) return;
    setRunning(false);
    setStatus(initial);
    if (loopRef.current) { await wait(600); if (alive() && loopRef.current) play(); }
  }, [spec, initial, wait, clearAll]);

  useEffect(() => { play(); }, [play]);

  const active = new Set(bursts.map((b) => b.edge));
  const groups = spec.nodes.filter((n) => n.kind === "group");
  const others = spec.nodes.filter((n) => n.kind !== "group");

  return (
    <div className="min-h-screen w-full px-4 py-8 sm:px-8" style={{ background: C.paper, color: C.ink, fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-5">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{spec.title}</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed" style={{ color: C.muted }}>{spec.description}</p>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <motion.button type="button" onClick={play} disabled={running} whileTap={{ scale: 0.97 }} className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: C.ink }}>
            {running ? "Reproduciendo…" : "Reproducir"}
          </motion.button>
          <button type="button" onClick={stop} className="rounded-lg border px-4 py-2.5 text-sm font-medium" style={{ borderColor: C.line }}>Reiniciar</button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" style={{ accentColor: C.ink }} checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            Repetir en bucle
          </label>
          <div className="ml-auto flex items-center gap-4 text-sm" style={{ color: C.muted }}>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: C.request }} />Petición</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: C.response }} />Respuesta</span>
          </div>
        </div>

        <div ref={frameRef} className="overflow-hidden rounded-2xl border" style={{ ...PAPER_STYLE, borderColor: C.line, height: H * scale }}>
          <div className="relative origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
            {groups.map((n) => <Group key={n.id} node={n} W={W} H={H} />)}

            <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              <defs>
                <filter id="glow" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {Object.entries(spec.edges).map(([key, e]) => (
                <g key={key}>
                  <motion.path d={route(e).d} fill="none" strokeWidth={2} strokeDasharray="7 7" strokeLinecap="round" strokeLinejoin="round" initial={false} animate={{ stroke: active.has(key) ? C.ink : C.line, opacity: active.has(key) ? 1 : 0.55 }} transition={{ duration: 0.25 }} />
                  <circle cx={route(e).xs[0]} cy={route(e).ys[0]} r={4} fill={C.ink} />
                  <circle cx={route(e).xs.at(-1)} cy={route(e).ys.at(-1)} r={4} fill={C.ink} />
                  {e.label && <text x={e.label.x} y={e.label.y} textAnchor={e.label.anchor ?? "middle"} fontSize="13" fill={C.muted}>{e.label.text}</text>}
                </g>
              ))}
              {bursts.map((b) => <Burst key={b.id} edges={spec.edges} {...b} />)}
            </svg>

            {others.map((n) =>
              n.kind === "placeholder" ? <StaticNode key={n.id} node={n} W={W} H={H} dashed />
              : n.kind === "static" ? <StaticNode key={n.id} node={n} W={W} H={H} />
              : <StateNode key={n.id} node={n} state={status[n.id]?.state ?? "idle"} text={status[n.id]?.text ?? ""} reduce={reduce} W={W} H={H} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
