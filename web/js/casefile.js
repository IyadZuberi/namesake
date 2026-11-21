// Case file screen: ARIA tabs (arrow keys), Verdict / Customer / Why / Evidence / What would change / Replay.
import { h, stamp, V, RESULT_ICON, RESULT_WORD, canonical, sha256Hex, store, stateBox } from "./util.js";
import { LINK_TEXT, resolveEvidence } from "./data.js";
import { pathModel, orderedList, renderGraph, legend } from "./graph.js";

const TABS = [["verdict", "Verdict"], ["customer", "Customer"], ["why", "Why"], ["evidence", "Evidence"], ["change", "What would change this"], ["replay", "Replay"]];

export function caseView(cases, id, tab) {
  const c = cases.find((x) => x.case_id === id);
  if (!c) return stateBox("No such case", "There is no case “" + id + "” in the loaded data. Try the queue.", "err");
  let cur = TABS.some((t) => t[0] === tab) ? tab : "verdict";
  const panels = {}, built = {};
  const list = h("div", { class: "ftabs", role: "tablist", "aria-label": "Case file sections" });
  const body = h("div", { class: "panelhost" });
  const btns = TABS.map(([key, label]) => {
    const b = h("button", { role: "tab", id: "tab-" + key, "aria-controls": "panel-" + key, type: "button", onClick: () => select(key, true) }, label);
    list.append(b); return b;
  });
  list.addEventListener("keydown", (e) => {
    const i = TABS.findIndex((t) => t[0] === cur), n = TABS.length;
    const j = { ArrowRight: (i + 1) % n, ArrowLeft: (i + n - 1) % n, Home: 0, End: n - 1 }[e.key];
    if (j == null) return;
    e.preventDefault(); select(TABS[j][0], true); btns[j].focus();
  });
  function select(key, push) {
    cur = key;
    TABS.forEach(([k], i) => { btns[i].setAttribute("aria-selected", String(k === key)); btns[i].tabIndex = k === key ? 0 : -1; });
    if (!built[key]) { // build lazily so the graph measures edges while visible
      built[key] = true;
      panels[key] = h("div", { class: "panel", role: "tabpanel", id: "panel-" + key, "aria-labelledby": "tab-" + key, tabindex: 0 }, BUILD[key](c, select));
    }
    body.replaceChildren(panels[key]);
    if (push) history.replaceState(null, "", "#/case/" + c.case_id + "/" + key);
  }
  const d = c.decision;
  const root = h("div", null,
    h("p", { class: "small" }, h("a", { href: "#/queue" }, "← Queue")),
    h("div", { class: "casehead" }, h("div", null, h("div", { class: "eyebrow" }, "Case " + c.case_id + " · hit " + d.hit_id + " · alert " + d.alert_id), h("h1", null, c.title || c.case_id)), stamp(d.decision, false)),
    list, body);
  select(cur, false);
  return root;
}

