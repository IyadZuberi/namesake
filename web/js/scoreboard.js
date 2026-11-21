// Scoreboard: aggregates only, from data/scoreboard.json. Missing -> "not yet measured". Never invents numbers.
import { h, stateBox } from "./util.js";

const NM = "not yet measured";
const LINES = [
  ["decision_score", "Practice score", "tuned on these 50; not held out"], ["unsafe_clearances", "Unsafe clears", "a real match cleared"],
  ["review_rate", "Review rate", "share sent to a human"], ["clearance_precision", "Clear precision", ""], ["same_recall", "Same-person recall", ""],
  ["reason_code_pct", "Reason code match %", ""], ["customer_record_pct", "Customer record match %", ""], ["run_seconds", "Run time (s)", ""],
];

export async function scoreboardView() {
  let sb = null, err = null;
  try { const r = await fetch("data/scoreboard.json", { cache: "no-cache" }); if (r.ok) sb = await r.json(); } catch (e) { err = e; }
  const val = (v) => (typeof v === "number" || (typeof v === "string" && v.length < 40) ? String(v) : null);
  const card = ([k, label, sub]) => { const v = sb ? val(sb[k]) : null; return h("div", { class: "kpi" }, v != null ? h("b", null, v) : h("div", { class: "notmeasured" }, NM), h("span", null, label + (sub ? " · " + sub : ""))); };
  const rp = sb && sb.repro && typeof sb.repro === "object" ? sb.repro : null;
  const conf = sb && sb.confusion && typeof sb.confusion === "object" ? sb.confusion : null;
  const fd = sb && sb.fire_drill && typeof sb.fire_drill === "object" ? sb.fire_drill : null;
  return h("div", null,
    h("div", { class: "eyebrow" }, "Scoreboard"), h("h1", null, "Measured in public"),
    h("p", null, "Aggregates only: no hit ids, no names, no label text. A value shows “" + NM + "” until a real run has produced it."),
    sb ? h("p", { class: "small muted" }, "Source: " + (val(sb.source) || "unknown") + (sb.generated_at ? " · generated " + val(sb.generated_at) : "")) : stateBox("No scoreboard file yet", "data/scoreboard.json is absent, so every number below is " + NM + ".", err ? "err" : ""),
    h("div", { class: "kpis" }, LINES.slice(0, 4).map(card)), h("div", { class: "kpis" }, LINES.slice(4).map(card)),
    h("div", { class: "grid2" },
      h("section", { class: "sheet" }, h("h2", null, "5-run sameness"), rp ? h("p", null, val(rp.identical) + " of " + val(rp.runs) + " runs byte-identical.", rp.fingerprint ? h("code", { class: "hash" }, val(rp.fingerprint)) : null) : h("div", { class: "notmeasured" }, NM)),
      h("section", { class: "sheet" }, h("h2", null, "Fire Drill pass rates"), fd ? h("ul", null, Object.entries(fd).map(([k, v]) => h("li", null, k + ": " + (val(v) ?? NM)))) : h("div", { class: "notmeasured" }, NM))),
    h("section", { class: "sheet" }, h("h2", null, "Confusion grid"), conf ? grid(conf) : h("div", { class: "notmeasured" }, NM)));
}

function grid(conf) { // rows = outer key, columns = inner key, exactly as in the file
  const rows = Object.keys(conf), cols = [...new Set(rows.flatMap((r) => Object.keys(conf[r] || {})))];
  return h("div", { class: "tablewrap" }, h("table", null, h("caption", { class: "small muted" }, "Row = outer key, column = inner key in scoreboard.json"),
    h("thead", null, h("tr", null, h("th", { scope: "col" }, ""), cols.map((c) => h("th", { scope: "col" }, c)))),
    h("tbody", null, rows.map((r) => h("tr", null, h("th", { scope: "row" }, r), cols.map((c) => h("td", { class: "mono" }, String((conf[r] || {})[c] ?? 0))))))));
}
