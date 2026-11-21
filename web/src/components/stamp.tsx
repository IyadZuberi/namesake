import type { DecisionName } from "@/lib/types";
import { cn } from "@/lib/utils";

const COPY: Record<DecisionName, { label: string; word: string; cls: string }> = {
  DIFFERENT_ENTITY: { label: "Different person", word: "DIFFERENT", cls: "border-emerald-700 text-emerald-900 bg-emerald-50" },
  SAME_ENTITY: { label: "Same person", word: "SAME", cls: "border-rose-800 text-rose-950 bg-rose-50" },
  REVIEW: { label: "Needs a person", word: "REVIEW", cls: "border-amber-800 text-amber-950 bg-amber-50" },
};

export function Stamp({ decision, className }: { decision: DecisionName; className?: string }) {
  const v = COPY[decision];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border-2 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]",
        v.cls,
        className,
      )}
      aria-label={v.label}
    >
      <span aria-hidden="true">{v.word}</span>
      <span className="font-sans text-[11px] font-medium normal-case tracking-normal">{v.label}</span>
    </span>
  );
}
