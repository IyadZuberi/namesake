import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", label: "Overview", end: true },
  { to: "/how", label: "How it works" },
  { to: "/cases", label: "Cases" },
  { to: "/graph", label: "Knowledge graph" },
  { to: "/rules", label: "Rules" },
  { to: "/results", label: "Results" },
  { to: "/second-opinion", label: "Second Opinion" },
];

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <NavLink to="/" className="text-[15px] font-semibold tracking-tight">
            Namesake
          </NavLink>
          <nav aria-label="Main" className="flex flex-1 flex-wrap gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground",
                    isActive && "bg-secondary font-medium text-foreground",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-amber-800/50 bg-amber-50 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-950">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-700" aria-hidden="true" />
            Synthetic data
          </span>
        </div>
      </header>
      <main id="content" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-10">
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground">
          <p>Rules decide. The scored engine makes no model call. Nothing on this site is uploaded.</p>
          <p>Track 2 · Grok Bot London Financial Crime Hackathon</p>
        </div>
      </footer>
    </div>
  );
}
