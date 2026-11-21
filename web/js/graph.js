// Decisive-path view: (1) an ordered list (the accessible form), (2) an SVG of ONLY the decisive path.
// Fixed column layout, no force simulation. Columns: Alert > customer records > verified facts > hit facts > rule > decision.
import { h, s, RESULT_ICON, reduceMotion } from "./util.js";
import { resolveEvidence } from "./data.js";

const COLS = ["Alert", "Customer records", "Verified facts", "Hit facts", "Rule", "Decision"];
const col = (n) => ({ Alert: 0, CustomerRecord: 1, Account: 1, KycCheck: 1, Note: 1, Fact: n.side === "hit" ? 3 : 2, Hit: 3, SearchResult: 3, Gate: 4, Decision: 5 })[n.type] ?? 1;
const GLYPH = { agrees: "✓", contradicts: "✕", neutral: "" };
const W = 150, H = 42, CW = 170, GAP = 16, TOP = 30;

export function pathModel(c) {
  const g = c.trace && c.trace.graph;
  if (!g || !g.nodes) return null;
  const on = new Set(g.decisive_path || []);
  const nodes = g.nodes.filter((n) => on.has(n.id));
  const edges = g.edges.filter((e) => on.has(e.src) && on.has(e.dst));
  return { nodes, edges, all: g };
}

function verdictOut(model, id) { // verdict of the edge leaving a node, as words
  const e = model.edges.find((x) => x.src === id && x.verdict !== "neutral");
  return e ? (e.verdict === "agrees" ? "agrees" : "contradicts") : null;
}

export function orderedList(c, model) {
  return h("ol", { class: "pathlist", "aria-label": "Decisive path, in order" },
    model.nodes.map((n) => {
      const v = verdictOut(model, n.id);
      return h("li", null, h("b", null, n.label), " ", h("span", { class: "muted small" }, "(" + n.type + (n.source_id ? ", from " + n.source_id : "") + ")"),
        v ? h("span", { class: "small" }, " – " + (v === "agrees" ? "✓ agrees" : "✕ contradicts")) : null,
        n.missing ? h("span", { class: "small" }, " – ? missing fact (dashed)") : null);
    }));
}

export function renderGraph(c, model, panel) {
  const cols = COLS.map(() => []);
  model.nodes.forEach((n) => cols[col(n)].push(n));
  const rows = Math.max(...cols.map((x) => x.length));
  const hgt = TOP + rows * (H + GAP) + 6, wid = COLS.length * CW + 10;
  const pos = {};
  cols.forEach((list, ci) => {
    const off = (rows - list.length) * (H + GAP) / 2;
    list.forEach((n, i) => { pos[n.id] = { x: 8 + ci * CW, y: TOP + off + i * (H + GAP), n }; });
  });
  const svg = s("svg", { viewBox: "0 0 " + wid + " " + hgt, role: "group", "aria-label": "Decisive-path graph for " + c.case_id });
  COLS.forEach((t, i) => svg.append(s("text", { class: "colhead", x: 8 + i * CW, y: 16 }, t)));

  const paths = [];
  model.edges.forEach((e, i) => {
    const a = pos[e.src], b = pos[e.dst];
    if (!a || !b) return;
    let d, mx, my;
    if (a.x === b.x) { // same column (record -> its check): straight vertical link
      const down = b.y > a.y, x = a.x + 14;
      d = "M" + x + " " + (down ? a.y + H : a.y) + " L" + x + " " + (down ? b.y : b.y + H); mx = x; my = (a.y + b.y + H) / 2;
    } else {
      const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, k = (x2 - x1) / 2;
      d = "M" + x1 + " " + y1 + " C" + (x1 + k) + " " + y1 + " " + (x2 - k) + " " + y2 + " " + x2 + " " + y2; mx = (x1 + x2) / 2; my = (y1 + y2) / 2;
    }
    const p = s("path", { d, class: "edge onpath " + (e.verdict === "agrees" ? "agrees" : e.verdict === "contradicts" ? "contradicts" : "") + (b.n.missing ? " dashed" : "") });
    p.style.setProperty("--i", i);
    paths.push(p); svg.append(p);
    if (GLYPH[e.verdict]) { // text glyph so verdict never relies on colour
      svg.append(s("circle", { cx: mx, cy: my, r: 8, fill: "#FFFDF7", stroke: "#1B1A17", "stroke-width": 1 }), s("text", { x: mx, y: my + 4, "text-anchor": "middle", "font-size": 11, "font-weight": 700, "font-family": "system-ui", fill: "#1B1A17" }, GLYPH[e.verdict]));
    }
  });

  const els = [];
  model.nodes.forEach((n) => {
    const p = pos[n.id];
    const label = n.label.length > 24 ? n.label.slice(0, 23) + "…" : n.label;
    const g = s("g", { class: "gnode onpath " + n.type + (n.missing ? " missing" : ""), tabindex: 0, role: "button", "aria-label": n.type + ": " + n.label + (n.missing ? " (missing fact)" : ""), transform: "translate(" + p.x + "," + p.y + ")" },
      s("rect", { width: W, height: H }), s("text", { x: 8, y: 17 }, (n.missing ? "? " : "") + label), s("text", { x: 8, y: 33, fill: "#6B675E", "font-size": 9, "font-family": "ui-monospace,Consolas,monospace" }, n.type));
    const pick = () => { els.forEach((x) => x.classList.remove("sel")); g.classList.add("sel"); showNode(c, model, n, panel); };
    g.addEventListener("click", pick);
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(); } });
    els.push(g); svg.append(g);
  });
  // edges draw in along the path; lengths are measured after the svg is in the DOM
  requestAnimationFrame(() => paths.forEach((p) => { let l = 400; try { l = Math.ceil(p.getTotalLength()) + 2; } catch { /* keep fallback */ } p.style.setProperty("--len", l); }));
  return h("div", { class: "graphscroll", tabindex: 0, "aria-label": "Graph, scrolls sideways on small screens" }, svg);
}

export function showNode(c, model, n, panel) {
  panel.replaceChildren(h("div", { class: "eyebrow" }, n.type), h("h3", null, n.label));
  const kv = h("dl", { class: "kv" });
  const add = (k, v) => v != null && v !== "" && kv.append(h("dt", null, k), h("dd", null, h("span", { class: "mono" }, String(v))));
  add("Node id", n.id);
  if (n.type === "Fact") { add("Value", n.missing ? "not given anywhere in the data" : n.value); add("Record id", n.source_id); if (n.quote) panel.append(h("blockquote", null, n.quote)); }
  else {
    const r = resolveEvidence(c, n.id);
    if (!r.missing) Object.entries(r.fields).forEach(([k, v]) => add(k, typeof v === "object" ? JSON.stringify(v) : v));
    const m = /^G(\d+)-/.exec(n.id), gate = m && c.trace.gates[+m[1]];
    if (gate) add("Explain", gate.explain);
  }
  panel.append(kv);
}

export function legend() {
  return h("div", { class: "legend" },
    h("span", null, h("i", { class: "agrees" }), "✓ agrees"), h("span", null, h("i", { class: "contradicts" }), "✕ contradicts"),
    h("span", null, h("i", { class: "dashed" }), "dashed = missing fact"), h("span", null, "Glow = decisive path. Click or press Enter on a node."));
}
