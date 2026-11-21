import { GROUPS, RULES } from "@/lib/rules";
import type { CaseFile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RuleMap({ item, active, onPick }: { item: CaseFile; active?: string; onPick?: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Rule map</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">Every written rule</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A hit is cleared only on a contradiction. The first one in engine order wins: type, deceased, location, time, date of birth, name. Lit rows are the rules this case set off. The marked row decided it.
        </p>
      </div>
      {GROUPS.map((group) => (
        <section key={group} aria-label={group}>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group}</h3>
          <ul className="space-y-1">
            {RULES.filter((r) => r.group === group).map((rule) => {
              const fired = rule.fires(item);
              const decisive = fired && rule.decisive(item);
              return (
                <li key={rule.id}>
                  <button
                    type="button"
                    aria-current={decisive ? "true" : undefined}
                    aria-pressed={active === rule.id}
                    onClick={() => onPick?.(rule.id)}
                    className={cn(
                      "w-full rounded-lg border px-2.5 py-1.5 text-left",
                      decisive && "border-rose-800 bg-rose-50",
                      fired && !decisive && "border-emerald-800/30 bg-accent",
                      !fired && "border-transparent bg-secondary/60",
                      active === rule.id && "ring-2 ring-ring",
                    )}
                  >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-medium text-foreground">{rule.name}</span>
                    {decisive ? (
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-rose-900">Decides</span>
                    ) : fired ? (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-900">Fired</span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Quiet</span>
                    )}
                  </div>
                  <p className={cn("mt-0.5 text-[12px] leading-snug", fired ? "text-foreground" : "text-muted-foreground")}>{rule.text}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
