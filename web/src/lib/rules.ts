import type { CaseFile, GateName, GateTrace } from "./types";

export type RuleGroup = "Resolve" | "Clear" | "Confirm" | "Review";

export interface PolicyRule {
  id: string;
  group: RuleGroup;
  name: string;
  text: string;
  fires: (c: CaseFile) => boolean;
  decisive: (c: CaseFile) => boolean;
}

export function gate(c: CaseFile, name: GateName): GateTrace | undefined {
  return c.trace?.gates.find((g) => g.gate === name);
}

const via = (c: CaseFile, v: string) => c.trace?.linked_via === v;
const code = (c: CaseFile, name: string) => c.decision.reason_code === name;
const merged = (c: CaseFile, part: string) =>
  (c.trace?.persons ?? []).some((p) => (p.merged_by || "").includes(part));

/** Names match the engine: gates.py CODE_OF / CLEAR_ORDER, decide.py, customer.py. */
export const RULES: PolicyRule[] = [
  {
    id: "account_ref",
    group: "Resolve",
    name: "Account link",
    text: "Follow the alert's account reference to the customer.",
    fires: (c) => via(c, "account_ref"),
    decisive: () => false,
  },
  {
    id: "login_handle",
    group: "Resolve",
    name: "Login handle",
    text: "If there is no account link, follow the login handle.",
    fires: (c) => via(c, "login_handle"),
    decisive: () => false,
  },
  {
    id: "email",
    group: "Resolve",
    name: "Email",
    text: "If there is no account or login, follow the email.",
    fires: (c) => via(c, "email"),
    decisive: () => false,
  },
  {
    id: "fit_search",
    group: "Resolve",
    name: "Screened-details search",
    text: "With no link, filter by the screened date of birth and country, then the name.",
    fires: (c) => via(c, "fit_search"),
    decisive: () => false,
  },
  {
    id: "phone+dob",
    group: "Resolve",
    name: "Phone + full date of birth",
    text: "Records of one person merge on the same phone and the same full date of birth.",
    fires: (c) => merged(c, "phone+dob"),
    decisive: () => false,
  },
  {
    id: "document",
    group: "Resolve",
    name: "Approved document number",
    text: "The same document number on approved checks merges records.",
    fires: (c) => merged(c, "document"),
    decisive: () => false,
  },
  {
    id: "kyc_beats_declared",
    group: "Resolve",
    name: "Latest approved KYC",
    text: "The latest approved identity check, or a KYC note, beats the declared name and date of birth.",
    fires: (c) =>
      (c.trace?.persons ?? []).some((p) => p.verified?.how === "kyc_check" || p.verified?.how === "kyc_note"),
    decisive: () => false,
  },
  {
    id: "ENTITY_TYPE_MISMATCH",
    group: "Clear",
    name: "ENTITY_TYPE_MISMATCH",
    text: "Clear when the customer and the hit are different kinds of party. Checked first.",
    fires: (c) => gate(c, "TYPE")?.result === "contradiction",
    decisive: (c) => code(c, "ENTITY_TYPE_MISMATCH"),
  },
  {
    id: "DECEASED",
    group: "Clear",
    name: "DECEASED",
    text: "Clear when the hit died before the customer was screened.",
    fires: (c) => gate(c, "DECEASED")?.result === "contradiction",
    decisive: (c) => code(c, "DECEASED"),
  },
  {
    id: "LOCATION_MISMATCH",
    group: "Clear",
    name: "LOCATION_MISMATCH",
    text: "Clear when every customer country differs from every hit country.",
    fires: (c) => gate(c, "LOCATION")?.result === "contradiction",
    decisive: (c) => code(c, "LOCATION_MISMATCH"),
  },
  {
    id: "LOCATION_BLOCKED",
    group: "Clear",
    name: "Location clear blocked",
    text: "A country difference does not clear the hit when the name and the date of birth both agree.",
    fires: (c) => gate(c, "LOCATION")?.result === "blocked",
    decisive: () => false,
  },
  {
    id: "TEMPORAL_IMPOSSIBILITY",
    group: "Clear",
    name: "TEMPORAL_IMPOSSIBILITY",
    text: "Clear when the customer was under 16 at the hit's earliest dated report, or a company was incorporated after it.",
    fires: (c) => gate(c, "TIME")?.result === "contradiction",
    decisive: (c) => code(c, "TEMPORAL_IMPOSSIBILITY"),
  },
  {
    id: "DOB_MISMATCH",
    group: "Clear",
    name: "DOB_MISMATCH",
    text: "Clear when every birth date contradicts and no other date of birth agrees.",
    fires: (c) => gate(c, "DOB")?.result === "contradiction",
    decisive: (c) => code(c, "DOB_MISMATCH"),
  },
  {
    id: "NAME_MISMATCH_VERIFIED",
    group: "Clear",
    name: "NAME_MISMATCH_VERIFIED",
    text: "Clear when the verified legal name agrees with none of the hit's names. Companies skip this gate.",
    fires: (c) => gate(c, "NAME")?.result === "contradiction",
    decisive: (c) => code(c, "NAME_MISMATCH_VERIFIED"),
  },
  {
    id: "NAME_DOB_MATCH",
    group: "Confirm",
    name: "NAME_DOB_MATCH",
    text: "Same person: the name and the date of birth agree, and nothing contradicts.",
    fires: (c) => code(c, "NAME_DOB_MATCH"),
    decisive: (c) => code(c, "NAME_DOB_MATCH"),
  },
  {
    id: "NAME_DOB_LOCATION_MATCH",
    group: "Confirm",
    name: "NAME_DOB_LOCATION_MATCH",
    text: "Same person: the name, the date of birth, and a country agree.",
    fires: (c) => code(c, "NAME_DOB_LOCATION_MATCH"),
    decisive: (c) => code(c, "NAME_DOB_LOCATION_MATCH"),
  },
  {
    id: "NAME_LOCATION_MATCH",
    group: "Confirm",
    name: "NAME_LOCATION_MATCH",
    text: "Same company: the name and a country agree.",
    fires: (c) => code(c, "NAME_LOCATION_MATCH"),
    decisive: (c) => code(c, "NAME_LOCATION_MATCH"),
  },
  {
    id: "INSUFFICIENT_DATA",
    group: "Review",
    name: "INSUFFICIENT_DATA",
    text: "Leave it for a person when nothing contradicts and not enough agrees.",
    fires: (c) => code(c, "INSUFFICIENT_DATA"),
    decisive: (c) => code(c, "INSUFFICIENT_DATA"),
  },
  {
    id: "AMBIGUOUS_CUSTOMER_RECORD",
    group: "Review",
    name: "AMBIGUOUS_CUSTOMER_RECORD",
    text: "Leave it for a person when more than one customer fits and their decisions differ.",
    fires: (c) => code(c, "AMBIGUOUS_CUSTOMER_RECORD"),
    decisive: (c) => code(c, "AMBIGUOUS_CUSTOMER_RECORD"),
  },
];

