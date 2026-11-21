// Queue: cases sorted by risk, summary counts computed from the data, filter chips.
import { h, pill, stateBox } from "./util.js";
import { byRisk } from "./data.js";

const FILTERS = [["all", "All"], ["SAME_ENTITY", "Same person"], ["REVIEW", "Needs a human"], ["DIFFERENT_ENTITY", "Cleared"]];

export function queueView(cases, source) {
  if (!cases.length) return stateBox("The queue is empty", "No cases in the loaded data.");
  const sorted = [...cases].sort(byRisk);
  const n = (d) => cases.filter((c) => c.decision.decision === d).length;
  let f = "all";
  const tbody = h("tbody"), count = h("p", { class: "small muted", role: "status" });
  const chips = FILTERS.map(([k, label]) => h("button", { class: "chip", type: "button", "aria-pressed": String(k === f), onClick: () => { f = k; chips.forEach((b, i) => b.setAttribute("aria-pressed", String(FILTERS[i][0] === k))); draw(); } }, label));
  const empty = stateBox("Nothing in this filter", "Pick another filter to see the other cases.");
  const tableWrap = h("div", { class: "tablewrap" }, h("table", null,
    h("caption", { class: "small muted" }, "Sorted by risk: same person, then needs a human, then cleared."),
    h("thead", null, h("tr", null, ["Case", "Customer", "Hit", "Decision", "Reason code", "Found via"].map((t) => h("th", { scope: "col" }, t)))), tbody));
  function draw() {
    const rows = sorted.filter((c) => f === "all" || c.decision.decision === f);
    tbody.replaceChildren(...rows.map((c) => h("tr", null,
      h("td", null, h("a", { href: "#/case/" + c.case_id }, c.title || c.case_id), h("div", { class: "mono small muted" }, c.case_id)),
      h("td", null, c.alert.customer.name), h("td", null, c.hit.name, h("div", { class: "mono small muted" }, c.hit.hit_id)),
      h("td", null, pill(c.decision.decision)), h("td", { class: "mono small" }, c.decision.reason_code), h("td", { class: "small" }, (c.trace && c.trace.linked_via) || "n/a"))));
    count.textContent = rows.length + " of " + cases.length + " case" + (cases.length === 1 ? "" : "s") + " shown.";
    tableWrap.hidden = !rows.length; empty.hidden = !!rows.length;
  }
  draw();
  const kpi = (cls, num, label) => h("div", { class: "kpi " + cls }, h("b", null, String(num)), h("span", null, label));
  return h("div", null,
    h("div", { class: "eyebrow" }, "Queue"), h("h1", null, "Cases by risk"),
    h("div", { class: "kpis", role: "group", "aria-label": "Summary" }, kpi("", cases.length, "cases in " + source), kpi("clear", n("DIFFERENT_ENTITY"), "cleared (different person)"), kpi("same", n("SAME_ENTITY"), "same person"), kpi("review", n("REVIEW"), "need a human")),
    h("div", { class: "row", role: "group", "aria-label": "Filter by decision" }, chips), count, tableWrap, empty);
}
