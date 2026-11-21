import { showcase as item } from "@/data/showcase";
import { evidenceRows } from "@/lib/graph";
import { oneFact } from "@/lib/rules";
import { KnowledgeGraph } from "@/components/knowledge-graph";
import { RuleMap } from "@/components/rule-map";
import { Stamp } from "@/components/stamp";

export function GraphPage() {
  const rows = evidenceRows(item);
  const fact = oneFact(item);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">One synthetic case</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{item.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {item.case_id} · invented customer. The graph is this hit's trace: the alert, the customer record, the facts, the seven gates, and the decision. Green edges agree. Red edges contradict. The animated edge is the path that decided it.
          </p>
        </div>
        <Stamp decision={item.decision.decision} />
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-auto lg:pr-1">
          <RuleMap item={item} />
        </aside>
        <div className="min-w-0 space-y-4">
          <KnowledgeGraph item={item} />
          <section className="rounded-xl border bg-card p-4" aria-label="Reason and evidence">
            <h2 className="text-sm font-semibold">Reason</h2>
            <p className="mt-1 text-sm leading-relaxed">{item.decision.reason}</p>
            <h3 className="mt-4 text-sm font-semibold">Evidence</h3>
            <ul className="mt-1 space-y-1">
              {rows.map((r) => (
                <li key={r.id} className="text-sm">
                  <span className="font-mono text-[12px]">{r.id}</span>
                  <span className="text-muted-foreground"> · {r.kind} · {r.value}</span>
                </li>
              ))}
            </ul>
            {fact ? (
              <>
                <h3 className="mt-4 text-sm font-semibold">One fact that would change this</h3>
                <p className="mt-1 text-sm text-muted-foreground">{fact}</p>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

export function RulesPage() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Rules</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The same map as the graph, for {item.case_id}. Clear only on a contradiction. Same person needs a name and a date of birth. Same company needs a name and a country. Anything else is a review.
        </p>
        <div className="mt-6 max-w-xl">
          <RuleMap item={item} />
        </div>
      </div>
      <aside className="h-fit rounded-xl border bg-card p-4">
        <Stamp decision={item.decision.decision} />
        <p className="mt-3 text-sm font-medium">{item.title}</p>
        <p className="mt-2 font-mono text-[12px] text-muted-foreground">{item.decision.reason_code}</p>
      </aside>
    </div>
  );
}
