import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { readFileSync, mkdirSync } from "node:fs";
mkdirSync("shots", { recursive: true });
const svg = readFileSync("svg/request-flow.svg", "utf8");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1040, height: 600 } });
await p.setContent(`<body style="margin:20px;background:#fff">${svg}</body>`);
for (const s of [0.5, 1.5, 3, 4.5, 5.2, 7, 10, 12, 14]) {
  await p.evaluate((s) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = s * 1000 + (a.effect.getTiming().delay > 0 ? 0 : 0); }), s);
  await p.screenshot({ path: `shots/svg-${s}.png` });
}
await b.close();
