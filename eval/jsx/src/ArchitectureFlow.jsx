import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/* -------------------------------------------------------------------------- */
/*  Tokens                                                                    */
/* -------------------------------------------------------------------------- */

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

// Optional: remove the @import and the fontFamily below to use your own font.
const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&display=swap');";

const PAPER_STYLE = {
  backgroundColor: C.paper,
  backgroundImage: `linear-gradient(${C.ink}12 1px, transparent 1px), linear-gradient(90deg, ${C.ink}12 1px, transparent 1px)`,
  backgroundSize: "28px 28px",
};

/* -------------------------------------------------------------------------- */
/*  Geometry (everything lives in a 1000 x 560 coordinate space)              */
/* -------------------------------------------------------------------------- */

const W = 1000;
const H = 560;
const NODE_W = 200;
const NODE_H = 128;
const SAMPLES = 28;
const STAGGER = 0.14;

const NODES = {
  client: {
    id: "client",
    label: "Cliente",
    sub: "App web o móvil",
    x: 130,
    y: 280,
    loader: "client",
    Icon: ClientIcon,
    previewText: "Preparando petición",
  },
  api: {
    id: "api",
    label: "Servidor API",
    sub: "Orquesta la petición",
    x: 470,
    y: 280,
    loader: "api",
    Icon: ServerIcon,
    previewText: "Procesando",
  },
  db: {
    id: "db",
    label: "Base de datos",
    sub: "Contexto y sesiones",
    x: 860,
    y: 130,
    loader: "db",
    Icon: DatabaseIcon,
    previewText: "Leyendo contexto",
  },
  llm: {
    id: "llm",
    label: "Modelo LLM",
    sub: "Inferencia",
    x: 860,
    y: 430,
    loader: "llm",
    Icon: SparkIcon,
    previewText: "Generando respuesta",
  },
};

// Cubic Bézier edges, defined from the first node to the second one.
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

const bezier = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [0, 1].map(
    (i) =>
      u * u * u * p0[i] +
      3 * u * u * t * p1[i] +
      3 * u * t * t * p2[i] +
      t * t * t * p3[i]
  );
};

// Path string plus sampled points, in travel direction.
function trace(edge, reverse = false) {
  const { from, c1, c2, to } = edge;
  const [a, b, c, d] = reverse ? [to, c2, c1, from] : [from, c1, c2, to];
  const pts = Array.from({ length: SAMPLES + 1 }, (_, i) =>
    bezier(a, b, c, d, i / SAMPLES)
  );
  return {
    d: `M${a[0]},${a[1]} C${b[0]},${b[1]} ${c[0]},${c[1]} ${d[0]},${d[1]}`,
    xs: pts.map((p) => p[0]),
    ys: pts.map((p) => p[1]),
  };
}

const EDGE_PATHS = Object.fromEntries(
  Object.entries(EDGES).map(([key, edge]) => [key, trace(edge).d])
);

/* -------------------------------------------------------------------------- */
/*  Icons                                                                     */
/* -------------------------------------------------------------------------- */

function Svg({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ClientIcon() {
  return (
    <Svg>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Svg>
  );
}

function ServerIcon() {
  return (
    <Svg>
      <rect x="3" y="3" width="18" height="7" rx="2" />
      <rect x="3" y="14" width="18" height="7" rx="2" />
      <path d="M7 6.5h.01M7 17.5h.01" />
    </Svg>
  );
}

function DatabaseIcon() {
  return (
    <Svg>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </Svg>
  );
}

function SparkIcon() {
  return (
    <Svg>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
    </Svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Per-node loading indicators                                               */
/* -------------------------------------------------------------------------- */

function Loader({ kind, color, reduce }) {
  if (reduce) {
    return (
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: color, opacity: 0.45 + i * 0.25 }}
          />
        ))}
      </span>
    );
  }

  switch (kind) {
    // Cliente: spinner circular
    case "client":
      return (
        <motion.span
          className="block h-4 w-4 rounded-full border-2"
          style={{ borderColor: `${color}33`, borderTopColor: color }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        />
      );

    // Servidor API: barra con un bloque que la recorre
    case "api":
      return (
        <span
          className="relative block h-1.5 w-8 overflow-hidden rounded-full"
          style={{ background: `${color}26` }}
        >
          <motion.span
            className="absolute inset-y-0 left-0 w-3 rounded-full"
            style={{ background: color }}
            animate={{ x: [-12, 32] }}
            transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
          />
        </span>
      );

    // Base de datos: tres discos que parpadean en cascada
    case "db":
      return (
        <span className="flex flex-col gap-[3px]">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block h-[3px] w-5 rounded-full"
              style={{ background: color }}
              animate={{ opacity: [0.25, 1, 0.25], scaleX: [0.7, 1, 0.7] }}
              transition={{
                repeat: Infinity,
                duration: 1.2,
                delay: i * 0.18,
                ease: "easeInOut",
              }}
            />
          ))}
        </span>
      );

    // Modelo LLM: puntos de "escribiendo"
    case "llm":
    default:
      return (
        <span className="flex h-4 items-end gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: color }}
              animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
              transition={{
                repeat: Infinity,
                duration: 0.9,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </span>
      );
  }
}

