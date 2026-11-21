// SIMPLIFIED in-browser port of the policy gates (TYPE, DECEASED, TIME, DOB, LOCATION, NAME).
// It is a demo of the written rules, NOT the engine: the real engine is Python and handles far more
// (customer resolution, joint holders, search results, 10 date formats, name_variants.json, written-together names).
// Never claim this equals the engine.

const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const PLACEHOLDER = new Set(["na", "n/a", "test", "unknown", "xxx", "none"]);
const LEGAL = new Set(["ltd", "llc", "gmbh", "sa", "ab", "inc", "plc", "co", "corp", "ag", "bv", "limited"]);

// tiny country table (ponytail: real engine uses full ISO + demonyms)
const COUNTRY = {
  GB: ["gb", "uk", "united kingdom", "british", "england"], US: ["us", "usa", "united states", "american"],
  CA: ["ca", "canada", "canadian"], AU: ["au", "australia", "australian"], DE: ["de", "germany", "german"],
  FR: ["fr", "france", "french"], ES: ["es", "spain", "spanish"], IT: ["it", "italy", "italian"], PT: ["pt", "portugal", "portuguese"],
  SE: ["se", "sweden", "swedish"], PL: ["pl", "poland", "polish"], IE: ["ie", "ireland", "irish"], EG: ["eg", "egypt", "egyptian"],
  VE: ["ve", "venezuela", "venezuelan"], BR: ["br", "brazil", "brazilian"], MY: ["my", "malaysia", "malaysian"], SG: ["sg", "singapore"],
  NG: ["ng", "nigeria", "nigerian"], GH: ["gh", "ghana", "ghanaian"], IN: ["in", "india", "indian"], CN: ["cn", "china", "chinese"],
  RU: ["ru", "russia", "russian"], TR: ["tr", "turkey", "turkish"], AE: ["ae", "uae", "united arab emirates"], MX: ["mx", "mexico", "mexican"],
};
const C_LOOKUP = new Map(Object.entries(COUNTRY).flatMap(([code, names]) => names.map((n) => [n, code])));
export const countries = (text) => [...new Set(String(text || "").split(/[,;]/).map((t) => norm(t).trim()).filter(Boolean).map((t) => C_LOOKUP.get(t) || t.toUpperCase()))];

