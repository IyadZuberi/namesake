# system/ — the Namesake engine (Mirror)

`system/run <data folder> <output file>` reads the JSON Lines files in the data folder and writes one decision line per hit. Python 3 standard library only. No network. **Model use: none** (rules only). Cost of a run: nothing.

## Architecture
```
data folder (alerts, hits, customers, accounts, onboarding, kyc_checks, notes, search_results, name_variants)
   |
   v  load.py      stream the files, build indexes (email, phone, login, account, applicant, document number)
   v  customer.py  who is the customer?   links -> joint holders -> no-link search -> merge records -> verified facts
   v  hit.py       who is the listed person?   birth years, countries, dated reports, death date, type
   v  gates.py     time | deceased | date of birth | location | name | type | agreement   (rule trace)
   v  decide.py    one decision per hit (several people -> all equal or REVIEW + AMBIGUOUS_CUSTOMER_RECORD)
   v  explain.py   template reason from the rule trace + the records that decided it
   v  main.py      write lines in hit_id order; on any fatal error write REVIEW for every hit
```
The code decides every verdict. Nothing is guessed: a missing or unreadable fact is "unknown" and unknown never clears a hit.

## How the customer is found
1. Follow the alert's link: account, login handle or email. A link can lead to several people (joint holders); the screened name, date of birth, country and city then pick between them. If they still fit more than one person and the decisions differ, the result is REVIEW with `AMBIGUOUS_CUSTOMER_RECORD`.
2. With no link, filter the customer records by the screened date of birth (every part both give) and country first, then compare names. This keeps the search fast.
3. Records of one person merge when they share a phone number and the same full date of birth (dates are compared after parsing, so `19/07/1982` equals `1982-07-19`), or the same document number on approved checks. A phone number or address alone never merges.
4. The most recent **approved** identity check (from the KYC provider file, or written only in a KYC note) gives the verified name, date of birth and document country. Rejected, expired or failed checks are ignored.
5. Customer countries come from residence and nationality on all the person's records, the approved document, and any country named in a non-KYC note. These notes only ever **block** a clear.

## How the listed person is resolved
Date of birth: the `dobs` field, else an age or "born" sentence in the first paragraph of the profile (an age at a date gives two possible years), else a matching web search result (same kind of listing phrase and a country tied to the hit). Countries: every country field, the last part of each address, nationality, citizenship and place of birth; "International" and "Europe" are not countries. Dated reports: only lines in the exact form `According to ...; Month D, YYYY:`. For companies only the `dobs` field is an incorporation date.

## How evidence is represented
`evidence` lists only the records that decided the hit: the KYC check or note that gave the customer fact (date of birth, name, time), plus the search result if one was used. Location and same-entity decisions cite every record of the person's cluster. The `reason` is a template filled from the rule trace with this hit's own facts (years, countries, record IDs). It never copies note or profile text, and no model writes it. `--trace DIR` additionally writes a per-hit rule trace for the website; it never changes a decision and is off in the scored run.

## How results stay the same
Sorted iteration everywhere, smallest-ID tie-breaks, no randomness, no clock, no network, nothing set-ordered reaches the output. Measured on this machine (dev data, 819 hits):
- 5 fresh runs gave byte-identical output (same sha256), also under `PYTHONHASHSEED=1` and `=2`.
- A run takes about 6 seconds (one run took 15 s while other jobs were running).
- `tools/repro.py --data DIR --runs 5` repeats this check.

## Model and prompts
None. The scored engine makes no model calls. Notes are read with plain pattern matching and a country list.

## Measured results (dev data; the 50 practice labels were used while building, so this is not a held-out score)
- `validate.py`: 819 lines, 0 problems.
- Practice labels: 50 right decisions, 0 unsafe clearances, decision score 100.0, reason code 100%, customer record 100%.
- All 819 dev hits: 461 DIFFERENT_ENTITY, 122 SAME_ENTITY, 236 REVIEW (counts only; there are no labels for these).
- Fire Drill (our own synthetic trap set, 122 hits, expected answers written separately from the policy text): 122 of 122 match, 0 unsafe clearances. This was used to fix two bugs, so it is a regression test, not an independent score.
- 114 unit tests pass (`python -m unittest discover -s tests`).
The score on the unseen set is **not measured**.

## Three worked cases (synthetic Fire Drill cases, same code path as real data)
1. **A clear mismatch (`H-93BD04`).** The customer was found through the alert's account link. The customer's date of birth is 1985-03-14; the hit's only birth information is the year 1952, and no other date of birth for the customer or source for the hit agrees. Decision: `DIFFERENT_ENTITY`, `DOB_MISMATCH`, evidence: the customer record.
2. **A match (`H-6A56AA`).** The customer's date of birth 1971-09-12 agrees with the hit's year 1970 or 1971, the names agree, both are linked to Italy and nothing contradicts. Decision: `SAME_ENTITY`, `NAME_DOB_LOCATION_MATCH`.
3. **Left for review (`H-1E239E`).** The names agree but the hit gives no usable date of birth, and its only countries are "Europe" and "International", which are not countries. Nothing contradicts and not enough agrees. Decision: `REVIEW`, `INSUFFICIENT_DATA`; the reason says what would settle it: a full date of birth for the hit.

## Honest limits
- The unseen-set score is unknown. The location rule carries much of the saving, and it depends on finding the customer's countries in notes; reworded notes that hide a country are the main risk of a wrong clear.
- Company name clears are not implemented (names like "Munchen" and "Munich" would mismatch); companies clear on type, location or time only.
- Two dev SAME decisions rest on an age found in a search-result snippet; they are the least certain.
- Name matching: parts written together or apart match exactly, with no spelling tolerance when confirming. When deciding whether a name blocks a clear the matching is deliberately more generous, because a doubtful reading must never lead to a clear.
- Some hits are not scored because the answer is not in the files; they are answered anyway.
