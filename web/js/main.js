// Hash router + loading/error states. Routes: #/ #/lab #/queue #/case/ID[/tab] #/second-opinion #/scoreboard #/log
import { h, stateBox } from "./util.js";
import { loadCases } from "./data.js";
import { landingView } from "./landing.js";
import { labView } from "./lab.js";
import { queueView } from "./queue.js";
import { caseView } from "./casefile.js";
import { secondView } from "./second.js";
import { scoreboardView } from "./scoreboard.js";
import { logView } from "./log.js";

const app = document.getElementById("app");
const NAV = { "": "home", lab: "lab", queue: "queue", case: "queue", "second-opinion": "second-opinion", scoreboard: "scoreboard", log: "log" };
let token = 0;

async function render() {
  const me = ++token;
  const [, route = "", a, b] = location.hash.replace(/^#/, "").split("/").map(decodeURIComponent);
  document.querySelectorAll("#nav a").forEach((l) => (NAV[route] === l.dataset.r ? l.setAttribute("aria-current", "page") : l.removeAttribute("aria-current")));
  app.replaceChildren(h("div", { class: "wrap" }, h("div", { class: "skeleton w60" }), h("div", { class: "skeleton w40" }), h("span", { class: "skip-text", role: "status" }, "Loading…")));
  let node;
  try {
    if (route === "scoreboard") node = await scoreboardView();
    else {
      const { cases, source } = await loadCases();
      node = {
        "": () => landingView(cases), lab: () => labView(cases), queue: () => queueView(cases, source), case: () => caseView(cases, a, b),
        "second-opinion": () => secondView(cases), log: () => logView(cases),
      }[route]?.() ?? stateBox("Page not found", "There is no page at this address.", "err");
    }
  } catch (e) {
    node = stateBox("Could not load the data", "The case file did not load (" + e.message + "). Check that you are serving the site over http, not opening index.html directly.", "err");
    node.append(h("button", { class: "btn", type: "button", onClick: render }, "Try again"));
  }
  if (me !== token) return; // a newer navigation won
  app.replaceChildren(h("div", { class: "wrap" }, node));
  document.title = "Namesake" + (route ? " · " + route : "");
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", render);
render();
