import { Link } from "react-router-dom";
import { useCases } from "@/lib/load";
import { GH, PRINCIPLES, REASON_CODES } from "@/lib/policy";
import type { CaseFile } from "@/lib/types";

function decided(cases: CaseFile[], code: string) {
  return cases.filter((c) => c.decision.reason_code === code).length;
}

function gateFired(cases: CaseFile[], gate: string) {
  return cases.filter((c) => c.trace?.gates.some((g) => g.gate === gate && (g.result === "contradiction" || g.result === "agreement" || g.result === "blocked"))).length;
}

export function PolicyPage() {
  const { cases, error } = useCases();
  const n = cases?.length ?? 0;
  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl">Policy</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Nine principles, taken from the engine comments and the policy map in the README. Eleven reason codes, taken from gates.py and decide.py. Counts are this Fire Drill bundle{n ? ` (${n} cases)` : ""}.
        </p>
      </header>
      {error ? <p role="alert">Could not load cases ({error}).</p> : null}
      <section>
        <h2 className="text-lg font-semibold">Principles</h2>
        <ol className="mt-3 space-y-3">
          {PRINCIPLES.map((p) => (
            <li key={p.n} id={"p-" + p.n} className="rounded-xl border bg-card/70 p-4">
              <p className="font-mono text-[11px] text-muted-foreground">Principle {p.n}</p>
              <h3 className="font-medium">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
              <p className="mt-2 text-sm">
                <a className="underline" href={GH + p.file}>{p.file}</a>
                {p.gate ? <> · gate <Link className="underline" to={"/graph/S-0072?rule=" + p.gate}>{p.gate}</Link></> : null}
              </p>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Reason codes</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3" scope="col">Code</th>
                <th className="py-2 pr-3" scope="col">Decision</th>
                <th className="py-2 pr-3" scope="col">Gate</th>
                <th className="py-2 pr-3" scope="col">Code</th>
                <th className="py-2 pr-3" scope="col">Fired</th>
                <th className="py-2" scope="col">Decided</th>
              </tr>
            </thead>
            <tbody>
              {REASON_CODES.map((r) => (
                <tr key={r.code} className="border-b">
                  <th className="py-2 pr-3 text-left font-mono text-[12px]" scope="row">{r.code}</th>
                  <td className="py-2 pr-3">{r.decision}</td>
                  <td className="py-2 pr-3"><Link className="underline" to={"/graph/S-0072?rule=" + r.code}>{r.gate}</Link></td>
                  <td className="py-2 pr-3"><a className="underline" href={GH + r.file}>{r.file.replace("system/mirror/", "")}</a></td>
                  <td className="py-2 pr-3 font-mono">{cases ? gateFired(cases, r.gate) : "…"}</td>
                  <td className="py-2 font-mono">{cases ? decided(cases, r.code) : "…"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">Fired counts a gate that agreed, contradicted, or was blocked. Decided counts the reason code on the output line. A gate can fire and still not decide, because an earlier contradiction wins.</p>
      </section>
    </div>
  );
}
