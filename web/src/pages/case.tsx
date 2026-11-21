import { Link, useParams } from "react-router-dom";
import { Stamp } from "@/components/stamp";
import { evidenceRows } from "@/lib/graph";
import { useCase } from "@/lib/load";
import { formatFact, gate, gateMeaning, oneFact } from "@/lib/rules";
import type { GateName } from "@/lib/types";

const ORDER: GateName[] = ["TYPE", "DECEASED", "LOCATION", "TIME", "DOB", "NAME", "AGREEMENT"];

const VIA: Record<string, string> = {
  account_ref: "The alert carried an account reference. The engine followed it to the customer.",
  login_handle: "The alert carried a login handle. The engine followed it to the customer.",
  email: "The alert carried an email. The engine followed it to the customer.",
  fit_search: "The alert had no usable link. The engine searched by the screened date of birth and country, then the name.",
  none: "No customer record could be resolved.",
};

export function CasePage() {
  const { id } = useParams();
  const { item, error } = useCase(id);
  if (error) return <p role="alert">Could not load cases ({error}).</p>;
  if (!item) return <p className="text-sm text-muted-foreground">Loading {id}…</p>;
  const fact = oneFact(item);
  const rows = evidenceRows(item);
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Decision path · {item.case_id}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{item.title}</h1>
        <Stamp decision={item.decision.decision} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Each step is a fact from this hit's trace, with the record it came from. <Link className="underline" to={"/graph/" + item.case_id}>Open the graph</Link>.
      </p>
      <ol className="mt-6 space-y-3">
        <li className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">1 · Customer</p>
          <p className="mt-1 text-sm">{VIA[item.trace?.linked_via ?? "none"] ?? item.trace?.linked_via}</p>
          <p className="mt-1 font-mono text-[12px] text-muted-foreground">
            {(item.trace?.persons ?? []).map((p) => p.record_ids.join(", ")).join(" · ") || "no record"}
            {item.trace?.persons?.some((p) => p.merged_by && p.merged_by !== "none")
              ? " · merged by " + item.trace.persons.map((p) => p.merged_by).join(", ")
              : ""}
          </p>
        </li>
        {ORDER.map((name, i) => {
          const g = gate(item, name);
          return (
            <li key={name} className="rounded-xl border bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{i + 2} · {name}</p>
              <p className="mt-1 text-sm font-medium capitalize">{(g?.result ?? "unknown").replaceAll("_", " ")}</p>
              <p className="text-sm text-muted-foreground">{gateMeaning(g?.result)}</p>
              {g?.blocked_by ? <p className="text-sm text-muted-foreground">Blocked: {g.blocked_by}</p> : null}
              <dl className="mt-2 space-y-1">
                {Object.entries(g?.facts ?? {}).map(([k, v]) => {
                  const fact = formatFact(k, v);
                  return (
                    <div key={k} className="flex gap-3 text-sm">
                      <dt className="w-44 shrink-0 text-muted-foreground">{fact.label}</dt>
                      <dd className="font-mono text-[12px]">{fact.value}</dd>
                    </div>
                  );
                })}
              </dl>
              {g?.evidence?.length ? <p className="mt-2 font-mono text-[12px] text-muted-foreground">Evidence {g.evidence.join(", ")}</p> : null}
            </li>
          );
        })}
        <li className="rounded-xl border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Decision</p>
          <p className="mt-1 font-mono text-sm">{item.decision.decision} · {item.decision.reason_code}</p>
          <p className="mt-2 text-sm leading-relaxed">{item.decision.reason}</p>
          <ul className="mt-3 space-y-1">
            {rows.map((r) => (
              <li key={r.id} className="text-sm"><span className="font-mono text-[12px]">{r.id}</span> · {r.kind} · {r.value}</li>
            ))}
          </ul>
          {fact ? <p className="mt-3 text-sm text-muted-foreground">One fact that would change this: {fact}</p> : null}
        </li>
      </ol>
    </div>
  );
}