function StateGlyph({ state, color, kind, reduce }) {
  if (state === "loading") return <Loader kind={kind} color={color} reduce={reduce} />;

  if (state === "done") {
    return (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <motion.path
          d="M3 8.5l3.2 3L13 4.5"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35 }}
        />
      </svg>
    );
  }

  if (state === "error") {
    return (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <motion.path
          d="M4 4l8 8M12 4l-8 8"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.3 }}
        />
      </svg>
    );
  }

  return (
    <span
      className="block h-2.5 w-2.5 rounded-full border-[1.5px]"
      style={{ borderColor: C.line }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Node                                                                      */
/* -------------------------------------------------------------------------- */

const STATE_COLOR = {
  idle: C.muted,
  loading: C.ink,
  done: C.response,
  error: C.error,
};

function Node({ node, state, text, reduce, onPreview }) {
  const tone = STATE_COLOR[state];
  const { Icon } = node;

  const animate = {
    loading: {
      borderColor: C.ink,
      x: 0,
      scale: 1,
      boxShadow: reduce
        ? "0 0 0 6px rgba(22,37,59,0.10)"
        : [
            "0 0 0 0px rgba(22,37,59,0.00)",
            "0 0 0 9px rgba(22,37,59,0.10)",
            "0 0 0 0px rgba(22,37,59,0.00)",
          ],
    },
    done: {
      borderColor: C.response,
      x: 0,
      scale: reduce ? 1 : [1, 1.03, 1],
      boxShadow: "0 0 0 4px rgba(16,133,122,0.12)",
    },
    error: {
      borderColor: C.error,
      x: reduce ? 0 : [0, -7, 7, -5, 5, 0],
      scale: 1,
      boxShadow: "0 0 0 4px rgba(185,58,43,0.12)",
    },
    idle: {
      borderColor: C.line,
      x: 0,
      scale: 1,
      boxShadow: "0 0 0 0px rgba(22,37,59,0)",
    },
  }[state];

  return (
    <motion.button
      type="button"
      onClick={() => onPreview(node.id)}
      className="absolute rounded-[14px] border-[1.5px] text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        left: `${((node.x - NODE_W / 2) / W) * 100}%`,
        top: `${((node.y - NODE_H / 2) / H) * 100}%`,
        width: `${(NODE_W / W) * 100}%`,
        height: `${(NODE_H / H) * 100}%`,
        background: C.card,
        color: C.ink,
        "--tw-ring-color": C.request,
        "--tw-ring-offset-color": C.paper,
      }}
      initial={false}
      animate={animate}
      transition={{
        boxShadow:
          state === "loading" && !reduce
            ? { repeat: Infinity, duration: 1.6, ease: "easeOut" }
            : { duration: 0.3 },
        default: { duration: 0.4 },
      }}
    >
      <span className="flex h-full flex-col justify-between p-3.5">
        <span className="flex items-center gap-2.5">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
            style={{ background: `${tone}14`, color: tone }}
          >
            <Icon />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold">{node.label}</span>
            <span className="text-xs" style={{ color: C.muted }}>
              {node.sub}
            </span>
          </span>
        </span>

        <span
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
          style={{ background: `${tone}10` }}
        >
          <span className="flex h-5 w-8 shrink-0 items-center justify-center">
            <StateGlyph state={state} color={tone} kind={node.loader} reduce={reduce} />
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={text || "idle"}
              aria-live="polite"
              className="line-clamp-2 text-xs font-medium leading-tight"
              style={{ color: tone }}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.15 }}
            >
              {text || "En espera"}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>
    </motion.button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Data-flow burst: glowing particles + an energised wire                    */
/* -------------------------------------------------------------------------- */

