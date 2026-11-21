# demo-data

Synthetic data only. Every name, email (`.example`), phone (`555` numbers), note and search result is invented by `tools/firedrill.py`. Nothing is copied from the event data.

## firedrill/

Fire Drill: 122 hits in 120 alerts, built to hit the traps in POLICY.md (DOB, location, verified name, time, deceased, type, joint holders, merges by phone+DOB or document number, rejected checks, KYC-only notes, placeholder names, name edit boundaries, hit DOB in the first paragraph or in search results, unlinked alerts, planted instructions, reworded residence and KYC notes).

Regenerate (same seed gives byte-identical files):

    python tools/firedrill.py --out demo-data/firedrill --seed 7

Test:

    python -m unittest tests.test_firedrill

Files: the same jsonl set as the event data (`alerts`, `hits`, `customers`, `accounts`, `onboarding`, `kyc_checks`, `notes`, `search_results`), `name_variants.json` (own invented list), `POLICY.md` (copied byte-for-byte from the event folder when readable, otherwise omitted with a note on stderr), `SYNTHETIC` (marker), plus:

- `expected.jsonl`: one line per hit: `hit_id`, `expected_decision`, `expected_reason_codes` (any listed code is acceptable), `trap_class`, `why`, and `expected_customer_record_ids` (accepted ids; `["AMBIGUOUS"]` when more than one person fits).
- `titles.json`: `hit_id` to a short human title.

Expected answers were derived from POLICY.md text only, not from any engine. A few are judgement calls where the policy is terse: see the report notes in the project history (placeholder-name customer cleared on DOB, single-part hit alias, past residence counting as a country tie for SAME, a customer exactly 16 on the report day).

The copied `POLICY.md` is event material; check the event's sharing rules before publishing this folder.
