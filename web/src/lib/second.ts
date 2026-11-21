import type { CaseFile, DecisionName } from "./types";

const MAP: Record<string, DecisionName> = {
  TRUE_POSITIVE: "SAME_ENTITY",
  FALSE_POSITIVE: "DIFFERENT_ENTITY",
  UNRESOLVED: "REVIEW",
};
const OK = new Set<string>(["DIFFERENT_ENTITY", "SAME_ENTITY", "REVIEW"]);

export function cost(theirs: DecisionName, ours: DecisionName): number {
  if (theirs === ours) return 0;
  if (theirs === "DIFFERENT_ENTITY") return 60;
  if (ours === "DIFFERENT_ENTITY") return 3;
  return 2;
}

export function parseJsonl(text: string): { rows: { hit_id: string; theirs: DecisionName }[]; bad: string[] } {
  const rows: { hit_id: string; theirs: DecisionName }[] = [];
  const bad: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    try {
      const o = JSON.parse(line) as { hit_id?: string; decision?: string; determination?: string };
      const d = (o.decision && OK.has(o.decision) ? o.decision : o.determination ? MAP[o.determination] : undefined) as
        | DecisionName
        | undefined;
      if (!o || typeof o.hit_id !== "string" || !d) throw new Error("needs hit_id and decision or determination");
      rows.push({ hit_id: o.hit_id, theirs: d });
    } catch (e) {
      bad.push("line " + (i + 1) + ": " + (e instanceof Error ? e.message : "unreadable"));
    }
  });
  return { rows, bad };
}

export interface DiffRow {
  hit_id: string;
  theirs: DecisionName;
  ours: DecisionName;
  code: string;
  cost: number;
  case_id: string;
}

export function compare(cases: CaseFile[], rows: { hit_id: string; theirs: DecisionName }[]) {
  const ours = new Map(cases.map((c) => [c.decision.hit_id, c]));
  const diffs: DiffRow[] = [];
  let agree = 0;
  let unknown = 0;
  for (const r of rows) {
    const c = ours.get(r.hit_id);
    if (!c) {
      unknown += 1;
      continue;
    }
    const k = cost(r.theirs, c.decision.decision);
    if (!k) agree += 1;
    else diffs.push({ hit_id: r.hit_id, theirs: r.theirs, ours: c.decision.decision, code: c.decision.reason_code, cost: k, case_id: c.case_id });
  }
  diffs.sort((a, b) => b.cost - a.cost || a.hit_id.localeCompare(b.hit_id));
  return { agree, unknown, diffs };
}