export const GROUPS: RuleGroup[] = ["Resolve", "Clear", "Confirm", "Review"];

/** Only the sentence the engine (or bundle.py, copied from that reason) already wrote. */
export function oneFact(c: CaseFile): string | null {
  const text = c.trace?.one_fact;
  return text && text.trim() ? text : null;
}

const FACT_LABEL: Record<string, string> = {
  customer: "Customer side",
  hit: "Hit side",
  no_date: "Death date missing",
  customer_dob: "Customer date of birth",
  dob_source: "Record that gave the date",
  hit_has_full: "Hit gives a full date",
  hit_source: "Where the hit date came from",
  hit_years: "Hit birth years",
  sr_ids: "Search results used",
  name: "Name agrees",
  dob: "Date of birth agrees",
  country: "A country is shared",
  incorporated: "Incorporated on",
  report: "Earliest dated report",
  max_age: "Age at that report",
  death: "Date of death",
  screened: "Screened on",
  verified_source: "Verified name from",
  hit_names: "Listed names on the hit",
};

const SOURCE_WORD: Record<string, string> = {
  dobs: "the date-of-birth field",
  first_paragraph: "the first paragraph of the profile",
  search_result: "a matching search result",
  none: "no source",
};

export function formatFact(key: string, value: unknown): { label: string; value: string } {
  const label = FACT_LABEL[key] ?? key.replaceAll("_", " ");
  if (key === "hit_source" && typeof value === "string") return { label, value: SOURCE_WORD[value] ?? value };
  if (typeof value === "boolean") return { label, value: value ? "yes" : "no" };
  if (Array.isArray(value)) return { label, value: value.length ? value.join(", ") : "none" };
  if (value == null || value === "") return { label, value: "none" };
  return { label, value: String(value) };
}

export function gateMeaning(result: string | undefined): string {
  if (result === "contradiction") return "This check found a contradiction. A contradiction is what can clear the hit.";
  if (result === "agreement") return "This check found agreement. Agreement alone does not clear a hit.";
  if (result === "blocked") return "This check would have cleared the hit, but another fact stopped that clear.";
  if (result === "not_applicable") return "This check does not apply to this hit.";
  return "This check did not have a fact that agrees or contradicts, so it did not decide the hit.";
}

export function nodesForRule(id: string): string[] {
  const map: Record<string, string[]> = {
    account_ref: ["alert", "hub-customer"],
    login_handle: ["alert", "hub-customer"],
    email: ["alert", "hub-customer"],
    fit_search: ["alert", "hub-customer"],
    "phone+dob": ["hub-customer"],
    document: ["hub-customer"],
    kyc_beats_declared: ["hub-customer"],
    ENTITY_TYPE_MISMATCH: ["gate-TYPE"],
    DECEASED: ["gate-DECEASED"],
    LOCATION_MISMATCH: ["gate-LOCATION"],
    LOCATION_BLOCKED: ["gate-LOCATION"],
    TEMPORAL_IMPOSSIBILITY: ["gate-TIME"],
    DOB_MISMATCH: ["gate-DOB", "hit-dobs"],
    NAME_MISMATCH_VERIFIED: ["gate-NAME"],
    NAME_DOB_MATCH: ["gate-AGREEMENT", "decision"],
    NAME_DOB_LOCATION_MATCH: ["gate-AGREEMENT", "decision"],
    NAME_LOCATION_MATCH: ["gate-AGREEMENT", "decision"],
    INSUFFICIENT_DATA: ["decision"],
    AMBIGUOUS_CUSTOMER_RECORD: ["decision"],
  };
  return map[id] ?? [];
}