// ---- dates: YYYY, YYYY-MM, YYYY-MM-DD only ----
export function parseDate(t) {
  const m = /^\s*(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?\s*$/.exec(String(t || ""));
  return m ? { y: +m[1], m: m[2] ? +m[2] : null, d: m[3] ? +m[3] : null } : null;
}
const dates = (text) => String(text || "").split(/[,;]/).map(parseDate).filter(Boolean);

// ---- names ----
function edits(a, b) { // Levenshtein
  const p = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = p[0]; p[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = p[j]; p[j] = Math.min(p[j] + 1, p[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return p[b.length];
}
function parts(name, company) {
  const ps = norm(name).replace(/\(.*?\)/g, " ").split(/[^a-z0-9]+/).filter((x) => x.length > 1 && !PLACEHOLDER.has(x) && !/^\d+$/.test(x));
  return [...new Set(company ? ps.filter((x) => !LEGAL.has(x)) : ps)];
}
function partsMatch(a, b) {
  if (a === b) return true;
  const n = Math.min(a.length, b.length);
  if (n < 4) return false;
  return edits(a, b) <= (n <= 6 ? 1 : 2);
}
/** "agreement" | "contradiction" | "unknown" for one customer name vs a list of hit names */
export function nameResult(custName, hitNames, company) {
  const cp = parts(custName, company);
  if (!company && cp.length < 2) return "unknown"; // placeholder / single-part individual name
  let any = false;
  for (const hn of hitNames) {
    const hp = parts(hn, company);
    if (!hp.length) continue;
    const [short, long] = cp.length <= hp.length ? [cp, hp] : [hp, cp];
    const matched = short.filter((x) => long.some((y) => partsMatch(x, y))).length;
    if (matched >= 2 || (short.length && matched === short.length)) return "agreement";
    any = true;
  }
  return any ? "contradiction" : "unknown";
}

// ---- gates ----
function dobResult(c, hs) {
  if (!c || !hs.length) return "unknown";
  let agree = false, allContra = true;
  for (const h of hs) {
    const yearDiff = Math.abs(c.y - h.y);
    const monthsDiffer = c.y === h.y && c.m && h.m && c.m !== h.m;
    const daysDiffer = c.y === h.y && c.m && h.m && c.m === h.m && c.d && h.d && c.d !== h.d;
    const contra = yearDiff > 1 || monthsDiffer || daysDiffer;
    const agrees = c.y === h.y && !contra;
    if (agrees) agree = true;
    if (!contra) allContra = false;
  }
  return agree ? "agreement" : allContra ? "contradiction" : "unknown";
}
const ageAt = (dob, on) => { // max possible age in whole years when parts are missing
  let a = on.y - dob.y;
  if (dob.m && on.m && (on.m < dob.m || (on.m === dob.m && dob.d && on.d && on.d < dob.d))) a -= 1;
  return a;
};
const g = (gate, result, explain) => ({ gate, result, explain });

/**
 * decide(cust, hit)
 * cust: {name, dob, countries, type: Individual|Company, screened}
 * hit:  {name, aliases, dob, countries, type, deceased, report}
 */
export function decide(cust, hit) {
  const company = cust.type === "Company" && hit.type === "Company";
  const gates = [];
  const cDob = parseDate(cust.dob), hDobs = dates(hit.dob);
  const cC = countries(cust.countries), hC = countries(hit.countries);

  const type = cust.type !== hit.type ? "contradiction" : "agreement";
  gates.push(g("TYPE", type, type === "agreement" ? "Both are " + cust.type.toLowerCase() + "s." : "One is a person and the other a company."));

  const dead = parseDate(hit.deceased), shot = parseDate(cust.screened);
  const deceased = dead && shot && (dead.y < shot.y || (dead.y === shot.y && (dead.m || 12) < (shot.m || 1))) ? "contradiction" : dead ? "agreement" : "not_applicable";
  gates.push(g("DECEASED", deceased, deceased === "contradiction" ? "The hit died before the customer was screened." : deceased === "agreement" ? "A death date is given but not before screening." : "No date of death given."));

  const rep = parseDate(hit.report);
  let time = "not_applicable", timeText = "No dated report given.";
  if (rep && cDob) {
    const bad = company ? cDob.y > rep.y : ageAt(cDob, rep) < 16;
    time = bad ? "contradiction" : "agreement";
    timeText = company ? (bad ? "Incorporated after the report date." : "Incorporated before the report date.") : "Customer was " + ageAt(cDob, rep) + " at the report date" + (bad ? " (the rule needs 16)." : ".");
  }
  gates.push(g("TIME", time, timeText));

  const dob = dobResult(cDob, hDobs);
  gates.push(g("DOB", dob, dob === "unknown" ? "No usable pair of dates: nothing agrees, nothing contradicts." : dob === "agreement" ? "A birth year of the hit equals the customer's, and every part both give is equal." : "Every birth date the hit gives is contradicted."));

  const loc = !cC.length || !hC.length ? "unknown" : cC.some((x) => hC.includes(x)) ? "agreement" : "contradiction";
  const hitNames = [hit.name, ...String(hit.aliases || "").split(/[,;]/)].map((x) => x.trim()).filter(Boolean);
  const name = nameResult(cust.name, hitNames, company);
  // policy 6: a country difference never clears a hit whose name and DOB agree
  const locBlocked = loc === "contradiction" && name === "agreement" && dob === "agreement";
  gates.push(g("LOCATION", locBlocked ? "blocked" : loc, locBlocked ? "Countries differ, but name and date of birth agree, so this cannot clear." : loc === "unknown" ? "A country is missing on one side." : loc === "agreement" ? "A country is shared." : "Every customer country differs from every hit country."));
  gates.push(g("NAME", name, name === "agreement" ? "At least two name parts match, or every part of the shorter name does." : name === "contradiction" ? "The verified name agrees with none of the hit's names." : "Fewer than two real name parts: cannot confirm or clear on name."));

  const R = (decision, reason_code) => ({ decision, reason_code, gates, one_fact: oneFact(decision, reason_code, { dob, loc, name, locBlocked, hDobs }) });
  if (type === "contradiction") return R("DIFFERENT_ENTITY", "ENTITY_TYPE_MISMATCH");
  if (deceased === "contradiction") return R("DIFFERENT_ENTITY", "DECEASED");
  if (time === "contradiction") return R("DIFFERENT_ENTITY", "TEMPORAL_IMPOSSIBILITY");
  if (dob === "contradiction") return R("DIFFERENT_ENTITY", "DOB_MISMATCH");
  if (loc === "contradiction" && !locBlocked) return R("DIFFERENT_ENTITY", "LOCATION_MISMATCH");
  if (name === "contradiction") return R("DIFFERENT_ENTITY", "NAME_MISMATCH_VERIFIED");
  if (!company && name === "agreement" && dob === "agreement" && !locBlocked) return R("SAME_ENTITY", loc === "agreement" ? "NAME_DOB_LOCATION_MATCH" : "NAME_DOB_MATCH");
  if (company && name === "agreement" && loc === "agreement") return R("SAME_ENTITY", "NAME_LOCATION_MATCH");
  return R("REVIEW", "INSUFFICIENT_DATA");
}

// the one fact that would change the outcome, derived from which gate decided
function oneFact(decision, code, f) {
  if (decision === "DIFFERENT_ENTITY") return "This clears on " + code + ". If that contradicting fact were different (the fact agreed instead), it would no longer clear.";
  if (decision === "SAME_ENTITY") return "Any one contradicting fact (a different birth date, a death date before screening, a different entity type) would stop the confirmation.";
  if (f.locBlocked) return "Evidence that the customer or the hit has a tie to the other's country would point to the same person; a different birth date would clear it.";
  if (f.dob === "unknown") return "A birth date (or age) for the hit would settle this.";
  if (f.name === "unknown") return "A second real name part for the customer would settle this.";
  return "A fact that either contradicts or agrees on name and date of birth would settle this.";
}

// ---- adapters: case bundle -> form fields ----
export function custFromCase(c) {
  const p = (c.trace && c.trace.persons && c.trace.persons[0]) || null;
  const cs = p ? [...new Set(p.countries.map((x) => x.value))] : [c.alert.customer.country];
  return {
    name: (p && p.verified.name) || c.alert.customer.name, dob: (p && p.verified.dob) || c.alert.customer.dob || "",
    countries: cs.join(", "), type: c.alert.customer.entity_type, screened: c.alert.screened_at,
  };
}
export function hitFromCase(c) {
  const h = c.hit, dr = c.trace && c.trace.hit_facts && c.trace.hit_facts.dated_reports;
  return {
    name: h.name, aliases: (h.aliases || []).join(", "), dob: (h.dobs || []).join(", "), countries: (h.countries || []).join(", "),
    type: h.entity_type, deceased: h.deceased_date || "", report: (dr && dr[0] && dr[0].date) || "",
  };
}
