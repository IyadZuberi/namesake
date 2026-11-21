import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CompareTable } from "@/components/compare-table";
import { Stamp } from "@/components/stamp";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCases } from "@/lib/load";
import { RULES } from "@/lib/rules";
import type { CaseFile, DecisionName } from "@/lib/types";

const KnowledgeGraph = lazy(() => import("@/components/knowledge-graph").then((m) => ({ default: m.KnowledgeGraph })));

const VERDICTS: { id: DecisionName; label: string }[] = [
  { id: "DIFFERENT_ENTITY", label: "Different" },
  { id: "SAME_ENTITY", label: "Same" },
  { id: "REVIEW", label: "Review" },
];

export function CasesPage() {
  const { cases, error } = useCases();
  const { id } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [verdict, setVerdict] = useState("");
  const [reason, setReason] = useState("");
  const reasons = useMemo(() => [...new Set((cases ?? []).map((c) => c.decision.reason_code))].sort(), [cases]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (cases ?? []).filter((c) => {
      if (verdict && c.decision.decision !== verdict) return false;
      if (reason && c.decision.reason_code !== reason) return false;
      if (!needle) return true;
      return `${c.case_id} ${c.title} ${c.decision.hit_id} ${c.decision.reason_code}`.toLowerCase().includes(needle);
    });
  }, [cases, q, verdict, reason]);
  const selected = rows.find((c) => c.case_id === id) ?? (!id ? rows[0] : undefined);

  useEffect(() => {
    if (!id && rows[0]) navigate("/cases/" + rows[0].case_id, { replace: true });
  }, [id, rows, navigate]);

  return (
    <div className="-mx-4 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
      <aside className="border-b px-4 pb-4 lg:border-b-0 lg:border-r lg:pr-4">
        <h1 className="font-display text-3xl">Workbench</h1>
        <label className="sr-only" htmlFor="q">Search</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="mt-3 h-9 w-full border-b bg-transparent text-sm outline-none" />
        <div className="mt-3 flex flex-wrap gap-1">
          {VERDICTS.map((v) => (
            <button key={v.id} type="button" aria-pressed={verdict === v.id} onClick={() => setVerdict(verdict === v.id ? "" : v.id)} className={`rounded-full px-2.5 py-1 text-[12px] ${verdict === v.id ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {v.label}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="reason">Reason code</label>
        <select id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-3 h-8 w-full bg-transparent text-sm">
          <option value="">Any reason</option>
          {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {error ? <p className="mt-3 text-sm" role="alert">{error}</p> : null}
        {!cases && !error ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p> : null}
        <ul className="mt-3 max-h-[40vh] overflow-auto lg:max-h-[70vh]">
          {rows.map((c) => (
            <li key={c.case_id}>
              <button type="button" onClick={() => navigate("/cases/" + c.case_id)} className={`block w-full py-2 text-left ${selected?.case_id === c.case_id ? "text-foreground" : "text-muted-foreground"}`}>
                <span className="block text-sm">{c.title}</span>
                <span className="font-mono text-[11px]">{c.decision.reason_code}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="px-4 pt-6">
        {selected ? <Detail item={selected} /> : <p className="text-sm text-muted-foreground">No case matches.</p>}
      </section>
    </div>
  );
}

function Detail({ item }: { item: CaseFile }) {
  const fired = RULES.filter((r) => r.fires(item));
  const decided = fired.filter((r) => r.decisive(item));
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] text-muted-foreground">{item.case_id}</p>
          <h2 className="font-display text-4xl">{item.title}</h2>
        </div>
        <Stamp decision={item.decision.decision} />
      </div>
      <p className="mt-2 font-mono text-[12px] text-muted-foreground">{item.decision.reason_code}</p>
      <div className="mt-6">
        <CompareTable item={item} />
      </div>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the graph…</p>}>
          <KnowledgeGraph key={item.case_id} item={item} />
        </Suspense>
      </div>
      <p className="mt-6 text-sm">{fired.length} of {RULES.length} rules fired. {decided.length ? decided.map((r) => r.name).join(", ") + " decided." : "None decided."}</p>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{item.decision.reason}</p>
      <Sheet>
        <SheetTrigger className="mt-4 text-sm underline">View raw</SheetTrigger>
        <SheetContent className="w-[min(100%,40rem)] overflow-auto">
          <SheetTitle>Engine trace</SheetTitle>
          <pre className="mt-4 whitespace-pre-wrap font-mono text-[11px]">{JSON.stringify({ decision: item.decision, trace: item.trace }, null, 2)}</pre>
        </SheetContent>
      </Sheet>
    </div>
  );
}
