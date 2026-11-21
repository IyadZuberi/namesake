import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Stamp } from "@/components/stamp";
import { useCases } from "@/lib/load";
import type { DecisionName } from "@/lib/types";

const FILTERS: { id: "ALL" | DecisionName; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "DIFFERENT_ENTITY", label: "Different" },
  { id: "SAME_ENTITY", label: "Same" },
  { id: "REVIEW", label: "Review" },
];

export function CasesPage() {
  const { cases, error } = useCases();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("ALL");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (cases ?? []).filter((c) => {
      if (filter !== "ALL" && c.decision.decision !== filter) return false;
      if (!needle) return true;
      return (c.case_id + " " + c.title + " " + c.decision.reason_code).toLowerCase().includes(needle);
    });
  }, [cases, q, filter]);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Cases</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        122 Fire Drill hits. Every name is invented. Open a case for the step-by-step path, or the graph for the same trace drawn out.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="case-q">Search cases</label>
        <input
          id="case-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or reason code"
          className="h-9 w-64 rounded-md border bg-card px-3 text-sm"
        />
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === f.id ? "border-foreground bg-foreground text-background" : "bg-card"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error ? <p className="mt-4 text-sm" role="alert">Could not load cases ({error}).</p> : null}
      {!cases && !error ? <p className="mt-4 text-sm text-muted-foreground">Loading the bundle…</p> : null}
      <ul className="mt-4 divide-y rounded-xl border bg-card">
        {rows.map((c) => (
          <li key={c.case_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link to={"/cases/" + c.case_id} className="font-medium underline-offset-4 hover:underline">{c.title}</Link>
              <p className="font-mono text-[12px] text-muted-foreground">{c.case_id} · {c.decision.reason_code}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link to={"/graph/" + c.case_id} className="text-sm text-muted-foreground underline-offset-4 hover:underline">Graph</Link>
              <Stamp decision={c.decision.decision} />
            </div>
          </li>
        ))}
      </ul>
      {cases && rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No case matches that filter.</p> : null}
    </div>
  );
}
