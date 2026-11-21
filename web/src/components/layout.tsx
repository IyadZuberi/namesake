import type { ReactNode } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { NavLink } from "react-router-dom";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", label: "Product", end: true },
  { to: "/how", label: "How it works" },
  { to: "/cases", label: "Cases" },
  { to: "/results", label: "Results" },
  { to: "/judges", label: "For judges" },
];

function Item({ to, end, onClick }: { to: string; end?: boolean; onClick?: () => void }) {
  const label = LINKS.find((l) => l.to === to)?.label ?? to;
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground",
          isActive && "bg-secondary font-medium text-foreground",
        )
      }
    >
      {label}
    </NavLink>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="min-h-screen">
      <button
        type="button"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        onClick={() => document.getElementById("content")?.focus()}
      >
        Skip to content
      </button>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <NavLink to="/" className="text-[15px] font-semibold tracking-tight">
            Namesake
          </NavLink>
          <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <Item key={l.to} to={l.to} end={l.end} />
            ))}
          </nav>
          <button
            type="button"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="hidden h-4 w-4 dark:block" />
            <Moon className="h-4 w-4 dark:hidden" />
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-amber-700/60 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-700" aria-hidden="true" />
            Synthetic data
          </span>
          <Sheet>
            <SheetTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-md border md:hidden" aria-label="Open menu">
              <Menu className="h-4 w-4" />
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Namesake</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="mt-6 flex flex-col gap-1">
                {LINKS.map((l) => (
                  <SheetClose asChild key={l.to}>
                    <NavLink
                      to={l.to}
                      end={l.end}
                      className={({ isActive }) =>
                        cn(
                          "rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground",
                          isActive && "bg-secondary font-medium text-foreground",
                        )
                      }
                    >
                      {l.label}
                    </NavLink>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <main id="content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground">
          <p>Rules decide. The scored engine makes no model call. Nothing on this site is uploaded.</p>
          <p>Track 2 · Grok Bot London Financial Crime Hackathon</p>
        </div>
      </footer>
    </div>
  );
}
