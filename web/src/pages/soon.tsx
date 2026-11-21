import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { scoreboard } from "@/data/stats";

const STEPS = [
  ["Load", `${scoreboard.firedrill.stages_ms.load} ms`, `${scoreboard.firedrill.files.alerts} alerts, ${scoreboard.firedrill.files.customers} customers, ${scoreboard.firedrill.files.hits} hits`],
  ["Resolve the customer", `${scoreboard.firedrill.stages_ms.resolve} ms`, "Account, then login, then email. With no link, screened date of birth and country, then the name."],
  ["Read the hit", `${scoreboard.firedrill.stages_ms.hit_facts} ms`, "Birth years, countries, dated reports, death date."],
  ["Seven gates, then the reason", `${scoreboard.firedrill.stages_ms.decide} ms`, "Clear order: type, deceased, location, time, date of birth, name. Then agreement."],
] as const;

export function HowPage() {
  const [shown, setShown] = useState<number>(STEPS.length);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(STEPS.length);
      setPlaying(false);
      return;
    }
    if (shown >= STEPS.length) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setShown((n) => n + 1), 700);
    return () => window.clearTimeout(t);
  }, [playing, shown]);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        The milliseconds are a Fire Drill run on this machine, measured by calling the same engine functions. They are not the 819-hit dev run, and they are not the speed of this animation.
      </p>
      <Button
        type="button"
        className="mt-4"
        variant="outline"
        onClick={() => {
          setShown(0);
          setPlaying(true);
        }}
      >
        Play the four steps
      </Button>
      <ol className="mt-6 space-y-3">
        {STEPS.slice(0, shown).map(([t, ms, d], i) => (
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
