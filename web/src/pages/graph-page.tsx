import { lazy, Suspense, useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { evidenceRows } from "@/lib/graph";
import { useCase } from "@/lib/load";
import { GROUPS, nodesForRule, oneFact, RULES } from "@/lib/rules";
import { RuleMap } from "@/components/rule-map";
import { Stamp } from "@/components/stamp";

const KnowledgeGraph = lazy(() => import("@/components/knowledge-graph").then((m) => ({ default: m.KnowledgeGraph })));

export function GraphPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const ruleId = params.get("rule") ?? "";
  const { item, cases, error } = useCase(id);
  const highlightIds = useMemo(() => nodesForRule(ruleId), [ruleId]);
  const focusId = highlightIds[0];
  if (error) return <p role="alert">Could not load cases ({error}).</p>;
  if (!item) return <p className="text-sm text-muted-foreground">Loading the Fire Drill cases…</p>;
  const rows = evidenceRows(item);
  const fact = oneFact(item);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <label htmlFor="case-pick" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Synthetic case</label>
          <select
            id="case-pick"
            className="mt-1 block h-9 max-w-md rounded-md border bg-card px-2 text-sm"
            value={item.case_id}
            onChange={(e) => navigate("/graph/" + e.target.value)}
          >
            {(cases ?? [item]).map((c) => (
              <option key={c.case_id} value={c.case_id}>{c.case_id} · {c.title}</option>
            ))}
          </select>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{item.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {item.case_id} · invented customer. The graph is this hit's trace: the alert, the customer record, the facts, the seven gates, and the decision. Green edges agree. Red edges contradict. The animated edge is the path that decided it.
          </p>
        </div>
        <Stamp decision={item.decision.decision} />
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-auto lg:pr-1">
          <RuleMap
            item={item}
            active={ruleId}
            onPick={(rid) => {
              const next = new URLSearchParams(params);
              next.set("rule", rid);
              setParams(next);
            }}
          />
        </aside>
        <div className="min-w-0 space-y-4">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the graph…</p>}>
            <KnowledgeGraph key={item.case_id + ruleId} item={item} highlightIds={highlightIds} focusId={focusId} />
          </Suspense>
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
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Rules</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The whole policy, not one case. A clear happens only on a contradiction. Same person needs a name and a date of birth. Same company needs a name and a country. Anything else stays a review. Open a rule on the worked example to see where it sits in the graph.
      </p>
      <div className="mt-6 space-y-5">
        {GROUPS.map((group) => (
          <section key={group}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group}</h2>
            <ul className="mt-2 space-y-1">
              {RULES.filter((r) => r.group === group).map((rule) => (
                <li key={rule.id}>
                  <Link to={"/graph/S-0072?rule=" + encodeURIComponent(rule.id)} className="block rounded-lg border bg-card px-3 py-2 hover:bg-accent">
                    <span className="font-mono text-[12px] font-medium">{rule.name}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{rule.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
