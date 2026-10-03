// Builds the whole catalogue into ./_site
//   node src/build.mjs
// Prerequisite (CI does it): `npm ci && npm run build` in src/jsx and in diagrams/request-flow/jsx.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSvg, snippetOf } from "./svg/gen.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "_site");
const dDir = join(root, "diagrams");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const read = (p) => readFileSync(p, "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); cpSync(from, to, { recursive: true }); };

const cards = [];
for (const slug of readdirSync(dDir).sort()) {
  const dir = join(dDir, slug);
  const site = join(out, "diagrams", slug);
  let meta, svg, snippet, extra = [];

  if (existsSync(join(dir, "spec.json"))) {
    // ---- diagram generated from a spec: SVG + snippet + generic JSX player
    const spec = JSON.parse(read(join(dir, "spec.json")));
    meta = spec;
    const r = buildSvg(spec);
    svg = r.svg;
    snippet = snippetOf(spec, svg);
    mkdirSync(join(dir, "svg"), { recursive: true });
    writeFileSync(join(dir, "svg", `${slug}.svg`), svg);
    writeFileSync(join(dir, "svg", `${slug}.snippet.html`), snippet);
    const player = join(root, "src/jsx/dist");
    if (existsSync(player)) { copy(player, join(site, "jsx")); copy(join(dir, "spec.json"), join(site, "jsx/spec.json")); }
    else console.warn(`! src/jsx/dist missing: JSX link of ${slug} will be broken`);
  } else if (existsSync(join(dir, "meta.json"))) {
    // ---- hand-made example kept as reference (original JSX + SVG + comparison)
    meta = JSON.parse(read(join(dir, "meta.json")));
    execFileSync("node", [join(dir, "svg/gen.mjs")], { stdio: "inherit" });
    execFileSync("node", [join(dir, "compare.mjs")], { stdio: "inherit" });
    svg = read(join(dir, "svg", `${slug}.svg`));
    snippet = read(join(dir, "svg", `${slug}.snippet.html`));
    const jsx = join(dir, "jsx/dist");
    if (existsSync(jsx)) copy(jsx, join(site, "jsx")); else console.warn(`! ${jsx} missing`);
    mkdirSync(site, { recursive: true });
    writeFileSync(join(site, "compare.html"), read(join(dir, "index.html")).replace('src="jsx/dist/index.html"', 'src="jsx/index.html"'));
    extra.push({ href: `diagrams/${slug}/compare.html`, label: "Comparativa" });
  } else continue;

  mkdirSync(join(site, "svg"), { recursive: true });
  writeFileSync(join(site, "svg", `${slug}.svg`), svg);
  writeFileSync(join(site, "svg", `${slug}.snippet.html`), snippet);
  cards.push({ slug, meta, svg, extra });
}

// kyo-trx first, examples last
cards.sort((a, b) => Number(!!a.meta.example) - Number(!!b.meta.example) || a.slug.localeCompare(b.slug));

const cardHtml = cards.map(({ slug, meta, svg, extra }) => `
<article class="card" data-tags="${esc(meta.tags.join("|").toLowerCase())}">
  <a class="thumb" href="diagrams/${slug}/svg/${slug}.svg" aria-label="Abrir el SVG de ${esc(meta.title)}">${svg}</a>
  <div class="body">
    <div class="meta">${meta.example ? '<span class="badge">Ejemplo base</span>' : '<span class="badge live">Sistema</span>'}</div>
    <h2>${esc(meta.title)}</h2>
    ${meta.subtitle ? `<p class="sub">${esc(meta.subtitle)}</p>` : ""}
    <p class="desc">${esc(meta.description)}</p>
    <ul class="tags">${meta.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <div class="actions">
      <a class="btn primary" href="diagrams/${slug}/svg/${slug}.svg">SVG</a>
      <a class="btn" href="diagrams/${slug}/jsx/">JSX interactivo</a>
      <button class="btn" type="button" data-copy="diagrams/${slug}/svg/${slug}.snippet.html">Copiar snippet</button>
      ${extra.map((e) => `<a class="btn ghost" href="${e.href}">${e.label}</a>`).join("")}
    </div>
  </div>
</article>`).join("\n");

const allTags = [...new Set(cards.flatMap((c) => c.meta.tags))];
const chips = allTags.map((t) => `<button type="button" class="chip" data-tag="${esc(t.toLowerCase())}">${esc(t)}</button>`).join("");

const tpl = read(join(root, "site/index.template.html"));
writeFileSync(join(out, "index.html"), tpl.replace("<!--CARDS-->", cardHtml).replace("<!--CHIPS-->", chips).replace("<!--COUNT-->", String(cards.length)));
writeFileSync(join(out, ".nojekyll"), "");
console.log(`site built: ${cards.length} diagrams -> ${out}`);