function Burst({ edge, reverse, color, count, duration }) {
  const { d, xs, ys } = useMemo(() => trace(EDGES[edge], reverse), [edge, reverse]);

  return (
    <g filter="url(#glow)">
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0.9 }}
        animate={{ pathLength: 1, opacity: [0.9, 0.9, 0] }}
        transition={{
          pathLength: { duration, ease: "linear" },
          opacity: { duration: duration + 0.6, times: [0, 0.6, 1] },
        }}
      />
      {Array.from({ length: count }, (_, i) => {
        const delay = i * STAGGER;
        return (
          <motion.circle
            key={i}
            r={i === 0 ? 6.5 : 4.5}
            fill={color}
            initial={{ cx: xs[0], cy: ys[0], opacity: 0 }}
            animate={{ cx: xs, cy: ys, opacity: [0, 1, 1, 0] }}
            transition={{
              cx: { duration, delay, ease: "linear" },
              cy: { duration, delay, ease: "linear" },
              opacity: { duration, delay, times: [0, 0.1, 0.85, 1], ease: "linear" },
            }}
          />
        );
      })}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                            */
/* -------------------------------------------------------------------------- */

const IDLE = { state: "idle", text: "" };
const INITIAL = { client: IDLE, api: IDLE, db: IDLE, llm: IDLE };
const LOG_COLOR = { request: C.request, response: C.response, error: C.error };

