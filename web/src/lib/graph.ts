import dagre from "@dagrejs/dagre";
import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";
import { gateMeaning, RULES } from "./rules";
import type { CaseFile, GateName, GateResult } from "./types";

export interface NodeData extends Record<string, unknown> {
  kind: string;
  label: string;
  value?: string;
  sourceId?: string;
  sourceKind?: string;
  rule?: string;
  decisive?: boolean;
  missing?: boolean;
  result?: string;
  highlighted?: boolean;
  why: string;
  sourceFile: string;
  sourceField: string;
  path: string;
  lines: { label: string; value: string }[];
}

export interface GraphModel {
  nodes: Node<NodeData, "card">[];
  edges: Edge[];
  decisiveId: string;
}

const GATES: GateName[] = ["TYPE", "DECEASED", "LOCATION", "TIME", "DOB", "NAME", "AGREEMENT"];
const GATE_RULE: Partial<Record<GateName, string>> = {
  TYPE: "ENTITY_TYPE_MISMATCH",
  DECEASED: "DECEASED",
  LOCATION: "LOCATION_MISMATCH",
  TIME: "TEMPORAL_IMPOSSIBILITY",
  DOB: "DOB_MISMATCH",
  NAME: "NAME_MISMATCH_VERIFIED",
  AGREEMENT: "NAME_DOB_MATCH",
};

function stroke(result: GateResult | "neutral") {
  if (result === "contradiction") return "#e11d48";
  if (result === "agreement") return "#059669";
  if (result === "blocked") return "#d97706";
  return "#a1a1aa";
}

function ruleText(id?: string) {
  if (!id) return "";
  return RULES.find((r) => r.id === id || r.name === id)?.text ?? "";
}

