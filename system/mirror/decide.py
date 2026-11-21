"""Per-hit decision (POLICY 3): decide for each person, then combine. Never raises for data reasons;
the engine wraps any bug into REVIEW / INSUFFICIENT_DATA."""
import dates
import explain
import gates


def _line(hit_id, alert_id, decision, code, record_id, reason, evidence):
    return {
        "hit_id": hit_id,
        "alert_id": alert_id,
        "decision": decision,
        "reason_code": code,
        "customer_record_id": record_id,
        "reason": reason,
        "evidence": explain.clean_evidence(evidence),
    }


def decide(hit_row, alert, resolution, facts, data):
    """-> (output line, trace dict). `facts` is the HitFacts of this hit."""
    hid, aid = hit_row["hit_id"], hit_row["alert_id"]
    persons = resolution.persons
    trace = {"hit_id": hid, "linked_via": resolution.via, "persons": [], "gates": [],
             "hit_facts": _hit_trace(facts), "one_fact": None}
    if not persons:
        note = "the link led to no record" if resolution.via != "fit_search" else "no record fits the screened details"
        reason = explain.no_customer(hit_row, note)
        trace["one_fact"] = "a customer link or a record matching the screened details"
        return _line(hid, aid, "REVIEW", "INSUFFICIENT_DATA", None, reason, []), trace

    screened = dates.parse(alert.get("screened_at"))
    results = []
    for p in persons:
        decision, code, gs, ev, extra = gates.evaluate(p, facts, screened, data)
        text = explain.reason(decision, code, p, facts, gs, resolution.via, extra)
        results.append((p, decision, code, gs, ev, text, extra))
        trace["persons"].append(_person_trace(p, decision, code))
        trace["gates"] = gs

    if len(results) == 1:
        p, decision, code, gs, ev, text, extra = results[0]
        return _line(hid, aid, decision, code, p.rid, text, ev), trace

    same = len({r[1] for r in results}) == 1
    all_ev = [e for r in results for e in r[4]]
    ids = sorted(rid for r in results for rid in r[0].record_ids)
    if same:
        p, decision, code, gs, ev, text, extra = results[0]
        text = "All %d people who fit this alert (records %s) lead to the same decision. %s" % (len(results), ", ".join(ids), text)
        return _line(hid, aid, decision, code, "AMBIGUOUS", text, all_ev), trace
    text = ("%d different people fit this alert (records %s) and the hit leads to different decisions for them, "
            "so the customer cannot be told apart. A customer link or a more exact screened name, date of birth "
            "or city would settle it." % (len(results), ", ".join(ids)))
    return _line(hid, aid, "REVIEW", "AMBIGUOUS_CUSTOMER_RECORD", "AMBIGUOUS", text, []), trace


def _hit_trace(f):
    return {
        "dob_years": sorted({d.y for d in f.dobs}),
        "dob_source": {"dobs": "dobs", "first_paragraph": "first_paragraph", "search_result": "search_result"}.get(f.dob_source, "none"),
        "countries": sorted(f.countries),
        "dated_reports": [{"date": dates.iso(r), "line_ref": "profile_notes"} for r in f.reports],
        "death_date": dates.iso(f.death),
    }


def _person_trace(p, decision, code):
    ver = p.ver
    return {
        "record_ids": p.record_ids,
        "merged_by": p.merged_by,
        "verified": {"name": None, "dob": dates.iso(ver.dob) if ver else None,
                     "source_id": ver.source_id if ver else None, "how": ver.how if ver else "none"},
        "countries": [{"value": c, "source_id": s, "kind": k} for c in sorted(p.countries) for k, s in p.countries[c]],
        "decision": decision,
        "reason_code": code,
    }
