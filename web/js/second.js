// Second Opinion: compare a pasted/uploaded decisions JSONL against our case decisions. Runs fully in the browser.
import { h, pill } from "./util.js";

const MAP = { TRUE_POSITIVE: "SAME_ENTITY", FALSE_POSITIVE: "DIFFERENT_ENTITY", UNRESOLVED: "REVIEW" }; // untested against a real export
const OK = new Set(["DIFFERENT_ENTITY", "SAME_ENTITY", "REVIEW"]);
const MAX_BYTES = 5 * 1024 * 1024;

/** cost of the disagreement if OUR decision is right */
export function cost(theirs, ours) {
  if (theirs === ours) return 0;
  if (theirs === "DIFFERENT_ENTITY") return 60;           // they cleared what we call same/review
  if (ours === "DIFFERENT_ENTITY") return 3;              // they flagged what we cleared
  return 2;                                               // SAME <-> REVIEW
}

export function parseJsonl(text) {
  const rows = [], bad = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    try {
      const o = JSON.parse(line), d = OK.has(o.decision) ? o.decision : MAP[o.determination];
      if (!o || typeof o.hit_id !== "string" || !d) throw new Error("needs hit_id and decision or determination");
      rows.push({ hit_id: o.hit_id, theirs: d });
    } catch (e) { bad.push("line " + (i + 1) + ": " + e.message); }
  });
  return { rows, bad };
}

export function compare(cases, rows) {
  const ours = new Map(cases.map((c) => [c.decision.hit_id, c]));
  const out = { agree: 0, unknown: 0, diffs: [] };
  rows.forEach((r) => {
    const c = ours.get(r.hit_id);
    if (!c) { out.unknown++; return; }
    const k = cost(r.theirs, c.decision.decision);
    if (!k) out.agree++; else out.diffs.push({ hit_id: r.hit_id, theirs: r.theirs, ours: c.decision.decision, code: c.decision.reason_code, cost: k, case_id: c.case_id });
  });
  out.diffs.sort((a, b) => b.cost - a.cost || a.hit_id.localeCompare(b.hit_id));
  return out;
}

export function secondView(cases) {
  const ta = h("textarea", { id: "so-in", rows: 8, placeholder: '{"hit_id":"H-000001","decision":"SAME_ENTITY"}\n{"hit_id":"H-000002","determination":"FALSE_POSITIVE"}' });
  const result = h("div", { "aria-live": "polite" }, h("div", { class: "state" }, h("p", null, "No decisions loaded yet. Paste a JSONL file, upload one, or load the synthetic example.")));
  const file = h("input", { type: "file", id: "so-file", accept: ".jsonl,.json,.txt" });
  file.addEventListener("change", async () => {
    const f = file.files[0]; if (!f) return;
    if (f.size > MAX_BYTES) { result.replaceChildren(h("div", { class: "state err", role: "alert" }, "File is over 5 MB. Nothing was read.")); return; }
    ta.value = await f.text(); run();
  });
  function run() {
    const { rows, bad } = parseJsonl(ta.value);
    if (!rows.length) { result.replaceChildren(h("div", { class: "state err", role: "alert" }, h("h2", null, "No usable lines"), h("p", null, bad.length ? bad.slice(0, 5).join("; ") : "The input is empty."))); return; }
    const r = compare(cases, rows), pairs = {};
    r.diffs.forEach((d) => { const k = d.theirs + " vs " + d.ours; pairs[k] = (pairs[k] || 0) + 1; });
    result.replaceChildren(
      h("div", { class: "kpis" },
        h("div", { class: "kpi clear" }, h("b", null, String(r.agree)), h("span", null, "agree")),
        h("div", { class: "kpi same" }, h("b", null, String(r.diffs.length)), h("span", null, "disagree")),
        h("div", { class: "kpi" }, h("b", null, String(r.unknown)), h("span", null, "hit ids not in these cases")),
        h("div", { class: "kpi" }, h("b", null, String(bad.length)), h("span", null, "unreadable lines"))),
      bad.length ? h("p", { class: "small" }, "Skipped: " + bad.slice(0, 3).join("; ") + (bad.length > 3 ? " …" : "")) : null,
      r.diffs.length ? h("div", { class: "tablewrap" }, h("table", null, h("caption", { class: "small muted" }, "Disagreements, highest cost first"),
        h("thead", null, h("tr", null, ["Hit", "Theirs", "Ours", "Our reason code", "Cost", "Case"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", null, r.diffs.map((d) => h("tr", null, h("td", { class: "mono" }, d.hit_id), h("td", null, pill(d.theirs)), h("td", null, pill(d.ours)), h("td", { class: "mono small" }, d.code), h("td", null, h("b", null, String(d.cost))), h("td", null, h("a", { href: "#/case/" + d.case_id }, d.case_id))))))) : h("div", { class: "state" }, h("p", null, "No disagreements on the hits we could match.")),
      Object.keys(pairs).length ? h("p", { class: "small muted" }, "By pair: " + Object.entries(pairs).map(([k, v]) => k + " ×" + v).join("; ")) : null);
  }
  const example = () => {
    // synthetic example: ours, with the first case flipped to a dangerous clear and another to a flagged clear
    ta.value = cases.map((c, i) => JSON.stringify({ hit_id: c.decision.hit_id, decision: i === 3 ? "DIFFERENT_ENTITY" : i === 0 ? "SAME_ENTITY" : c.decision.decision })).join("\n"); run();
  };
  return h("div", null,
    h("div", { class: "eyebrow" }, "Second Opinion"), h("h1", null, "Check another system’s decisions"),
    h("p", null, "Paste or upload a decisions file (JSONL, one hit per line). It is compared with the decisions for the cases loaded here, entirely in your browser. Nothing is uploaded."),
    h("div", { class: "sheet" }, h("p", { class: "small" }, "This ranks the cost of the disagreement assuming our decision is right; it does not prove which side is right."),
      h("p", { class: "small" }, "Accepted: the scored shape (", h("code", null, "hit_id, decision"), ") or Diligent-style ", h("code", null, "determination"), " (TRUE_POSITIVE = SAME_ENTITY, FALSE_POSITIVE = DIFFERENT_ENTITY, UNRESOLVED = REVIEW). Diligent-format mapping untested against a real export."),
      h("p", { class: "small" }, "Cost if ours is right: they cleared what we call same or review = 60; they flagged what we cleared = 3; same versus review = 2."),
      h("div", { class: "field" }, h("label", { for: "so-in" }, "Decisions JSONL"), ta),
      h("div", { class: "field" }, h("label", { for: "so-file" }, "Or choose a file"), file),
      h("div", { class: "row" }, h("button", { class: "btn", type: "button", onClick: run }, "Compare"), h("button", { class: "btn ghost", type: "button", onClick: example }, "Load synthetic example"))),
    h("div", { class: "sheet" }, h("h2", null, "Result"), result));
}