export function buildGraph(c: CaseFile, animate: boolean): GraphModel {
  const raw: Node<NodeData, "card">[] = [];
  const edges: Edge[] = [];
  const persons = c.trace?.persons ?? [];
  const recordIds = new Set(persons.flatMap((p) => p.record_ids));
  const records = c.customer_records.filter((r) => recordIds.has(r.record_id));
  const shownRecords = records.length ? records : c.customer_records.slice(0, 1);
  const decisiveGate =
    GATES.find((name) => {
      const rule = GATE_RULE[name];
      return rule != null && c.decision.reason_code === rule && c.trace?.gates.some((g) => g.gate === name && g.result === "contradiction");
    }) ?? (c.decision.decision === "SAME_ENTITY" ? "AGREEMENT" : null);

  const add = (id: string, data: NodeData) => {
    raw.push({
      id,
      type: "card",
      position: { x: 0, y: 0 },
      data,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      draggable: false,
    });
  };
  const link = (source: string, target: string, result: GateResult | "neutral", decisive = false) => {
    const color = stroke(result);
    edges.push({
      id: `${source}>${target}`,
      source,
      target,
      animated: animate && decisive,
      style: { stroke: color, strokeWidth: decisive ? 2.6 : 1.25 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    });
  };

  if (c.alert?.alert_id) {
    add("alert", {
      kind: "Alert",
      label: c.alert.alert_id,
      value: (c.trace?.linked_via ?? "link").replaceAll("_", " "),
      sourceId: c.alert.alert_id,
      sourceKind: "Alert",
      rule: "Account link",
      why: "The alert is the screening event. Its link is how the customer is found.",
      sourceFile: "alerts.jsonl",
      sourceField: "alert_id",
      path: "",
      lines: [
        { label: "Screened", value: c.alert.screened_at ?? "not given" },
        { label: "Link", value: (c.trace?.linked_via ?? "none").replaceAll("_", " ") },
        { label: "Screened name", value: c.alert.customer?.name ?? "not given" },
      ],
    });
    link("alert", "hub-customer", "neutral");
  }

  for (const account of c.accounts) {
    const id = "account-" + account.account_id;
    add(id, {
      kind: "Account",
      label: account.account_id,
      value: account.login_handle,
      sourceId: account.account_id,
      sourceKind: "Account",
      rule: "Account link",
      why: "This account is the link from the alert to a customer record.",
      sourceFile: "accounts.jsonl",
      sourceField: "account_id",
      path: "",
      lines: [
        { label: "Customer", value: account.customer_id },
        { label: "Login", value: account.login_handle ?? "not given" },
      ],
    });
    link(id, "hub-customer", "neutral");
  }

  for (const rec of shownRecords) {
    const id = "cus-" + rec.record_id;
    add(id, {
      kind: "Customer record",
      label: rec.full_name ?? rec.record_id,
      value: rec.record_id,
      sourceId: rec.record_id,
      sourceKind: "Customer record",
      rule: "Account link",
      why: "This is a customer record the engine resolved for the alert.",
      sourceFile: "customers.jsonl",
      sourceField: "record_id",
      path: "",
      lines: [
        { label: "Date of birth", value: rec.dob ?? "not given" },
        { label: "Residence", value: rec.residence_country ?? "not given" },
        { label: "Type", value: rec.entity_type ?? "not given" },
      ],
    });
    link(id, "hub-customer", "neutral");
  }

  const cited = new Set<string>([...(c.decision.evidence ?? [])]);
  for (const p of persons) {
    if (p.verified?.source_id) cited.add(p.verified.source_id);
    for (const country of p.countries) if (country.source_id) cited.add(country.source_id);
  }
  for (const kyc of c.kyc_checks) {
    if (!cited.has(kyc.check_id)) continue;
    const id = "kyc-" + kyc.check_id;
    add(id, {
      kind: "KYC check",
      label: kyc.check_id,
      value: kyc.result,
      sourceId: kyc.check_id,
      sourceKind: "Identity check",
      rule: "Latest approved KYC",
      why: "An approved identity check outranks the name and date of birth the customer declared.",
      sourceFile: "kyc_checks.jsonl",
      sourceField: "check_id",
      path: "",
      lines: [
        { label: "Verified date of birth", value: kyc.verified_dob ?? "not given" },
        { label: "Document country", value: kyc.document_country ?? "not given" },
        { label: "Result", value: kyc.result ?? "not given" },
      ],
    });
    link(id, "hub-customer", "neutral");
  }
  for (const note of c.notes) {
    if (!cited.has(note.note_id)) continue;
    const id = "note-" + note.note_id;
    add(id, {
      kind: "Note",
      label: note.note_id,
      value: note.channel,
      sourceId: note.note_id,
      sourceKind: "Note",
      rule: "Latest approved KYC",
      why: "This note supplied a fact the gates used. It is not copied into the scored reason.",
      sourceFile: "notes.jsonl",
      sourceField: "note_id",
      path: "",
      lines: [{ label: "Channel", value: note.channel ?? "not given" }],
    });
    link(id, "hub-customer", "neutral");
  }

  add("hub-customer", {
    kind: "Customer",
    label: shownRecords[0]?.full_name ?? "Customer",
    value: shownRecords.map((r) => r.record_id).join(", ") || "unresolved",
    sourceKind: "Customer",
    why: "Every customer-side record fans in here. The gates read this resolved person, not each file on its own.",
    sourceFile: "customers.jsonl",
    sourceField: "record_id",
    path: "Sources → Customer → gates",
    lines: [
      { label: "Records", value: shownRecords.map((r) => r.record_id).join(", ") || "none" },
      { label: "Merged by", value: persons.map((p) => p.merged_by).filter((m) => m && m !== "none").join(", ") || "not merged" },
    ],
  });

  const facts = c.trace?.hit_facts;
  if (facts?.dob_source === "dobs" || (c.hit.dobs && c.hit.dobs.length)) {
    add("hit-dobs", {
      kind: "Hit source",
      label: "Date-of-birth field",
      value: (c.hit.dobs ?? []).join(", ") || "empty",
      sourceId: c.hit.hit_id + "#dobs",
      sourceKind: "Hit field",
      why: "Birth dates taken from the hit's dobs field.",
      sourceFile: "hits.jsonl",
      sourceField: "dobs",
      path: "",
      lines: [{ label: "Values", value: (c.hit.dobs ?? []).join(", ") || "none" }],
    });
    link("hit-dobs", "hub-hit", "neutral");
  }
  if (facts?.dob_source === "first_paragraph" || (facts?.dated_reports?.length ?? 0) > 0) {
    add("hit-profile", {
      kind: "Hit source",
      label: "Profile notes",
      value: facts?.dob_source === "first_paragraph" ? "birth date in the first paragraph" : "dated report",
      sourceId: c.hit.hit_id + "#profile_notes",
      sourceKind: "Hit field",
      why: "The engine read the profile for a birth sentence or a dated report. The note text is not copied into the reason.",
      sourceFile: "hits.jsonl",
      sourceField: "profile_notes",
      path: "",
      lines: [{ label: "Dated reports", value: String(facts?.dated_reports?.length ?? 0) }],
    });
    link("hit-profile", "hub-hit", "neutral");
  }
  for (const sr of c.search_results) {
    if (!cited.has(sr.result_id) && facts?.dob_source !== "search_result") continue;
    const id = "sr-" + sr.result_id;
    add(id, {
      kind: "Search result",
      label: sr.result_id,
      value: sr.title,
      sourceId: sr.result_id,
      sourceKind: "Search result",
      why: "A search result supplied a birth date or was cited in the evidence.",
      sourceFile: "search_results.jsonl",
      sourceField: "result_id",
      path: "",
      lines: [{ label: "Title", value: sr.title ?? "not given" }],
    });
    link(id, "hub-hit", "neutral");
  }
  if (c.hit.hit_id && !raw.some((n) => n.id.startsWith("hit-") || n.id.startsWith("sr-"))) {
    add("hit-name", {
      kind: "Hit source",
      label: c.hit.name ?? c.hit.hit_id,
      value: c.hit.hit_id,
      sourceId: c.hit.hit_id + "#name",
      sourceKind: "Hit field",
      why: "The listed name is the hit side of the comparison.",
      sourceFile: "hits.jsonl",
      sourceField: "name",
      path: "",
      lines: [
        { label: "Type", value: c.hit.entity_type ?? "not given" },
        { label: "Countries", value: (c.hit.countries ?? []).join(", ") || "none" },
      ],
    });
    link("hit-name", "hub-hit", "neutral");
  }

  add("hub-hit", {
    kind: "Listed person",
    label: c.hit.name ?? "Listed person",
    value: c.hit.hit_id,
    sourceId: c.hit.hit_id,
    sourceKind: "Hit",
    why: "Every fact about the listed person fans in here before the seven gates.",
    sourceFile: "hits.jsonl",
    sourceField: "hit_id",
    path: "Hit sources → Listed person → gates",
    lines: [
      { label: "Birth source", value: facts?.dob_source ?? "none" },
      { label: "Countries", value: (facts?.countries ?? []).join(", ") || "none" },
    ],
  });

  for (const name of GATES) {
    const g = c.trace?.gates.find((x) => x.gate === name);
    const result = g?.result ?? "unknown";
    const decisive = name === decisiveGate;
    add("gate-" + name, {
      kind: "Gate",
      label: name,
      value: result.replaceAll("_", " "),
      result,
      decisive,
      rule: GATE_RULE[name],
      why: gateMeaning(result),
      sourceFile: "trace",
      sourceField: name,
      path: "",
      lines: [
        { label: "Result", value: result.replaceAll("_", " ") },
        { label: "Blocked by", value: g?.blocked_by ?? "not blocked" },
        { label: "Evidence", value: g?.evidence?.join(", ") || "none" },
      ],
    });
    link("hub-customer", "gate-" + name, result, false);
    link("hub-hit", "gate-" + name, result, false);
    if (decisive) link("gate-" + name, "decision", result === "unknown" ? "neutral" : result, true);
  }

  add("decision", {
    kind: "Decision",
    label: c.decision.decision.replaceAll("_", " "),
    value: c.decision.reason_code,
    decisive: true,
    rule: c.decision.reason_code,
    why: c.decision.reason,
    sourceFile: "output line",
    sourceField: "decision",
    path: decisiveGate ? `Gates → ${decisiveGate} → Decision` : "No contradiction decided it",
    lines: [
      { label: "Reason code", value: c.decision.reason_code },
      { label: "Evidence", value: c.decision.evidence.join(", ") || "none" },
    ],
  });

  for (const n of raw) {
    if (!n.data.path) {
      n.data.path = n.data.kind === "Gate"
        ? `Customer and listed person → ${n.data.label}${n.data.decisive ? " → Decision" : ""}`
        : `This source → ${n.id.startsWith("hit") || n.id.startsWith("sr-") ? "Listed person" : "Customer"} → gates`;
    }
    if (n.data.rule) n.data.lines = [...n.data.lines, { label: "Rule", value: ruleText(n.data.rule) || n.data.rule }];
  }

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 22, ranksep: 64, marginx: 12, marginy: 12 });
  for (const n of raw) g.setNode(n.id, { width: 188, height: 62 });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  const nodes = raw.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - 94, y: pos.y - 31 } };
  });

  return { nodes, edges, decisiveId: decisiveGate ? "gate-" + decisiveGate : "decision" };
}

