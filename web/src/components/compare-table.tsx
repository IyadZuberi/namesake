import { compareSides } from "@/lib/graph";
import type { CaseFile } from "@/lib/types";

const MARK = {
  match: "text-emerald-700 dark:text-emerald-300",
  conflict: "text-rose-700 dark:text-rose-300",
  missing: "text-amber-800 dark:text-amber-200",
  blocked: "text-amber-800 dark:text-amber-200",
};

export function CompareTable({ item }: { item: CaseFile }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Customer against the listed person</caption>
      <thead>
        <tr className="border-b text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <th className="py-2 pr-3 font-medium" scope="col">Field</th>
          <th className="py-2 pr-3 font-medium" scope="col">Customer</th>
          <th className="py-2 pr-3 font-medium" scope="col">Listed person</th>
          <th className="py-2 font-medium" scope="col">Mark</th>
        </tr>
      </thead>
      <tbody>
        {compareSides(item).map((row) => (
          <tr key={row.label} className="border-b border-border/70">
            <th className="py-3 pr-3 text-left font-medium" scope="row">{row.label}</th>
            <td className="py-3 pr-3">{row.customer}</td>
            <td className="py-3 pr-3">{row.hit}</td>
            <td className={"py-3 capitalize " + MARK[row.mark]}>{row.mark}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
