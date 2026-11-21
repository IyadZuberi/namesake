# Namesake web (static, synthetic data only)

Plain HTML, CSS and vanilla JS (ES modules). No build step, no npm, no framework, no third-party requests (system fonts only).

## Run

From this folder, any static server:

    python -m http.server 8080

Open http://localhost:8080/. Do not open `index.html` from disk: browsers block `fetch` and ES modules on `file://`.

Deploy: point Vercel (static, no build command) at `web/`. `vercel.json` adds security headers (CSP allows only `self`).

## Routes (hash routing)

| Route | Screen |
|---|---|
| `#/` | Landing + "Two Mohammed Alis" walk |
| `#/queue` | Cases by risk, counts, filters |
| `#/case/ID[/tab]` | Case file: `verdict`, `customer`, `why`, `evidence`, `change`, `replay` |
| `#/second-opinion` | Compare a decisions JSONL with our decisions (in browser) |
| `#/scoreboard` | Aggregates from `data/scoreboard.json`, else "not yet measured" |
| `#/lab` | Simplified in-browser demo of the rules (the real engine is Python) |
| `#/log` | Pipeline steps and owners |

## Data

- `data/cases.json` (optional): engine/`tools/bundle.py` output, same shape as `docs/contracts.md` section 2. Used if present.
- `data/sample-cases.json`: hand-authored SYNTHETIC cases (invented names, `.example` emails). Fallback.
- `data/scoreboard.json` (optional): aggregates only (contracts section 5).

Never put event data in this folder.

## Check

    python selfcheck.py

Validates `data/sample-cases.json` (or a path you pass) against the contract and policy reason codes.

## Notes

- The Replay hash is SHA-256 over canonical JSON of the displayed decision, computed in the browser (`crypto.subtle`: needs https or localhost). Not a live replay.
- Approve/Override notes live in `localStorage` only.
