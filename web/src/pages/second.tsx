import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui";
import { Stamp } from "@/components/stamp";
import { useCases } from "@/lib/load";
import { compare, parseJsonl, type DiffRow } from "@/lib/second";

export function SecondPage() {
  const { cases, error } = useCases();
  const [text, setText] = useState("");
  const [report, setReport] = useState<{ agree: number; unknown: number; diffs: DiffRow[]; bad: string[] } | null>(null);

  function run(source: string) {
    if (!cases) return;
    const { rows, bad } = parseJsonl(source);
    const r = compare(cases, rows);
    setReport({ ...r, bad });
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Second Opinion</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Paste decisions, one hit per line. The comparison runs in the browser. Nothing is uploaded. This ranks the cost of the disagreement assuming our decision is right. It does not prove which side is right.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        A line needs <span className="font-mono">hit_id</span> and <span className="font-mono">decision</span>, or <span className="font-mono">determination</span> (TRUE_POSITIVE, FALSE_POSITIVE, UNRESOLVED). That mapping is untested against a real export. Cost if ours is right: they cleared what we call same or review = 60; they flagged what we cleared = 3; same versus review = 2.
      </p>
      {error ? <p className="mt-3 text-sm" role="alert">Could not load our cases ({error}).</p> : null}
      <label htmlFor="so-in" className="mt-4 block text-sm font-medium">Decisions</label>
      <textarea id="so-in" value={text} onChange={(e) => setText(e.target.value)} rows={8} className="mt-1 w-full rounded-md border bg-card p-3 font-mono text-[12px]" placeholder='{"hit_id":"H-93BD04","decision":"SAME_ENTITY"}' />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={() => run(text)} disabled={!cases}>Compare</Button>
        <Button
          type="button"
          variant="outline"
          disabled={!cases}
          onClick={() => {
            if (!cases) return;
            const sample = cases.slice(0, 6).map((c, i) => JSON.stringify({
              hit_id: c.decision.hit_id,
              decision: i === 0 ? "SAME_ENTITY" : i === 1 ? "DIFFERENT_ENTITY" : c.decision.decision,
            })).join("\n");
            setText(sample);
            run(sample);
          }}
        >
          Load a synthetic example
        </Button>
      </div>
      {report ? (
        <div className="mt-6 space-y-3" aria-live="polite">
          <p className="text-sm">{report.agree} agree · {report.diffs.length} disagree · {report.unknown} hit ids not in these cases · {report.bad.length} unreadable lines</p>
          {report.bad.length ? <p className="text-sm text-muted-foreground">{report.bad.slice(0, 3).join("; ")}</p> : null}
          {report.diffs.length ? (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <caption className="sr-only">Disagreements, highest cost first</caption>
                <thead>
                  <tr className="border-b text-left">
                    {["Hit", "Theirs", "Ours", "Our reason", "Cost", "Case"].map((h) => <th key={h} scope="col" className="p-2 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {report.diffs.map((d) => (
                    <tr key={d.hit_id} className="border-b">
                      <td className="p-2 font-mono text-[12px]">{d.hit_id}</td>
                      <td className="p-2"><Stamp decision={d.theirs} /></td>
                      <td className="p-2"><Stamp decision={d.ours} /></td>
                      <td className="p-2 font-mono text-[12px]">{d.code}</td>
                      <td className="p-2 font-medium">{d.cost}</td>
                      <td className="p-2"><Link className="underline" to={"/cases/" + d.case_id}>{d.case_id}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm">No disagreements on the hits we could match.</p>}
        </div>
      ) : null}
    </div>
  );
}
