import { useEffect, useState } from "react";
import { showcase } from "@/data/showcase";
import type { CaseFile } from "./types";

let pending: Promise<CaseFile[]> | null = null;

export function loadCases(): Promise<CaseFile[]> {
  if (!pending) {
    pending = fetch("/data/cases.json").then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json() as Promise<CaseFile[]>;
    });
  }
  return pending;
}

export function useCases() {
  const [cases, setCases] = useState<CaseFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadCases()
      .then((rows) => {
        if (live) setCases(rows);
      })
      .catch((e: Error) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  return { cases, error };
}

export function useCase(id?: string) {
  const { cases, error } = useCases();
  const wanted = id || "S-0072";
  const fromBundle = cases?.find((c) => c.case_id === wanted) ?? null;
  const item = fromBundle ?? (wanted === showcase.case_id ? showcase : null);
  return { item, cases, error, wanted };
}
