import showcaseJson from "./showcase.json";
import type { CaseFile } from "@/lib/types";

export const showcase = showcaseJson as unknown as CaseFile;
