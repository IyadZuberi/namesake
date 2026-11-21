# Contracts shared by engine, tools and web (v2, fixes from the cold review)

## 0. Principles
- The DATA FOLDER (same jsonl file set as the event data) is the source of truth. A "case bundle" is only a per-hit extract of a data folder + the engine's decision + optional trace, built by `tools/bundle.py`. The web reads bundles only (synthetic data only).
- IDs are hexadecimal like the event data: `H-[0-9A-F]{6}`, `A-[0-9A-F]{6}`, `CUS-NNNNNN`, `ACC-XXXXXX`, `KYC-..` check ids, `NOTE-XXXXXX`, `SR-NNNNNN`. (Illustrative IDs in samples must still match these patterns so validate.py accepts them.)
- Python 3 standard library only in `system/` and `tools/`; open files with encoding="utf-8"; never print names from event data; no network in `system/`; sorted iteration; deterministic tie-breaks (smallest ID).

## 1. Scored output line (validated by the organisers' validate.py)
`{"hit_id","alert_id","decision","reason_code","customer_record_id","reason","evidence":[...]}`
Evidence rule: only `CUS-`, `KYC`/check ids, `NOTE-`, `SR-` ids, plus hit fields as `H-XXXXXX#field` (field in: dobs, countries, nationality, citizenship, addresses, place_of_birth, deceased_date, life_status, profile_notes, aliases, name). Never `ACC-`, `A-`, onboarding ids. DOB/NAME/TEMPORAL clears cite the KYC/NOTE (and SR) that gave the customer fact, not CUS; LOCATION and SAME cite every CUS record in the person's cluster plus the KYC/NOTE.
Reasons are built only from derived facts (years, countries, gate names, ids). No verbatim note/snippet/profile text and no quotes in output/dev.jsonl.

## 2. Case bundle (`demo-data/cases.json`) — array of objects
Fields (superset of what the data folder holds; omit nothing the policy reads):
- `case_id`, `title`
- `alert`: {alert_id, screened_at, customer:{name, entity_type, dob, country, city}, account_ref, login_handle, email, hit_ids}
- `customer_records`: full customer rows (record_id, entity_type, full_name, preferred_name, login_name, dob (any of the 10 formats), nationality, residence_country, city, address, email, phone, registration_number, status)
- `accounts`: rows (account_id, customer_id, login_handle, phone); `onboarding`: rows (account_id, customer_id, kyc_applicant_id)
- `kyc_checks`: full rows (check_id, applicant_id, provider, verified_name, verified_dob, document_type, document_number, document_country, result, checked_at)
- `notes`: full rows (note_id, requester_email, created_at, channel, text)
- `hit`: full hit row (hit_id, alert_id, entity_type, name, first/middle/last_name, aliases, gender, dobs, place_of_birth, life_status, deceased_date, nationality, citizenship, countries, addresses, identifiers, categories, primary_category, subcategories, profile_notes, details)
- `search_results`: rows (result_id, query, title, snippet, source)
- `decision`: the scored output line (section 1)
- `trace` (optional): see section 3
DOB formats the generator must emit and the engine must parse: `YYYY-MM-DD`, `DD/MM/YYYY` (all slash dates are day-first), `19 May 2004`, `May 19, 2004`, `9 May 2004`, `May 9, 2004`, `YYYY`, `YYYY-MM`, `Month YYYY`, null.

## 3. Trace (engine `--trace DIR`, default OFF; never written in the scored run; never committed for event data)
```json
{"hit_id":"H-0A1B2C",
 "linked_via":"account_ref|login_handle|email|fit_search|none",
 "persons":[{"record_ids":["CUS-<n>"],"merged_by":"phone+dob|document|none","verified":{"name":"...","dob":"...","source_id":"KYC-..","how":"kyc_check|kyc_note|none"},"countries":[{"value":"GB","source_id":"CUS-<n>","kind":"residence|nationality|document|note_lived"}],"decision":"DIFFERENT_ENTITY","reason_code":"DOB_MISMATCH"}],
 "hit_facts":{"dob_years":[1952],"dob_source":"dobs|first_paragraph|search_result|none","countries":["EG"],"dated_reports":[{"date":"2019-03-10","line_ref":"profile_notes"}],"death_date":null},
 "gates":[{"gate":"TIME|DECEASED|DOB|LOCATION|NAME|TYPE|AGREEMENT","result":"contradiction|agreement|unknown|not_applicable|blocked","blocked_by":null,"explain":"one sentence from derived facts","facts":[{"label":"customer DOB","value":"1988-03-14","source_id":"KYC-.."}]}],
 "one_fact":"a full date of birth for the hit would settle this",
 "graph":{"nodes":[{"id":"A-0A1B2C","type":"Alert","label":"Alert"}],"edges":[{"src":"A-0A1B2C","dst":"CUS-<n>","type":"LINKS_VIA","verdict":"neutral|agrees|contradicts"}],"decisive_path":["A-0A1B2C","CUS-<n>","H-0A1B2C"]}}
```
Multi-person alerts: one entry per person in `persons`; the top-level decision follows POLICY 3 (all equal -> that decision, else REVIEW + AMBIGUOUS_CUSTOMER_RECORD, customer_record_id `AMBIGUOUS`). Gate `blocked` = a clear that was prevented (for example LOCATION blocked because name and DOB agree). `decisive_path` entries must exist in `nodes`; `AMBIGUOUS`/null customers use a synthetic node id `AMBIGUOUS`.
`--trace` is reachable only through `python system/mirror/main.py DATA OUT --trace DIR` (system/run forwards only two args).

## 4. Decisions file for Second Opinion
JSONL, one line per hit, scored-output shape OR Diligent-style `{"hit_id","determination":"TRUE_POSITIVE|FALSE_POSITIVE|UNRESOLVED",...}`. Mapping TRUE_POSITIVE->SAME_ENTITY, FALSE_POSITIVE->DIFFERENT_ENTITY, UNRESOLVED->REVIEW is untested against a real export; reason codes after mapping are synthetic; the tool must say so.
Ranking: disagreements are sorted by the organisers' cost IF OUR DECISION IS RIGHT (theirs DIFFERENT vs ours SAME/REVIEW = 60; theirs SAME/REVIEW vs ours DIFFERENT = 3; SAME<->REVIEW = 2). The output must state: this ranks the cost of the disagreement assuming our decision is right; it does not prove which side is right.
Report JSON: {counts:{agree,disagree}, by_pair:[{theirs,ours,cost,count}], rows:[{hit_id,theirs,ours,ours_reason_code,ours_evidence}], note}

## 5. Scoreboard (`web/data/scoreboard.json`, aggregates only)
{generated_at, source:"practice labels (tuned on these 50; not held out)", lines, problems, decision_score, unsafe_clearances, review_rate, clearance_precision, same_recall, reason_code_pct, customer_record_pct, confusion:{DIFFERENT_ENTITY:{...},...}, repro:{runs,identical,fingerprint}, run_seconds} — no hit IDs, no label text, no names. Missing values are shown as "not yet measured".
