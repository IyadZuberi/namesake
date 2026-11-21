# Namesake

Show why it's a different person.

Namesake is an open, rules-based engine that decides whether a sanctions/PEP screening hit is the customer, with a short reason and the records that decided it. A second mode compares any other system's decisions against the written policy.

> Status: work in progress, built at the Grok Bot London Financial Crime Hackathon (21 Nov 2026), Track 2.
> Measured on the development set (the 50 practice labels were used while building, so this is not a held-out score):
> `validate.py` 819 lines, 0 problems; practice labels 50 of 50 right, 0 unsafe clearances, decision score 100.0, reason code and customer record 100%.
> Fire Drill (our own synthetic trap set, 122 hits): 122 of 122, 0 unsafe clearances (a regression test, not an independent score).
> Output is byte-identical across runs. The score on the unseen set is not measured. Details: `system/README.md`.

## What it does
- Reads a bank's alerts, hits, customer records, KYC checks and notes (JSON Lines).
- Resolves who the customer really is, then who the listed person is, then compares them using the written policy.
- Writes one decision per hit: `DIFFERENT_ENTITY`, `SAME_ENTITY` or `REVIEW`, with a reason code, a short reason that names this hit's own facts, and the records that decided it.
- Rules decide. Model use in the scored engine: none (rules only).

## Run (engine)
```
system/run <data folder> <output file>
```
Python 3 standard library only. No key needed.

## Layout
- `system/` the engine (`run`, `mirror/`)
- `tools/` reproducibility check, practice-score wrapper, comparison of other systems' decisions, synthetic case generator, leak check
- `tests/` unit tests (synthetic values only)
- `web/` static case-file site (synthetic demo data only)
- `demo-data/` synthetic data (invented names)
- `data/` git-ignored; event data goes here locally, never committed
- `docs/` architecture and data contracts

## Safety
Event data is for participants only and is never committed. Only `output/dev.jsonl` (required by the brief) is tracked, and its reasons contain derived facts and record IDs, not customer names or quoted text.

## Licence
MIT
