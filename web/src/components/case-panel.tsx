import { lazy, Suspense } from "react";
import { compareSides, evidenceRows } from "@/lib/graph";
import { formatFact, gate, gateMeaning, oneFact, RULES } from "@/lib/rules";
import type { CaseFile, GateName } from "@/lib/types";
import { RuleMap } from "@/components/rule-map";
import { Stamp } from "@/components/stamp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const KnowledgeGraph = lazy(() => import("@/components/knowledge-graph").then((m) => ({ default: m.KnowledgeGraph })));

const ORDER: GateName[] = ["TYPE", "DECEASED", "LOCATION", "TIME", "DOB", "NAME", "AGREEMENT"];

export function CasePanel({ item }: { item: CaseFile }) {
  const fact = oneFact(item);
  const rows = evidenceRows(item);
  const fired = RULES.filter((r) => r.fires(item));
  const decided = fired.filter((r) => r.decisive(item));
  const clearAt = ORDER.findIndex((name) => gate(item, name)?.result === "contradiction" && item.decision.decision === "DIFFERENT_ENTITY");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
        <div>
          <p className="font-mono text-[11px] text-muted-foreground">{item.case_id}</p>
          <h2 className="text-lg font-semibold leading-tight">{item.title}</h2>
        </div>
        <Stamp decision={item.decision.decision} />
      </div>
      <Tabs defaultValue="summary" className="mt-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="path">Decision path</TabsTrigger>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="rules">All rules</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <table className="w-full text-sm">
            <caption className="mb-2 text-left text-muted-foreground">Customer against the listed person. Match, conflict, or missing comes from this hit's gates.</caption>
            <thead>
              <tr className="border-b text-left">
                <th className="py-1 pr-2 font-medium" scope="col">Fact</th>
                <th className="py-1 pr-2 font-medium" scope="col">Customer</th>
                <th className="py-1 pr-2 font-medium" scope="col">Hit</th>
                <th className="py-1 font-medium" scope="col">Mark</th>
              </tr>
            </thead>
            <tbody>
              {compareSides(item).map((row) => (
                <tr key={row.label} className="border-b">
                  <th className="py-1.5 pr-2 text-left font-medium" scope="row">{row.label}</th>
                  <td className="py-1.5 pr-2">{row.customer}</td>
                  <td className="py-1.5 pr-2">{row.hit}</td>
                  <td className="py-1.5">
                    <span className={row.mark === "match" ? "text-emerald-700 dark:text-emerald-300" : row.mark === "conflict" ? "text-rose-700 dark:text-rose-300" : "text-amber-800 dark:text-amber-200"}>
                      {row.mark}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-4 text-sm font-semibold">Rules that affected this case</h3>
          <p className="mt-1 text-sm">{fired.length} of {RULES.length} rules fired, {decided.length} decided.</p>
          <ul className="mt-1 space-y-1">
            {RULES.map((rule) => (
              <li key={rule.id} className="text-[12px]">
                <span className="font-mono">{rule.name}</span>
                <span className="text-muted-foreground"> · {rule.fires(item) ? (rule.decisive(item) ? "decided" : "fired") : "not fired"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm leading-relaxed">{item.decision.reason}</p>
          <ul className="mt-3 space-y-1">
            {rows.map((r) => (
              <li key={r.id} className="text-sm"><span className="font-mono text-[12px]">{r.id}</span> · {r.kind} · {r.value}</li>
            ))}
          </ul>
          {fact ? <p className="mt-3 text-sm text-muted-foreground">One fact that would change this: {fact}</p> : null}
        </TabsContent>
        <TabsContent value="path">
          <ol className="space-y-2">
            {ORDER.map((name, i) => {
              const g = gate(item, name);
              const past = clearAt >= 0 && i > clearAt;
              return (
                <li key={name} className={`rounded-lg border p-3 ${past ? "opacity-50" : ""} ${i === clearAt ? "border-rose-800 bg-rose-50" : "bg-card"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{name}</p>
                    <span className="text-[12px] capitalize">{(g?.result ?? "unknown").replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-1 text-sm">{gateMeaning(g?.result)}{past ? " Not needed: an earlier contradiction already cleared the hit." : ""}</p>
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(g?.facts ?? {}).map(([k, v]) => {
                      const f = formatFact(k, v);
                      return <li key={k} className="text-[12px] text-muted-foreground">{f.label}: {f.value}</li>;
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        </TabsContent>
        <TabsContent value="graph">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the graph…</p>}>
            <KnowledgeGraph item={item} />
          </Suspense>
        </TabsContent>
        <TabsContent value="rules">
          <p className="mb-2 text-sm">{fired.length} of {RULES.length} rules fired, {decided.length} decided.</p>
          <RuleMap item={item} />
        </TabsContent>
        <TabsContent value="raw">
          <details open>
            <summary className="cursor-pointer text-sm font-medium">Engine trace and output line</summary>
            <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-secondary p-3 font-mono text-[11px] leading-relaxed">{JSON.stringify({ decision: item.decision, trace: item.trace }, null, 2)}</pre>
          </details>
        </TabsContent>
      </Tabs>
    </div>
  );
}
