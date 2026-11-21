import { useState } from "react";
import { Button } from "@/components/ui";
import { SecondPage } from "@/pages/second";

const COMMANDS = [
  ["Clone", "git clone https://github.com/IyadZuberi/namesake && cd namesake"],
  ["Run the engine", "python system/mirror/main.py <data folder> output/dev.jsonl"],
  ["Or", "system/run <data folder> <out>"],
  ["Synthetic data", "python system/mirror/main.py demo-data/firedrill out.jsonl"],
  ["Reproducibility", "python tools/repro.py --data <data folder> --runs 5"],
  ["Tests", "python -m unittest discover -s tests"],
];

function CopyBlock({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-card px-3 py-2">
      <code className="font-mono text-[12px] leading-relaxed">{text}</code>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          void navigator.clipboard.writeText(text).then(() => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1200);
          });
        }}
      >
        {done ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function JudgesPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">For judges</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Python 3 standard library. No key. No network. 154 unit tests pass.
        </p>
      </header>
      <section className="space-y-2">
        {COMMANDS.map(([label, cmd]) => (
          <div key={label}>
            <p className="mb-1 text-[12px] font-medium text-muted-foreground">{label}</p>
            <CopyBlock text={cmd} />
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <details className="rounded-xl border bg-card p-4" open>
          <summary className="cursor-pointer font-medium">Can I use my own data?</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Yes. Any folder with the same JSON Lines files: alerts, hits, customers, accounts, onboarding, kyc_checks, notes, search_results, and name_variants.
          </p>
        </details>
        <details className="rounded-xl border bg-card p-4">
          <summary className="cursor-pointer font-medium">Is the website the engine?</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            No. The site only displays a bundle produced by tools/bundle.py from engine traces. Grading uses the engine output only.
          </p>
        </details>
      </section>
      <SecondPage />
    </div>
  );
}
