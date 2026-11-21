// Loads the case bundle. Prefers data/cases.json (engine output), falls back to data/sample-cases.json (synthetic).
let cache;

async function getJson(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(url + " -> HTTP " + r.status);
  return r.json(); // a host that serves an HTML 404 page throws here, which is the fallback signal
}

export async function loadCases() {
  if (cache) return cache;
  let cases, source = "cases.json";
  try { cases = await getJson("data/cases.json"); } catch { cases = null; }
  if (!Array.isArray(cases) || !cases.length) { source = "sample-cases.json"; cases = await getJson("data/sample-cases.json"); }
  if (!Array.isArray(cases)) throw new Error("case file is not a JSON array");
  cache = { cases, source };
  return cache;
}

// risk order for the queue: same person first, then needs-a-human, then cleared
export const RISK = { SAME_ENTITY: 0, REVIEW: 1, DIFFERENT_ENTITY: 2 };
export const byRisk = (a, b) => RISK[a.decision.decision] - RISK[b.decision.decision] || a.case_id.localeCompare(b.case_id);

export const LINK_TEXT = {
  account_ref: "The alert carried an account reference; we followed it through accounts and onboarding to the customer record.",
  login_handle: "The alert carried a login handle; we matched it to the account and followed it to the customer record.",
  email: "The alert carried an e-mail address; we matched it to the customer record.",
  fit_search: "The alert carried no usable link. We searched for records that fit the screened name, date of birth, country and city.",
  none: "No customer record could be found.",
};

/** Resolve a decision evidence id ("KYC-1", "H-0A1B2C#dobs") to something displayable. */
export function resolveEvidence(c, id) {
  const [base, field] = String(id).split("#");
  const find = (arr, key) => (arr || []).find((r) => r[key] === base);
  let r;
  if ((r = find(c.customer_records, "record_id"))) return { id, kind: "Customer record", fields: r };
  if ((r = find(c.kyc_checks, "check_id"))) return { id, kind: "Identity check", fields: r };
  if ((r = find(c.notes, "note_id"))) return { id, kind: "Note", fields: r, quote: r.text };
  if ((r = find(c.search_results, "result_id"))) return { id, kind: "Search result", fields: r, quote: r.snippet };
  if (c.hit && c.hit.hit_id === base) {
    const v = field ? c.hit[field] : null;
    return { id, kind: "Hit field" + (field ? ": " + field : ""), fields: field ? { [field]: v } : c.hit, quote: field && v != null ? (Array.isArray(v) ? v.join("; ") : String(v)) : null };
  }
  return { id, kind: "Unknown id", fields: {}, missing: true };
}
