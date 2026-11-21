import { scoreboard } from "@/data/stats";

const SAID = ["DIFFERENT_ENTITY", "SAME_ENTITY", "REVIEW"] as const;

export function Results() {
  const fd = scoreboard.firedrill;
  const g = fd.confusion;
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Results against ground truth</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {scoreboard.source} Figures that this checkout recomputed are marked. The rest are recorded and were not rerun here, because the event data and the organisers' validate.py are not in the repository.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat k={scoreboard.decision_score.toFixed(1)} label="Practice decision score" note={`${scoreboard.labelled} correct. Reason code ${scoreboard.reason_code_pct}%. Customer record ${scoreboard.customer_record_pct}%. Not recomputed here.`} />
        <Stat k={String(scoreboard.unsafe_clearances)} label="Unsafe clears on the 50" note="Wrongly clearing a real match costs 60. None were cleared." />
        <Stat k={String(scoreboard.baseline_name_only)} label="Name-only baseline" note={scoreboard.baseline_note} />
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">The 60-point cost</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Wrongly clearing a real match (calling SAME or REVIEW a DIFFERENT) costs {scoreboard.cost.clear_real_match}. Calling a true DIFFERENT a SAME or a REVIEW costs {scoreboard.cost.different_called_other}. Swapping SAME and REVIEW costs {scoreboard.cost.same_versus_review}. The score is 100 times one minus the cost paid, divided by the cost of reviewing every labelled hit. A score of 100.0 means the cost paid was zero.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex justify-between text-sm"><span>Rules, practice score</span><span className="font-mono">{scoreboard.decision_score.toFixed(1)}</span></div>
            <div className="h-2 rounded-full bg-secondary"><div className="h-2 w-full rounded-full bg-emerald-800" /></div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm"><span>Name-only baseline</span><span className="font-mono">{scoreboard.baseline_name_only}</span></div>
            <div className="h-2 rounded-full bg-secondary"><div className="h-2 rounded-full bg-zinc-500" style={{ width: `${scoreboard.baseline_name_only}%` }} /></div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Fire Drill confusion</h2>
        <p className="mt-1 text-sm text-muted-foreground">{fd.label}. {fd.note}</p>
        <p className="mt-2 text-sm">{fd.correct}/{fd.total} match the expected decision. Unsafe clears: {fd.unsafe}. Cost paid: {fd.cost}.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="mb-2 text-left text-muted-foreground">Rows are the expected decision. Columns are what the engine said.</caption>
            <thead>
              <tr>
                <th className="p-2 text-left font-medium" scope="col">Expected</th>
                {SAID.map((s) => (
                  <th key={s} className="p-2 text-right font-mono text-[11px] font-medium" scope="col">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAID.map((row) => (
                <tr key={row} className="border-t">
                  <th className="p-2 text-left font-mono text-[11px] font-medium" scope="row">{row}</th>
                  {SAID.map((col) => {
                    const n = g[row][col];
                    const hit = row === col;
                    return (
                      <td key={col} className={`p-2 text-right font-mono ${hit ? "font-semibold text-emerald-900" : "text-muted-foreground"}`}>{n}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{scoreboard.confusion_note}</p>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Dev output, counts only</h2>
        <p className="mt-1 text-sm text-muted-foreground">{scoreboard.dev_decisions_note}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-4">
          <Mini k={String(scoreboard.lines)} l="Lines" />
          <Mini k={String(scoreboard.dev_decisions.DIFFERENT_ENTITY)} l="DIFFERENT" />
          <Mini k={String(scoreboard.dev_decisions.REVIEW)} l="REVIEW" />
          <Mini k={String(scoreboard.dev_decisions.SAME_ENTITY)} l="SAME" />
        </dl>
        <p className="mt-3 font-mono text-[12px] text-muted-foreground">sha256 {scoreboard.repro.fingerprint}</p>
        <p className="mt-2 text-sm text-muted-foreground">{scoreboard.repro.note}</p>
        <p className="mt-2 text-sm text-muted-foreground">{scoreboard.run_seconds_note} Recorded validate.py result: {scoreboard.lines} lines, {scoreboard.problems} problems.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Fire Drill output sha256 {fd.sha256}. The two hash seeds matched: {fd.identical_across_seeds ? "yes" : "no"}. Run times {fd.run_seconds.map((n) => `${n}s`).join(" and ")}.
        </p>
      </section>
    </div>
  );
}

function Stat({ k, label, note }: { k: string; label: string; note: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="font-mono text-3xl tracking-tight">{k}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{note}</p>
    </div>
  );
}

function Mini({ k, l }: { k: string; l: string }) {
  return (
    <div className="rounded-lg bg-secondary/70 px-3 py-2">
      <div className="font-mono text-xl">{k}</div>
      <div className="text-[12px] text-muted-foreground">{l}</div>
    </div>
  );
}