export function evidenceRows(c: CaseFile): { id: string; kind: string; value: string }[] {
  return c.decision.evidence.map((id) => {
    const [base, field] = id.split("#");
    const rec = c.customer_records.find((r) => r.record_id === base);
    if (rec) {
      return { id, kind: "Customer record", value: [rec.full_name, rec.dob ? `born ${rec.dob}` : null, rec.residence_country].filter(Boolean).join(" · ") };
    }
    const kyc = c.kyc_checks.find((r) => r.check_id === base);
    if (kyc) return { id, kind: "Identity check", value: [kyc.result, kyc.verified_dob, kyc.document_country].filter(Boolean).join(" · ") };
    const note = c.notes.find((r) => r.note_id === base);
    if (note) return { id, kind: "Note", value: note.channel ?? "note" };
    if (c.hit.hit_id === base) {
      const rawValue = field ? (c.hit as unknown as Record<string, unknown>)[field] : null;
      const value = Array.isArray(rawValue) ? rawValue.join(", ") : rawValue == null ? "—" : String(rawValue);
      return { id, kind: "Hit field", value };
    }
    return { id, kind: "Record", value: "—" };
  });
}

export interface CompareRow {
  label: string;
  customer: string;
  hit: string;
  mark: "match" | "conflict" | "missing" | "blocked";
}

