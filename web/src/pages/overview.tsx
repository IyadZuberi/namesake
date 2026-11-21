import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui";
import { Stamp } from "@/components/stamp";
import { showcase as item } from "@/data/showcase";
import { scoreboard } from "@/data/stats";
const ease = [0.22, 1, 0.36, 1] as const;

export function Overview() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div initial={{ opacity: 1, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-900">Sanctions and PEP screening</p>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
            Is this sanctions hit really your customer?
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Namesake checks every screening hit against the bank's own records and clears it only when a written rule proves it's a different person.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/cases/S-0072">Walk through a case</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/results">See results</Link>
            </Button>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 1, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease }}
          className="rounded-2xl border bg-card p-4 shadow-[0_24px_60px_-36px_rgba(16,20,15,0.45)]"
        >
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <p className="font-mono text-[11px] text-muted-foreground">{item.case_id} · {item.hit.hit_id}</p>
              <p className="text-sm font-medium">{item.title}</p>
            </div>
            <Stamp decision={item.decision.decision} />
          </div>
          <p className="mt-3 text-sm leading-relaxed">{item.decision.reason}</p>
          <ul className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {(item.trace?.gates ?? []).slice(0, 7).map((g) => (
              <li key={g.gate} className="rounded-md border bg-secondary/50 px-2 py-1.5">
                <div className="font-mono text-[10px] text-muted-foreground">{g.gate}</div>
                <div className="text-[12px] font-medium capitalize">{g.result.replaceAll("_", " ")}</div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Fire Drill case, invented name. The reason is the engine's template, filled from this hit's own trace.
          </p>
        </motion.div>
      </section>

      <section aria-label="Measured results" className="rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Measured results</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{scoreboard.source}</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/results">Full results</Link>
          </Button>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            ["100.0", "Practice decision score", "Recorded, not recomputed here"],
            ["0", "Unsafe clears", "Practice labels and Fire Drill"],
            ["122/122", "Fire Drill traps", "Recomputed on this machine"],
            ["17.6", "Name-only baseline", "Practice labels, not recomputed here"],
          ].map(([n, l, s]) => (
            <div key={l} className="rounded-xl bg-secondary/70 px-4 py-3">
              <dd className="font-mono text-2xl font-medium tracking-tight">{n}</dd>
              <dt className="mt-1 text-sm font-medium">{l}</dt>
              <p className="text-[12px] text-muted-foreground">{s}</p>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label="Trust" className="grid gap-4 sm:grid-cols-4">
        {[
          ["Synthetic data", "Every name on this site comes from the Fire Drill set. It carries a SYNTHETIC marker."],
          ["Deterministic", "Same files, same decisions. The committed dev output sha256 starts f454c71d."],
          ["No keys in the browser", "The site is a static build. It does not call a model and it does not upload a case."],
          ["Rules decide", "The scored engine is Python. A missing fact stays unknown and goes to a person."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
