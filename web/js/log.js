// Run log: pipeline steps with owner (Engine / Analyst). Uses trace.steps if a bundle provides it, else static text.
import { h } from "./util.js";

const STATIC = [
  ["Load", "Engine", "Read the data folder: alerts, customers, accounts, onboarding, KYC checks, notes, hits, search results."],
  ["Resolve customer", "Engine", "Follow the alert's link, or search by name, date of birth, country and city; merge records of one person."],
  ["Resolve hit", "Engine", "Gather the hit's birth dates, countries, dated reports and death date."],
  ["Gates", "Engine", "Run TIME, DECEASED, DOB, LOCATION, NAME and TYPE; a clear needs a contradiction."],
  ["Decide", "Engine", "DIFFERENT_ENTITY, SAME_ENTITY or REVIEW, with one reason code and the records relied on."],
  ["Explain", "Engine", "Template reason from derived facts, evidence ids, graph and the one fact that would change it."],
  ["Sign-off", "Analyst", "A person approves or overrides; here that is stored in this browser only."],
];

export function logView(cases) {
  const withSteps = cases.find((c) => c.trace && Array.isArray(c.trace.steps));
  const steps = withSteps ? withSteps.trace.steps.map((x) => [x.step, x.owner, x.note || ""]) : STATIC;
  return h("div", null,
    h("div", { class: "eyebrow" }, "Run log"), h("h1", null, "Pipeline steps"),
    h("p", { class: "muted" }, withSteps ? "Steps and owners come from the case trace." : "Static description: the loaded cases carry no per-step timing, so none is shown."),
    h("ol", { class: "log" }, steps.map(([t, o, d]) => h("li", { class: "sheet" }, h("div", { class: "row" }, h("b", null, t), h("span", { class: "owner " + String(o).toLowerCase() }, o)), h("p", { class: "muted" }, d)))));
}