export function compareSides(c: CaseFile): CompareRow[] {
  const person = c.trace?.persons?.[0];
  const rec = c.customer_records.find((r) => r.record_id === person?.record_ids?.[0]) ?? c.customer_records[0];
  const gateOf = (name: GateName) => c.trace?.gates.find((g) => g.gate === name);
  const mark = (result?: string): CompareRow["mark"] => {
    if (result === "agreement") return "match";
    if (result === "contradiction") return "conflict";
    if (result === "blocked") return "blocked";
    return "missing";
  };
  const dob = gateOf("DOB");
  const loc = gateOf("LOCATION");
  const type = gateOf("TYPE");
  const nameAgreed = Boolean((gateOf("AGREEMENT")?.facts as { name?: boolean } | undefined)?.name);
  const nameResult = gateOf("NAME")?.result;
  return [
    {
      label: "Name",
      customer: rec?.full_name ?? "not on the record",
      hit: c.hit.name ?? "not on the hit",
      mark: nameResult === "contradiction" ? "conflict" : nameAgreed ? "match" : "missing",
    },
    {
      label: "Date of birth",
      customer: typeof dob?.facts.customer_dob === "string" ? dob.facts.customer_dob : rec?.dob ?? "not given",
      hit: Array.isArray(dob?.facts.hit_years) ? (dob.facts.hit_years as number[]).join(" or ") : (c.hit.dobs ?? []).join(", ") || "not given",
      mark: mark(dob?.result),
    },
    {
      label: "Country",
      customer: Array.isArray(loc?.facts.customer) ? (loc.facts.customer as string[]).join(", ") : rec?.residence_country ?? "not given",
      hit: Array.isArray(loc?.facts.hit) ? (loc.facts.hit as string[]).join(", ") || "not given" : (c.hit.countries ?? []).join(", ") || "not given",
      mark: mark(loc?.result),
    },
    {
      label: "Type",
      customer: typeof type?.facts.customer === "string" ? type.facts.customer : rec?.entity_type ?? "not given",
      hit: typeof type?.facts.hit === "string" ? type.facts.hit : c.hit.entity_type ?? "not given",
      mark: mark(type?.result),
    },
  ];
}
