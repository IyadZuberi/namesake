# Architecture (short)

```
system/run DATA OUT
  load -> resolve customer -> resolve hit -> gates -> decide -> explain -> write line
```
- **Rules decide.** The written policy is implemented as code. A hit is cleared only on a concrete contradiction (time, date of birth, location, verified name, entity type, death date). Anything unknown stays unknown and goes to a person.
- **Customer side:** follow the alert's link (account, login or email); screened details pick between joint holders; with no link, filter by screened date of birth and country first, then names. Records of one person merge on the same phone plus the same full date of birth, or the same approved document number. The latest approved identity check beats declared data.
- **Hit side:** date of birth from the `dobs` field, then an age or "born" sentence in the first paragraph of the profile, then matching search results. Countries come from every country field.
- **Explanation:** the reason is a template filled from the rule trace and names this hit's own facts; evidence lists only the records that decided it.
- **Determinism:** sorted iteration, smallest-ID tie-breaks, no randomness, standard library only. A fatal error writes a REVIEW line for every hit rather than nothing.
- **Tools:** `tools/repro.py` (N fresh runs, byte comparison), `tools/score.py` (practice score), `tools/recheck.py` (compare another decisions file with ours; ranks disagreements by the cost of the disagreement if our decision is right; it is not proof of which side is right), `tools/leakcheck.py`.
See `docs/contracts.md` for data formats.
