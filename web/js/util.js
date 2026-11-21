// Small DOM + hashing helpers. No innerHTML anywhere: all text goes through text nodes (XSS-safe).
const SVGNS = "http://www.w3.org/2000/svg";

function apply(e, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.setAttribute("class", v);
    else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "value") e.value = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
}
const kids = (a) => a.flat(Infinity).filter((x) => x != null && x !== false);

/** h("div", {class:"x"}, "text", child) -> HTMLElement */
export function h(tag, attrs, ...children) {
  const e = document.createElement(tag);
  apply(e, attrs);
  e.append(...kids(children));
  return e;
}
/** s("rect", {...}) -> SVGElement */
export function s(tag, attrs, ...children) {
  const e = document.createElementNS(SVGNS, tag);
  apply(e, attrs);
  e.append(...kids(children));
  return e;
}

export const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// decision -> UI vocabulary (text + icon, never colour alone)
export const V = {
  DIFFERENT_ENTITY: { cls: "clear", word: "Different person", icon: "✓" },
  SAME_ENTITY: { cls: "same", word: "Same person", icon: "!" },
  REVIEW: { cls: "review", word: "Needs a human", icon: "?" },
};
export const RESULT_ICON = { contradiction: "✕", agreement: "✓", unknown: "?", not_applicable: "–", blocked: "⛔" };
export const RESULT_WORD = { contradiction: "contradicts", agreement: "agrees", unknown: "unknown", not_applicable: "not applicable", blocked: "clear blocked" };

export function stamp(decision, animate) {
  const v = V[decision] || { cls: "review", word: String(decision), icon: "?" };
  return h("span", { class: "stamp " + v.cls + (animate && !reduceMotion() ? " land" : "") }, v.icon + " " + v.word);
}
export function pill(decision) {
  const v = V[decision] || { cls: "review", word: String(decision), icon: "?" };
  return h("span", { class: "pill " + v.cls }, v.icon + " " + v.word);
}

/** Canonical JSON: keys sorted recursively, no whitespace. The hash input is exactly this string. */
export function canonical(x) {
  if (Array.isArray(x)) return "[" + x.map(canonical).join(",") + "]";
  if (x && typeof x === "object") return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + canonical(x[k])).join(",") + "}";
  return JSON.stringify(x);
}
export async function sha256Hex(text) {
  if (!(window.crypto && crypto.subtle)) return null; // needs https or localhost
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// localStorage that never throws (private mode, blocked storage)
export const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

export const stateBox = (title, text, cls) => h("div", { class: "state " + (cls || ""), role: cls === "err" ? "alert" : null }, h("h2", null, title), h("p", null, text));