export default function ArchitectureFlow() {
  const reduce = useReducedMotion();

  // Responsive: the 1000x560 scene is scaled to the width of its frame.
  const frameRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [status, setStatus] = useState(INITIAL);
  const [bursts, setBursts] = useState([]);
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [failLlm, setFailLlm] = useState(false);

  const timers = useRef(new Set());
  const runningRef = useRef(false);
  const uid = useRef(0);

  const wait = useCallback(
    (ms) =>
      new Promise((resolve) => {
        const t = setTimeout(() => {
          timers.current.delete(t);
          resolve();
        }, ms);
        timers.current.add(t);
      }),
    []
  );

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  useEffect(() => clearAll, [clearAll]);

  const setNode = (id, state, text = "") =>
    setStatus((prev) => ({ ...prev, [id]: { state, text } }));

  const addLog = (text, tone) =>
    setLog((prev) => [...prev, { id: ++uid.current, text, tone }]);

  const fire = async (edge, reverse, color, count, duration) => {
    const id = ++uid.current;
    setBursts((b) => [...b, { id, edge, reverse, color, count, duration }]);
    await wait((duration + (count - 1) * STAGGER) * 1000 + 150);
    setBursts((b) => b.filter((x) => x.id !== id));
  };

  const reset = () => {
    clearAll();
    runningRef.current = false;
    setRunning(false);
    setBursts([]);
    setLog([]);
    setStatus(INITIAL);
  };

  // Click on a node: shows its loading state on its own.
  const preview = async (id) => {
    if (runningRef.current) return;
    setNode(id, "loading", NODES[id].previewText);
    await wait(2400);
    if (!runningRef.current) setNode(id, "idle");
  };

  const send = async () => {
    if (runningRef.current) return;
    clearAll();
    setBursts([]);
    setLog([]);
    setStatus(INITIAL);
    runningRef.current = true;
    setRunning(true);

    // 1. Client -> API
    setNode("client", "loading", "Enviando petición");
    addLog("El cliente envía POST /api/v1/chat", "request");
    await wait(600);

    setNode("client", "loading", "Esperando respuesta");
    setNode("api", "loading", "Validando sesión");
    await fire("clientApi", false, C.request, 3, 1.1);

    // 2. API <-> Database
    addLog("La API pide contexto con GET /context", "request");
    setNode("api", "loading", "Leyendo contexto");
    setNode("db", "loading", "Buscando documentos");
    await fire("apiDb", false, C.request, 2, 0.9);
    await wait(700);
    await fire("apiDb", true, C.response, 4, 0.9);
    setNode("db", "done", "5 documentos listos");
    addLog("La base de datos devuelve 5 documentos relevantes", "response");

    // 3. API <-> LLM
    setNode("api", "loading", "Construyendo prompt");
    await wait(500);
    addLog("La API envía el prompt con POST /completions", "request");
    setNode("llm", "loading", "Generando respuesta");
    await fire("apiLlm", false, C.request, 3, 1.0);
    await wait(failLlm ? 1600 : 2000);

    if (failLlm) {
      setNode("llm", "error", "Timeout del modelo");
      setNode("api", "error", "Respondiendo 504");
      addLog("El modelo no respondió a tiempo (timeout)", "error");
      await wait(500);
      addLog("La API devuelve 504 al cliente", "error");
      await fire("clientApi", true, C.error, 2, 1.0);
      setNode("client", "error", "Petición fallida");
    } else {
      addLog("El LLM transmite la respuesta en streaming", "response");
      await fire("apiLlm", true, C.response, 7, 1.0);
      setNode("llm", "done", "Respuesta generada");
      setNode("api", "loading", "Enviando respuesta");
      await wait(300);
      addLog("La API devuelve la respuesta al cliente", "response");
      await fire("clientApi", true, C.response, 4, 1.0);
      setNode("api", "done", "Petición atendida");
      setNode("client", "done", "Respuesta recibida");
    }

    runningRef.current = false;
    setRunning(false);
  };

  const activeEdges = new Set(bursts.map((b) => b.edge));

  return (
    <div
      className="min-h-screen w-full px-4 py-10 sm:px-8"
      style={{
        background: C.paper,
        color: C.ink,
        fontFamily: "'Bricolage Grotesque', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <style>{FONT_IMPORT}</style>

      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            El recorrido de una petición hasta el modelo
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed" style={{ color: C.muted }}>
            Pulsa Enviar petición para ver cómo viajan los datos entre los cuatro
            componentes. También puedes hacer clic en cualquier nodo para ver su
            estado de carga.
          </p>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <motion.button
            type="button"
            onClick={send}
            disabled={running}
            whileTap={{ scale: 0.97 }}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
            style={{
              background: C.ink,
              "--tw-ring-color": C.request,
              "--tw-ring-offset-color": C.paper,
            }}
          >
            {running ? "Enviando…" : "Enviar petición"}
          </motion.button>

          <button
            type="button"
            onClick={reset}
            className="rounded-lg border px-4 py-2.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              borderColor: C.line,
              "--tw-ring-color": C.request,
              "--tw-ring-offset-color": C.paper,
            }}
          >
            Reiniciar
          </button>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              style={{ accentColor: C.ink }}
              checked={failLlm}
              disabled={running}
              onChange={(e) => setFailLlm(e.target.checked)}
            />
            Simular fallo del LLM
          </label>

          <div className="ml-auto flex items-center gap-4 text-sm" style={{ color: C.muted }}>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.request }} />
              Petición
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.response }} />
              Respuesta
            </span>
          </div>
        </div>

        {/* Diagram */}
        <div
          ref={frameRef}
          className="overflow-hidden rounded-2xl border"
          style={{ ...PAPER_STYLE, borderColor: C.line, height: H * scale }}
        >
          <div
            className="relative origin-top-left"
            style={{ width: W, height: H, transform: `scale(${scale})` }}
          >
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <defs>
                <filter
                  id="glow"
                  filterUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width={W}
                  height={H}
                >
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {Object.entries(EDGE_PATHS).map(([key, d]) => (
                <motion.path
                  key={key}
                  d={d}
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray="7 7"
                  strokeLinecap="round"
                  initial={false}
                  animate={{
                    stroke: activeEdges.has(key) ? C.ink : C.line,
                    opacity: activeEdges.has(key) ? 1 : 0.55,
                  }}
                  transition={{ duration: 0.25 }}
                />
              ))}

              {Object.values(EDGES).flatMap((e, i) => [
                <circle key={`a${i}`} cx={e.from[0]} cy={e.from[1]} r={4} fill={C.ink} />,
                <circle key={`b${i}`} cx={e.to[0]} cy={e.to[1]} r={4} fill={C.ink} />,
              ])}

              {EDGE_LABELS.map((l) => (
                <text
                  key={l.text}
                  x={l.x}
                  y={l.y}
                  textAnchor={l.anchor}
                  fontSize="13"
                  fill={C.muted}
                >
                  {l.text}
                </text>
              ))}

              {bursts.map((b) => (
                <Burst key={b.id} {...b} />
              ))}
            </svg>

            {Object.values(NODES).map((node) => (
              <Node
                key={node.id}
                node={node}
                state={status[node.id].state}
                text={status[node.id].text}
                reduce={reduce}
                onPreview={preview}
              />
            ))}
          </div>
        </div>

        {/* Event log */}
        <section className="mt-5" aria-label="Registro de la petición">
          <h2 className="mb-2 text-base font-semibold">Registro de la petición</h2>
          <div
            className="min-h-[7rem] rounded-xl border p-4"
            style={{ background: C.card, borderColor: `${C.line}66` }}
          >
            {log.length === 0 ? (
              <p className="text-sm" style={{ color: C.muted }}>
                Aún no hay actividad. Pulsa Enviar petición para empezar.
              </p>
            ) : (
              <ol className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {log.map((entry) => (
                    <motion.li
                      key={entry.id}
                      className="flex items-start gap-2.5 text-sm"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: LOG_COLOR[entry.tone] }}
                      />
                      <span>{entry.text}</span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
