// Landing: headline, story, and the interactive "Two Mohammed Alis" walk.
import { h, stamp, reduceMotion } from "./util.js";
import { decide, custFromCase, hitFromCase } from "./policy.js";
import { LINK_TEXT } from "./data.js";

export function landingView(cases) {
  const hero = h("div", { class: "hero" },
    h("div", null,
      h("div", { class: "eyebrow" }, "Namesake · an open sanctions-screening checker"),
      h("h1", null, "Show why it’s a different person."),
      h("p", null, "A bank screens its customers against sanctions and PEP lists. Most alerts are namesakes: a different person with a similar name. Wrongly clearing a real match is the costliest mistake, so it is the one to guard against. AI agents that clear alerts ask you to trust them."),
      h("p", null, "Namesake is an open rules engine. Every decision comes from the written policy and names the records that decided it. A second mode compares another system’s decisions with ours and lists the disagreements by cost, assuming ours are right. Rules decide; AI never decides."),
      h("div", { class: "row" }, h("a", { class: "btn", href: "#/queue" }, "Open the case queue"), h("a", { class: "btn ghost", href: "#/second-opinion" }, "Try Second Opinion"))),
    walkCard(cases));
  return hero;
}

function walkCard(cases) {
  const opt = (v, t, sel) => h("option", { value: v, selected: sel }, t);
  const cs = h("select", { id: "w-cust" }, cases.map((c, i) => opt(c.case_id, c.alert.customer.name + " (" + c.case_id + ")", i === 0)));
  const hs = h("select", { id: "w-hit" }, cases.map((c, i) => opt(c.case_id, c.hit.name + " (" + c.hit.hit_id + ")", i === 0)));
  const steps = ["Found the customer", "Verified facts", "Hit facts", "Rule", "Verdict"].map((t) => h("li", null, h("b", null, t), h("span", { class: "small" }, "")));
  const stampBox = h("div", { class: "stampbox", "aria-live": "polite" });
  const note = h("p", { class: "small muted" });
  let timers = [];
  const set = (i, text) => { steps[i].lastChild.textContent = text; };

  function walk() {
    timers.forEach(clearTimeout); timers = [];
    steps.forEach((li) => li.classList.remove("on")); stampBox.replaceChildren(); note.replaceChildren();
    const cc = cases.find((c) => c.case_id === cs.value), hc = cases.find((c) => c.case_id === hs.value);
    const same = cc === hc;
    const cust = custFromCase(cc), hit = hitFromCase(hc);
    const r = same ? { decision: cc.decision.decision, reason_code: cc.decision.reason_code } : decide(cust, hit);
    const dec = r.decision;
    set(0, same ? (LINK_TEXT[cc.trace && cc.trace.linked_via] || "Customer resolved.") : "The screened customer, taken as given.");
    set(1, "Name " + cust.name + ", date of birth " + (cust.dob || "not given") + ", countries " + cust.countries + ".");
    set(2, "Hit " + hit.name + ": birth " + (hit.dob || "not given") + ", countries " + (hit.countries || "none") + (hit.report ? ", dated report " + hit.report : "") + ".");
    set(3, r.reason_code + (same ? " (from the case trace)" : " (simplified in-browser rules)"));
    set(4, "");
    const fin = () => {
      stampBox.replaceChildren(stamp(dec, true));
      note.replaceChildren(same ? h("span", null, "This pair is a real sample case. ", h("a", { href: "#/case/" + cc.case_id }, "Open the case file")) : "This customer and hit were not paired in the samples, so the verdict comes from the simplified in-browser rules, not the engine.");
    };
    if (reduceMotion()) { steps.forEach((li) => li.classList.add("on")); fin(); return; }
    steps.forEach((li, i) => timers.push(setTimeout(() => { li.classList.add("on"); if (i === steps.length - 1) fin(); }, 450 * (i + 1))));
  }
  return h("section", { class: "sheet", "aria-labelledby": "walk-h" },
    h("div", { class: "eyebrow" }, "Interactive"), h("h2", { id: "walk-h" }, "Two Mohammed Alis"),
    h("p", { class: "muted" }, "Pick a customer and a hit, then watch the walk."),
    h("div", { class: "grid2" }, h("div", { class: "field" }, h("label", { for: "w-cust" }, "Customer"), cs), h("div", { class: "field" }, h("label", { for: "w-hit" }, "Hit on the list"), hs)),
    h("button", { class: "btn", type: "button", onClick: walk }, "Walk"),
    h("ol", { class: "walk-steps", "aria-label": "Walk steps" }, steps), stampBox, note);
}
