import { Link } from "react-router-dom";
import { showcase as item } from "@/data/showcase";
import { scoreboard } from "@/data/stats";
import { Stamp } from "@/components/stamp";

export function HowPage() {
  const s = scoreboard.firedrill;
  const steps = [
    ["Load", `${s.stages_ms.load} ms`, `${s.files.alerts} alerts, ${s.files.customers} customers, ${s.files.hits} hits`],
    ["Resolve the customer", `${s.stages_ms.resolve} ms`, "Account, login, or email, then a screened-details search"],
    ["Read the hit", `${s.stages_ms.hit_facts} ms`, "Birth years, countries, dated reports, death date"],
    ["Seven gates, then the reason", `${s.stages_ms.decide} ms`, "Type, deceased, location, time, date of birth, name, agreement"],
  ];
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Timings are a Fire Drill run on this machine, measured by calling the same engine functions outside the scored path. They are not the 819-hit dev run.
      </p>
      <ol className="mt-6 space-y-3">
        {steps.map(([t, ms, d], i) => (
          <li key={t} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4 rounded-xl border bg-card px-4 py-3">
            <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
            <span>
              <span className="font-medium">{t}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{d}</span>
            </span>
            <span className="font-mono text-sm">{ms}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CasesPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Cases</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        This preview opens one Fire Drill case. The other 121 synthetic cases are in the bundle and will be listed here next.
      </p>
      <Link to="/graph" className="mt-6 flex max-w-xl items-center justify-between gap-4 rounded-xl border bg-card p-4 hover:bg-accent">
        <span>
          <span className="block font-medium">{item.title}</span>
          <span className="font-mono text-[12px] text-muted-foreground">{item.case_id} · {item.decision.reason_code}</span>
        </span>
        <Stamp decision={item.decision.decision} />
      </Link>
    </div>
  );
}

export function SecondPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">Second Opinion</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Paste another system's decisions and compare them in the browser. Nothing is uploaded. A disagreement is ranked by its cost if our decision is right: they cleared what we call same or review costs 60, they flagged what we cleared costs 3, and same versus review costs 2. That ranking does not prove which side is right. The comparison tool is the next commit on this branch.
      </p>
    </div>
  );
}
