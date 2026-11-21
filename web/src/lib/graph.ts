import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";
import type { CaseFile, GateName } from "./types";

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
  lines: { label: string; value: string }[];
}

export interface GraphModel {
  nodes: Node<NodeData, "card">[];
  edges: Edge[];
  decisiveId: string;
}

const GATE_ORDER: GateName[] = ["TYPE", "DECEASED", "LOCATION", "TIME", "DOB", "NAME", "AGREEMENT"];
const PITCH = 76;
const COL = 208;

const GATE_RULE: Partial<Record<GateName, string>> = {
  TYPE: "ENTITY_TYPE_MISMATCH",
  DECEASED: "DECEASED",
  LOCATION: "LOCATION_MISMATCH",
  TIME: "TEMPORAL_IMPOSSIBILITY",
  DOB: "DOB_MISMATCH",
  NAME: "NAME_MISMATCH_VERIFIED",
  AGREEMENT: "NAME_DOB_MATCH",
};

function stroke(verdict: "agrees" | "contradicts" | "neutral") {
  if (verdict === "contradicts") return "#9f1239";
  if (verdict === "agrees") return "#0f766e";
  return "#a1a1aa";
}

export function buildGraph(c: CaseFile, animate: boolean): GraphModel {
  const nodes: Node<NodeData, "card">[] = [];
  const edges: Edge[] = [];
  const person = c.trace?.persons?.[0];
  const customer = c.customer_records.find((r) => r.record_id === person?.record_ids?.[0]) ?? c.customer_records[0];
  const account = c.accounts[0];
  const decisiveGate =
    GATE_ORDER.find((name) => {
      const rule = GATE_RULE[name];
      return rule != null && c.decision.reason_code === rule && c.trace?.gates.some((g) => g.gate === name && g.result === "contradiction");
    }) ?? null;

  const columns: { id: string; data: NodeData }[][] = [[], [], [], []];

  const push = (col: number, id: string, data: NodeData) => {
    columns[col].push({ id, data });
  };

  push(0, "alert", {
    kind: "Alert",
    label: c.alert.alert_id,
    value: c.trace?.linked_via?.replaceAll("_", " ") ?? "alert",
    sourceId: c.alert.alert_id,
    sourceKind: "Alert",
    rule: "Account link",
    lines: [
      { label: "Alert", value: c.alert.alert_id },
      { label: "Screened", value: c.alert.screened_at ?? "—" },
      { label: "Link", value: c.trace?.linked_via ?? "—" },
      { label: "Screened name", value: c.alert.customer?.name ?? "—" },
    ],
  });

  if (account) {
    push(0, "account", {
      kind: "Account",
      label: account.account_id,
      value: account.login_handle,
      sourceId: account.account_id,
      sourceKind: "Account",
      rule: "Account link",
      lines: [
        { label: "Account", value: account.account_id },
        { label: "Customer", value: account.customer_id },
        { label: "Login", value: account.login_handle ?? "—" },
      ],
    });
  }

  if (customer) {
    push(0, "customer", {
      kind: "Customer",
      label: customer.full_name ?? customer.record_id,
      value: customer.record_id,
      sourceId: customer.record_id,
      sourceKind: "Customer record",
      rule: "Account link",
      decisive: c.decision.evidence.includes(customer.record_id),
      lines: [
        { label: "Record", value: customer.record_id },
        { label: "Name", value: customer.full_name ?? "—" },
        { label: "Date of birth", value: customer.dob ?? "—" },
        { label: "Residence", value: customer.residence_country ?? "—" },
        { label: "Nationality", value: customer.nationality ?? "—" },
        { label: "Type", value: customer.entity_type ?? "—" },
      ],
    });
  }

  push(0, "hit", {
    kind: "Hit",
    label: c.hit.name ?? c.hit.hit_id,
    value: c.hit.hit_id,
    sourceId: c.hit.hit_id,
    sourceKind: "Hit",
    rule: decisiveGate ? GATE_RULE[decisiveGate] : c.decision.reason_code,
    lines: [
      { label: "Hit", value: c.hit.hit_id },
      { label: "Name", value: c.hit.name ?? "—" },
      { label: "Type", value: c.hit.entity_type ?? "—" },
      { label: "Birth dates", value: (c.hit.dobs ?? []).join(", ") || "—" },
      { label: "Countries", value: (c.hit.countries ?? []).join(", ") || "—" },
    ],
  });

  const dob = c.trace?.gates.find((g) => g.gate === "DOB");
  const loc = c.trace?.gates.find((g) => g.gate === "LOCATION");
  const type = c.trace?.gates.find((g) => g.gate === "TYPE");

  if (dob && typeof dob.facts.customer_dob === "string") {
    push(1, "fact-cdob", {
      kind: "Fact",
      label: "Customer date of birth",
      value: dob.facts.customer_dob,
      sourceId: String(dob.facts.dob_source ?? customer?.record_id ?? ""),
      sourceKind: "Customer record",
      rule: "DOB_MISMATCH",
      decisive: decisiveGate === "DOB",
      lines: [
        { label: "Value", value: String(dob.facts.customer_dob) },
        { label: "Source", value: String(dob.facts.dob_source ?? "") },
        { label: "Feeds", value: "DOB gate" },
      ],
    });
  }
  if (dob && Array.isArray(dob.facts.hit_years)) {
    push(1, "fact-hdob", {
      kind: "Fact",
      label: "Hit birth year",
      value: (dob.facts.hit_years as number[]).join(" or "),
      sourceId: `${c.hit.hit_id}#dobs`,
      sourceKind: "Hit field",
      rule: "DOB_MISMATCH",
      decisive: decisiveGate === "DOB",
      lines: [
        { label: "Years", value: (dob.facts.hit_years as number[]).join(", ") },
        { label: "Taken from", value: String(dob.facts.hit_source ?? "dobs") },
        { label: "Field", value: `${c.hit.hit_id}#dobs` },
      ],
    });
  }
  if (loc && Array.isArray(loc.facts.customer)) {
    const same = loc.result === "agreement";
    push(1, "fact-loc", {
      kind: "Fact",
      label: same ? "Shared country" : "Countries",
      value: `${(loc.facts.customer as string[]).join(", ")} · ${(loc.facts.hit as string[]).join(", ") || "none"}`,
      sourceId: person?.countries?.[0]?.source_id,
      sourceKind: "Customer record",
      rule: "LOCATION_MISMATCH",
      lines: [
        { label: "Customer", value: (loc.facts.customer as string[]).join(", ") || "—" },
        { label: "Hit", value: (loc.facts.hit as string[]).join(", ") || "—" },
        { label: "Result", value: loc.result },
      ],
    });
  }
  if (type?.facts.customer) {
    push(1, "fact-type", {
      kind: "Fact",
      label: "Entity type",
      value: `${type.facts.customer} · ${type.facts.hit}`,
      sourceId: customer?.record_id,
      sourceKind: "Customer record",
      rule: "ENTITY_TYPE_MISMATCH",
      lines: [
        { label: "Customer", value: String(type.facts.customer) },
        { label: "Hit", value: String(type.facts.hit) },
        { label: "Result", value: type.result },
      ],
    });
  }

  for (const name of GATE_ORDER) {
    const g = c.trace?.gates.find((x) => x.gate === name);
    const result = g?.result ?? "unknown";
    const isDecisive = name === decisiveGate;
    push(2, `gate-${name}`, {
      kind: "Gate",
      label: name,
      value: result.replaceAll("_", " "),
      result,
      rule: GATE_RULE[name],
      decisive: isDecisive,
      sourceId: g?.evidence?.[0],
      sourceKind: "Gate",
      lines: [
        { label: "Gate", value: name },
        { label: "Result", value: result.replaceAll("_", " ") },
        { label: "Blocked by", value: g?.blocked_by ?? "—" },
        { label: "Evidence", value: g?.evidence?.join(", ") || "—" },
        { label: "Rule", value: GATE_RULE[name] ?? "—" },
      ],
    });
  }

  push(3, "decision", {
    kind: "Decision",
    label: c.decision.decision.replaceAll("_", " "),
    value: c.decision.reason_code,
    decisive: true,
    rule: c.decision.reason_code,
    sourceKind: "Decision",
    lines: [
      { label: "Decision", value: c.decision.decision },
      { label: "Reason code", value: c.decision.reason_code },
      { label: "Evidence", value: c.decision.evidence.join(", ") || "—" },
    ],
  });

  if (c.decision.decision === "REVIEW") {
    push(3, "missing", {
      kind: "Missing fact",
      label: "Missing fact",
      value: "Would change the review",
      missing: true,
      rule: c.decision.reason_code,
      lines: [{ label: "Gap", value: "Shown under the reason." }],
    });
  }

  columns.forEach((col, ci) => {
    const height = col.length * PITCH;
    const gateHeight = GATE_ORDER.length * PITCH;
    const offset = Math.max(0, (gateHeight - height) / 2);
    col.forEach((item, i) => {
      nodes.push({
        id: item.id,
        type: "card",
        position: { x: ci * COL, y: offset + i * PITCH },
        data: item.data,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        draggable: false,
      });
    });
  });

  const link = (source: string, target: string, verdict: "agrees" | "contradicts" | "neutral", decisive = false) => {
    if (!nodes.some((n) => n.id === source) || !nodes.some((n) => n.id === target)) return;
    const color = stroke(verdict);
    edges.push({
      id: `${source}>${target}`,
      source,
      target,
      animated: animate && decisive,
      style: { stroke: color, strokeWidth: decisive ? 2.4 : 1.25 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    });
  };

  link("alert", account ? "account" : "customer", "neutral", true);
  if (account) link("account", "customer", "neutral", true);
  link("alert", "hit", "neutral");
  link("customer", "fact-cdob", "neutral", decisiveGate === "DOB");
  link("hit", "fact-hdob", "contradicts", decisiveGate === "DOB");
  link("fact-cdob", "gate-DOB", "contradicts", decisiveGate === "DOB");
  link("fact-hdob", "gate-DOB", "contradicts", decisiveGate === "DOB");
  link("customer", "fact-loc", "neutral");
  link("hit", "fact-loc", "neutral");
  const locVerdict = loc?.result === "agreement" ? "agrees" : loc?.result === "contradiction" ? "contradicts" : "neutral";
  link("fact-loc", "gate-LOCATION", locVerdict, decisiveGate === "LOCATION");
  const typeVerdict = type?.result === "contradiction" ? "contradicts" : type?.result === "agreement" ? "agrees" : "neutral";
  link("fact-type", "gate-TYPE", typeVerdict, decisiveGate === "TYPE");
  link("customer", "fact-type", "neutral");
  if (decisiveGate) link(`gate-${decisiveGate}`, "decision", "contradicts", true);
  else if (c.decision.decision === "SAME_ENTITY") link("gate-AGREEMENT", "decision", "agrees", true);
  else link("gate-AGREEMENT", "missing", "neutral", true);

  const decisiveId = decisiveGate ? `gate-${decisiveGate}` : c.decision.decision === "REVIEW" ? "missing" : "decision";
  return { nodes, edges, decisiveId };
}

export function evidenceRows(c: CaseFile): { id: string; kind: string; value: string }[] {
  return c.decision.evidence.map((id) => {
    const [base, field] = id.split("#");
    const rec = c.customer_records.find((r) => r.record_id === base);
    if (rec) {
      return {
        id,
        kind: "Customer record",
        value: [rec.full_name, rec.dob ? `born ${rec.dob}` : null, rec.residence_country].filter(Boolean).join(" · "),
      };
    }
    const kyc = c.kyc_checks.find((r) => r.check_id === base);
    if (kyc) return { id, kind: "Identity check", value: [kyc.result, kyc.verified_dob, kyc.document_country].filter(Boolean).join(" · ") };
    const note = c.notes.find((r) => r.note_id === base);
    if (note) return { id, kind: "Note", value: note.channel ?? "note" };
    if (c.hit.hit_id === base) {
      const raw = field ? (c.hit as unknown as Record<string, unknown>)[field] : null;
      const value = Array.isArray(raw) ? raw.join(", ") : raw == null ? "—" : String(raw);
      return { id, kind: "Hit field", value };
    }
    return { id, kind: "Record", value: "—" };
  });
}