const BUILD = {
  verdict(c, select) {
    const d = c.decision, key = "namesake.notes." + c.case_id;
    const saved = h("ul", { class: "log", "aria-label": "Your saved notes" });
    const draw = () => saved.replaceChildren(...store.get(key, []).map((n) => h("li", null, h("b", null, n.action), " · ", h("span", { class: "mono small" }, n.at), n.note ? h("div", null, n.note) : null)));
    const note = h("textarea", { id: "n-" + c.case_id, rows: 3, "aria-label": "Note for approve or override" });
    const act = (action) => { const l = store.get(key, []); l.push({ action, note: note.value.trim(), at: new Date().toISOString() }); store.set(key, l); note.value = ""; draw(); };
    draw();
    return [
      h("div", { class: "row" }, stamp(d.decision, true), h("span", { class: "mono" }, d.reason_code)),
      h("h2", null, "Reason"),
      h("p", null, d.reason),
      h("div", { class: "eyebrow" }, "Customer record: " + (d.customer_record_id ?? "none")),
      h("div", { class: "eyebrow" }, "Evidence cited (click to read the record)"),
      h("div", { class: "row" }, d.evidence.map((e) => h("button", { class: "ev", type: "button", onClick: () => { select("evidence", true); } }, e))),
      h("hr", { class: "rule" }),
      h("h3", null, "Analyst action"),
      h("p", { class: "small muted" }, "Approve keeps this decision; Override records that you disagree. Saved in this browser only (localStorage). Nothing is sent anywhere."),
      h("label", { for: "n-" + c.case_id }, "Note (optional)"), note,
      h("div", { class: "row" }, h("button", { class: "btn", type: "button", onClick: () => act("Approved") }, "Approve"), h("button", { class: "btn ghost", type: "button", onClick: () => act("Overridden") }, "Override")),
      saved,
    ];
  },
  customer(c) {
    const t = c.trace || {};
    return [
      h("h2", null, "How we found the customer"),
      h("p", null, LINK_TEXT[t.linked_via] || "No link information in this bundle."),
      h("p", { class: "mono small" }, "linked_via = " + (t.linked_via || "n/a")),
      h("h3", null, "Persons"),
      (t.persons || []).map((p, i) => h("div", { class: "sheet" },
        h("div", { class: "eyebrow" }, "Person " + (t.persons.length > 1 ? "ABCDEFGH"[i] : "1") + (p.merged_by && p.merged_by !== "none" ? " · merged by " + p.merged_by : "")),
        h("dl", { class: "kv" },
          h("dt", null, "Records"), h("dd", { class: "mono" }, p.record_ids.join(", ")),
          h("dt", null, "Verified name"), h("dd", null, p.verified.name || "none"),
          h("dt", null, "Verified DOB"), h("dd", { class: "mono" }, p.verified.dob || "none"),
          h("dt", null, "Verified from"), h("dd", { class: "mono" }, (p.verified.source_id || "none") + (p.verified.how ? " (" + p.verified.how + ")" : "")),
          h("dt", null, "Countries"), h("dd", null, p.countries.map((x) => h("span", { class: "ev" }, x.value + " · " + x.kind + " · " + x.source_id), " ")),
          p.decision ? [h("dt", null, "If this person alone"), h("dd", null, h("span", { class: "mono" }, p.decision + " / " + p.reason_code))] : null))),
      !(t.persons || []).length ? stateBox("No person resolved", "The engine found no customer record for this alert.") : null,
    ];
  },
  why(c) {
    const m = pathModel(c);
    if (!m) return stateBox("No trace in this bundle", "This case has no trace.graph. Run the engine with --trace to include one.");
    const panel = h("aside", { class: "sidepanel", "aria-live": "polite" }, h("p", { class: "muted" }, "Select a node to see its record id, value and quote."));
    return [
      h("h2", null, "Why: the decisive path"),
      h("p", { class: "muted" }, "Only the records and rules that drove this decision are drawn (" + m.nodes.length + " of " + m.all.nodes.length + " nodes)."),
      h("h3", null, "As a list"), orderedList(c, m),
      h("h3", null, "As a graph"), legend(),
      h("div", { class: "graphwrap" }, renderGraph(c, m, panel), panel),
    ];
  },
  evidence(c) {
    const items = c.decision.evidence.map((id) => resolveEvidence(c, id));
    const gq = ((c.trace && c.trace.gates) || []).flatMap((g) => g.facts.filter((f) => f.quote).map((f) => ({ g: g.gate, f })));
    return [
      h("h2", null, "Evidence"),
      h("p", { class: "muted" }, "Only the records that decided this hit. Quotes are the exact text of the record."),
      items.map((r) => h("div", { class: "sheet", id: "ev-" + r.id },
        h("div", { class: "eyebrow" }, r.kind), h("h3", { class: "mono" }, r.id),
        r.missing ? h("p", { class: "muted" }, "This id is not present in the bundle.") : null,
        r.quote ? h("blockquote", null, r.quote) : null,
        r.quote ? null : h("dl", { class: "kv" }, Object.entries(r.fields).filter(([, v]) => v != null && typeof v !== "object").slice(0, 12).flatMap(([k, v]) => [h("dt", null, k), h("dd", { class: "mono" }, String(v))])))),
      gq.length ? [h("h3", null, "Quotes the rules relied on"), gq.map((x) => h("div", null, h("span", { class: "ev" }, x.g + " · " + x.f.source_id), h("blockquote", null, x.f.quote)))] : null,
    ];
  },
  change(c) {
    const t = c.trace || {};
    return [
      h("h2", null, "What would change this"),
      h("p", { class: "sheet" }, t.one_fact || "No single-fact summary in this bundle."),
      h("h3", null, "Every rule, in policy order"),
      (t.gates || []).map((g) => h("div", { class: "gate " + g.result },
        h("h3", null, RESULT_ICON[g.result] + " " + g.gate + (g.person ? " (" + g.person + ")" : "") + " – " + (RESULT_WORD[g.result] || g.result)),
        h("div", null, g.explain), g.blocked_by ? h("div", { class: "small muted" }, "Blocked by: " + g.blocked_by) : null)),
    ];
  },
  replay(c) {
    const text = canonical(c.decision), out = h("code", { class: "hash" }, "computing…");
    sha256Hex(text).then((x) => out.replaceChildren(x || "Hashing needs a secure page (https or localhost)."));
    const cmd = "python tools/replay.py " + c.decision.hit_id, st = h("span", { class: "small muted", role: "status" });
    return [
      h("h2", null, "Replay"),
      h("p", null, "The decision below was precomputed at build time. The hash is of the decision as displayed here, computed in your browser (SHA-256 over canonical JSON: sorted keys, no whitespace). It is not a live replay of the engine."),
      h("div", { class: "eyebrow" }, "SHA-256 of the displayed decision"), out,
      h("div", { class: "eyebrow" }, "Canonical JSON that was hashed"), h("pre", { class: "cmd" }, text),
      h("div", { class: "eyebrow" }, "To replay it with the real engine, run this in the repository"), h("pre", { class: "cmd" }, cmd),
      h("div", { class: "row" }, h("button", { class: "btn ghost", type: "button", onClick: async () => { try { await navigator.clipboard.writeText(cmd); st.textContent = "Copied."; } catch { st.textContent = "Copy failed: select the command above."; } } }, "Copy command"), st),
    ];
  },
};
