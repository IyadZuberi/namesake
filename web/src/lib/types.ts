export type DecisionName = "DIFFERENT_ENTITY" | "SAME_ENTITY" | "REVIEW";
export type GateName = "TYPE" | "DECEASED" | "LOCATION" | "TIME" | "DOB" | "NAME" | "AGREEMENT";
export type GateResult = "contradiction" | "agreement" | "unknown" | "not_applicable" | "blocked";

export interface GateTrace {
  gate: GateName;
  result: GateResult;
  blocked_by: string | null;
  facts: Record<string, unknown>;
  evidence: string[];
}

export interface PersonTrace {
  record_ids: string[];
  merged_by: string;
  verified: { name: string | null; dob: string | null; source_id: string | null; how: string };
  countries: { value: string; source_id: string; kind: string }[];
  decision: DecisionName;
  reason_code: string;
}

export interface CustomerRecord {
  record_id: string;
  full_name?: string;
  preferred_name?: string;
  entity_type?: string;
  dob?: string | null;
  nationality?: string;
  residence_country?: string;
  city?: string;
  email?: string;
  phone?: string;
}

export interface AccountRow {
  account_id: string;
  customer_id: string;
  login_handle?: string;
}

export interface KycRow {
  check_id: string;
  verified_name?: string;
  verified_dob?: string;
  document_country?: string;
  result?: string;
  checked_at?: string;
}

export interface NoteRow {
  note_id: string;
  channel?: string;
  text?: string;
  created_at?: string;
}

export interface HitRow {
  hit_id: string;
  alert_id?: string;
  name?: string;
  entity_type?: string;
  dobs?: string[];
  countries?: string[];
  deceased_date?: string | null;
  life_status?: string;
}

export interface CaseFile {
  case_id: string;
  title: string;
  alert: {
    alert_id: string;
    screened_at?: string;
    account_ref?: string;
    login_handle?: string;
    email?: string;
    customer?: { name?: string; entity_type?: string; dob?: string | null; country?: string | null };
  };
  customer_records: CustomerRecord[];
  accounts: AccountRow[];
  kyc_checks: KycRow[];
  notes: NoteRow[];
  hit: HitRow;
  search_results: { result_id: string; title?: string; snippet?: string }[];
  decision: {
    hit_id: string;
    alert_id: string;
    decision: DecisionName;
    reason_code: string;
    customer_record_id: string | null;
    reason: string;
    evidence: string[];
  };
  trace: {
    linked_via: string;
    persons: PersonTrace[];
    hit_facts: {
      dob_years: number[];
      dob_source: string;
      countries: string[];
      dated_reports: { date: string; line_ref: string }[];
      death_date: string | null;
    };
    gates: GateTrace[];
    one_fact: string | null;
  } | null;
}
