import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CasePanel } from "@/components/case-panel";
import { Stamp } from "@/components/stamp";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useCases } from "@/lib/load";
import type { CaseFile, DecisionName, GateName } from "@/lib/types";

const MixChart = lazy(() => import("@/components/mix-chart").then((m) => ({ default: m.MixChart })));

const DECISIONS: DecisionName[] = ["DIFFERENT_ENTITY", "SAME_ENTITY", "REVIEW"];
const GATES: GateName[] = ["TYPE", "DECEASED", "LOCATION", "TIME", "DOB", "NAME", "AGREEMENT"];
const LINKS = ["account_ref", "login_handle", "email", "fit_search"] as const;

function matches(c: CaseFile, f: Filters) {
  if (f.q) {
    const n = f.q.toLowerCase();
    const blob = `${c.case_id} ${c.title} ${c.decision.hit_id} ${c.decision.reason_code}`.toLowerCase();
    if (!blob.includes(n)) return false;
  }
  if (f.decision && c.decision.decision !== f.decision) return false;
  if (f.reason && c.decision.reason_code !== f.reason) return false;
  if (f.entity && c.hit.entity_type !== f.entity) return false;
  if (f.via && c.trace?.linked_via !== f.via) return false;
  if (f.gate) {
    const g = c.trace?.gates.find((x) => x.gate === f.gate);
    if (!g || (g.result !== "contradiction" && g.result !== "agreement")) return false;
  }
  return true;
}

interface Filters {
  q: string;
  decision: string;
  reason: string;
  entity: string;
  via: string;
  gate: string;
}

export function CasesPage() {
  const { cases, error } = useCases();
  const { id } = useParams();
  const navigate = useNavigate();
  const [f, setF] = useState<Filters>({ q: "", decision: "", reason: "", entity: "", via: "", gate: "" });
  const rows = useMemo(() => (cases ?? []).filter((c) => matches(c, f)), [cases, f]);
  const selected = cases?.find((c) => c.case_id === id) ?? null;
  const reasons = useMemo(() => [...new Set((cases ?? []).map((c) => c.decision.reason_code))].sort(), [cases]);

  function count(key: keyof Filters, value: string) {
    return (cases ?? []).filter((c) => matches(c, { ...f, [key]: value })).length;
  }

  const mix = DECISIONS.map((d) => ({ name: d === "DIFFERENT_ENTITY" ? "Different" : d === "SAME_ENTITY" ? "Same" : "Review", n: rows.filter((c) => c.decision.decision === d).length }));

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Cases</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">122 synthetic Fire Drill hits. Search and filters combine. Open a row for the path, the graph, and the rules.</p>
      <label className="sr-only" htmlFor="case-q">Search cases</label>
      <input id="case-q" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Title, case id, hit id, reason code" className="mt-4 h-9 w-full max-w-md rounded-md border bg-card px-3 text-sm" />
      <div className="mt-3 flex flex-wrap gap-1">
        {DECISIONS.map((d) => (
          <FilterChip key={d} pressed={f.decision === d} onClick={() => setF({ ...f, decision: f.decision === d ? "" : d })} label={`${d === "DIFFERENT_ENTITY" ? "Different" : d === "SAME_ENTITY" ? "Same" : "Review"} ${count("decision", d)}`} />
        ))}
        {["Individual", "Company"].map((e) => (
          <FilterChip key={e} pressed={f.entity === e} onClick={() => setF({ ...f, entity: f.entity === e ? "" : e })} label={`${e} ${count("entity", e)}`} />
        ))}
        {LINKS.map((v) => (
          <FilterChip key={v} pressed={f.via === v} onClick={() => setF({ ...f, via: f.via === v ? "" : v })} label={`${v.replaceAll("_", " ")} ${count("via", v)}`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <select aria-label="Reason code" className="h-8 rounded-md border bg-card px-2 text-sm" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>
          <option value="">Any reason</option>
          {reasons.map((r) => <option key={r} value={r}>{r} ({count("reason", r)})</option>)}
        </select>
        <select aria-label="Rule that fired" className="h-8 rounded-md border bg-card px-2 text-sm" value={f.gate} onChange={(e) => setF({ ...f, gate: e.target.value })}>
          <option value="">Any gate that fired</option>
          {GATES.map((g) => <option key={g} value={g}>{g} ({count("gate", g)})</option>)}
        </select>
      </div>
      <div className="mt-4 max-w-lg">
        <Suspense fallback={null}>
          <MixChart data={mix} />
        </Suspense>
      </div>
      {error ? <p className="mt-4 text-sm" role="alert">Could not load cases ({error}).</p> : null}
      {!cases && !error ? <p className="mt-4 text-sm text-muted-foreground">Loading the bundle…</p> : null}
      <ul className="mt-2 divide-y rounded-xl border bg-card">
        {rows.map((c) => (
          <li key={c.case_id}>
            <button type="button" onClick={() => navigate("/cases/" + c.case_id)} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent">
              <span>
                <span className="block font-medium">{c.title}</span>
                <span className="font-mono text-[12px] text-muted-foreground">{c.case_id} · {c.decision.reason_code}</span>
              </span>
              <Stamp decision={c.decision.decision} />
            </button>
          </li>
        ))}
      </ul>
      {cases && rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No case matches.</p> : null}
      <Sheet open={Boolean(id)} onOpenChange={(open) => { if (!open) navigate("/cases"); }}>
        <SheetContent className="w-[min(100%,42rem)] overflow-y-auto">
          <SheetTitle className="sr-only">{selected?.title ?? "Case"}</SheetTitle>
          {selected ? <CasePanel item={selected} /> : <p className="text-sm text-muted-foreground">That case is not in the bundle.</p>}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterChip({ pressed, onClick, label }: { pressed: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={`rounded-full border px-2.5 py-1 text-[12px] ${pressed ? "border-foreground bg-foreground text-background" : "bg-card"}`}>
      {label}
    </button>
  );
}
