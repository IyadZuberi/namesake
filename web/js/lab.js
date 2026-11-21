// Lab: edit a customer and a hit, see the decision from the simplified in-browser rules.
import { h, stamp, RESULT_ICON, RESULT_WORD } from "./util.js";
import { decide, custFromCase, hitFromCase } from "./policy.js";

const CF = [["name", "Verified legal name"], ["dob", "Date of birth (YYYY, YYYY-MM or YYYY-MM-DD)"], ["countries", "Countries (comma separated)"], ["type", "Entity type", ["Individual", "Company"]], ["screened", "Screened on (YYYY-MM-DD)"]];
const HF = [["name", "Hit name"], ["aliases", "Aliases (comma separated)"], ["dob", "Hit birth date(s)"], ["countries", "Hit countries"], ["type", "Entity type", ["Individual", "Company"]], ["deceased", "Deceased date"], ["report", "Earliest dated report"]];

export function labView(cases) {
  const base = cases[0];
  const cust = custFromCase(base), hit = hitFromCase(base);
  const out = h("div", { "aria-live": "polite" });
  const field = (model, [k, label, opts]) => {
    const id = "lab-" + (model === cust ? "c-" : "h-") + k;
    const el = opts ? h("select", { id }, opts.map((o) => h("option", { value: o, selected: o === model[k] }, o))) : h("input", { id, type: "text", value: model[k] ?? "", autocomplete: "off" });
    el.addEventListener("input", () => { model[k] = el.value; draw(); });
    el.dataset.k = k; el.dataset.m = model === cust ? "c" : "h";
    return h("div", { class: "field" }, h("label", { for: id }, label), el);
  };
  const form = h("div", { class: "grid2" },
    h("fieldset", { class: "sheet" }, h("legend", { class: "eyebrow" }, "Customer"), CF.map((f) => field(cust, f))),
    h("fieldset", { class: "sheet" }, h("legend", { class: "eyebrow" }, "Hit"), HF.map((f) => field(hit, f))));
  const pick = h("select", { id: "lab-load" }, cases.map((c) => h("option", { value: c.case_id }, c.case_id + " · " + (c.title || ""))));
  pick.addEventListener("change", () => {
    const c = cases.find((x) => x.case_id === pick.value);
    Object.assign(cust, custFromCase(c)); Object.assign(hit, hitFromCase(c));
    form.querySelectorAll("[data-k]").forEach((el) => { el.value = (el.dataset.m === "c" ? cust : hit)[el.dataset.k] ?? ""; });
    draw();
  });
  function draw() {
    const r = decide(cust, hit);
    out.replaceChildren(
      h("div", { class: "sheet" },
        h("div", { class: "row" }, stamp(r.decision, true), h("span", { class: "mono" }, r.reason_code)),
        h("h3", null, "Rule trace"),
        r.gates.map((g) => h("div", { class: "gate " + g.result }, h("h3", null, RESULT_ICON[g.result] + " " + g.gate + " – " + RESULT_WORD[g.result]), h("div", null, g.explain))),
        h("h3", null, "Which fact would change it"), h("p", null, r.one_fact)));
  }
  draw();
  return h("div", null,
    h("div", { class: "eyebrow" }, "Lab"), h("h1", null, "Edit the facts, watch the rule"),
    h("p", { class: "sheet small" }, "Simplified in-browser demo of the rules; the real engine is Python. This demo does not claim to equal the engine: it covers only the type, deceased, time, date of birth, location and name gates, for one person at a time (no joint holders, so S-0005 differs from its case decision), on typed-in values, with a small country list and no name_variants.json."),
    h("div", { class: "field" }, h("label", { for: "lab-load" }, "Start from a sample case"), pick), form, out);
}
