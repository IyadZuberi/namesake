/** Nine principles from the engine comments and the policy map in README.md. Eleven reason codes from gates.py and decide.py. */
export const GH = "https://github.com/IyadZuberi/namesake/blob/main/";

export interface Principle {
  n: number;
  title: string;
  text: string;
  file: string;
  gate?: string;
}

export const PRINCIPLES: Principle[] = [
  { n: 1, title: "Identity, not the listing", text: "How serious the listing is never changes the decision.", file: "system/mirror/decide.py" },
  { n: 2, title: "Know who the customer is", text: "Follow the account, login, or email. With no link, search by the screened details.", file: "system/mirror/customer.py" },
  { n: 3, title: "One person, one picture", text: "Merge on a phone plus a full date of birth, or the same approved document. If the people disagree, the result is AMBIGUOUS_CUSTOMER_RECORD.", file: "system/mirror/customer.py" },
  { n: 4, title: "Verified beats declared", text: "The latest approved KYC check or KYC note outranks the declared name and date of birth.", file: "system/mirror/customer.py" },
  { n: 5, title: "Gather the hit's facts", text: "Birth dates from the dobs field, then the first paragraph, then a matching search result. Countries and dated reports come from the hit.", file: "system/mirror/hit.py" },
  { n: 6, title: "Clear only on a contradiction", text: "TYPE, DECEASED, LOCATION, TIME, DOB, then NAME. The first contradiction wins. Unknown never clears.", file: "system/mirror/gates.py", gate: "TYPE" },
  { n: 7, title: "Confirm only on agreement", text: "A person needs a name and a date of birth. A company needs a name and a country. Otherwise INSUFFICIENT_DATA.", file: "system/mirror/gates.py", gate: "AGREEMENT" },
  { n: 8, title: "Names", text: "Compare real name parts, listed variants, and joined forms. A doubtful reading never clears.", file: "system/mirror/names.py", gate: "NAME" },
  { n: 9, title: "Cite what you used", text: "The reason and the evidence list only the records that decided the hit.", file: "system/mirror/explain.py" },
];

export interface ReasonCode {
  code: string;
  decision: string;
  gate: string;
  file: string;
}

export const REASON_CODES: ReasonCode[] = [
  { code: "ENTITY_TYPE_MISMATCH", decision: "DIFFERENT_ENTITY", gate: "TYPE", file: "system/mirror/gates.py" },
  { code: "DECEASED", decision: "DIFFERENT_ENTITY", gate: "DECEASED", file: "system/mirror/gates.py" },
  { code: "LOCATION_MISMATCH", decision: "DIFFERENT_ENTITY", gate: "LOCATION", file: "system/mirror/gates.py" },
  { code: "TEMPORAL_IMPOSSIBILITY", decision: "DIFFERENT_ENTITY", gate: "TIME", file: "system/mirror/gates.py" },
  { code: "DOB_MISMATCH", decision: "DIFFERENT_ENTITY", gate: "DOB", file: "system/mirror/gates.py" },
  { code: "NAME_MISMATCH_VERIFIED", decision: "DIFFERENT_ENTITY", gate: "NAME", file: "system/mirror/gates.py" },
  { code: "NAME_DOB_MATCH", decision: "SAME_ENTITY", gate: "AGREEMENT", file: "system/mirror/gates.py" },
  { code: "NAME_DOB_LOCATION_MATCH", decision: "SAME_ENTITY", gate: "AGREEMENT", file: "system/mirror/gates.py" },
  { code: "NAME_LOCATION_MATCH", decision: "SAME_ENTITY", gate: "AGREEMENT", file: "system/mirror/gates.py" },
  { code: "INSUFFICIENT_DATA", decision: "REVIEW", gate: "AGREEMENT", file: "system/mirror/decide.py" },
  { code: "AMBIGUOUS_CUSTOMER_RECORD", decision: "REVIEW", gate: "AGREEMENT", file: "system/mirror/decide.py" },
];

export function principleForKind(kind: string, gate?: string): Principle {
  if (gate === "NAME") return PRINCIPLES[7];
  if (gate === "AGREEMENT") return PRINCIPLES[6];
  if (kind === "Gate") return PRINCIPLES[5];
  if (kind === "Decision") return PRINCIPLES[8];
  if (kind === "KYC check" || kind === "Note") return PRINCIPLES[3];
  if (kind === "Hit source" || kind === "Search result" || kind === "Listed person") return PRINCIPLES[4];
  return PRINCIPLES[1];
}
