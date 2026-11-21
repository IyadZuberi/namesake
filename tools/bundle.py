"""Merge data + decisions + per-hit traces into the case bundle (docs/contracts.md) for the website.
SYNTHETIC data only: refuses unless DATA has a file named SYNTHETIC or --i-know-this-is-synthetic is passed.
Usage: python tools/bundle.py --data DIR --decisions OUT.jsonl [--trace TRACEDIR] [--titles titles.json] --out demo-data/cases.json
titles.json: {"H-000001": "Two Mohammed Alis"} or {"H-000001": {"case_id": "S-0001", "title": "..."}}.
Trace file for a hit: TRACEDIR/<hit_id>.json (either the trace object or an object with a "trace" key); missing = null."""
import argparse, json, os, re, sys

ID_IN_TEXT = re.compile(r"\b(?:CUS|KYC|NOTE|SR)-[0-9A-Za-z]+")
# The engine leaves one_fact null except when no customer was found. REVIEW reasons already
# contain the settling sentence. Copy that sentence out. Do not write a new one.
SETTLE = re.compile(r"([^.]*would settle it\.)")


def derive_one_fact(trace, decision):
    if not isinstance(trace, dict) or trace.get("one_fact"):
        return trace
    reason = decision.get("reason") if isinstance(decision, dict) else ""
    found = SETTLE.search(reason or "")
    if not found:
        return trace
    out = dict(trace)
    out["one_fact"] = " ".join(found.group(1).split())
    return out


def read_jsonl(path):
    if not os.path.isfile(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def build(data, decisions, trace_dir=None, titles=None):
    titles = titles or {}
    rows = {name: read_jsonl(os.path.join(data, name + ".jsonl"))
            for name in ("alerts", "customers", "accounts", "onboarding", "kyc_checks", "notes", "hits", "search_results")}
    idx = {name: {r[key]: r for r in rows[name]}
           for name, key in (("alerts", "alert_id"), ("customers", "record_id"), ("kyc_checks", "check_id"),
                             ("notes", "note_id"), ("hits", "hit_id"), ("search_results", "result_id"))}
    dec = {r["hit_id"]: r for r in decisions}
    cases = []
    for n, hid in enumerate(sorted(dec), 1):
        d, hit = dec[hid], idx["hits"].get(hid)
        if hit is None:
            continue
        trace = None
        tp = os.path.join(trace_dir, hid + ".json") if trace_dir else None
        if tp and os.path.isfile(tp):
            with open(tp, encoding="utf-8") as f:
                t = json.load(f)
            trace = t.get("trace", t) if isinstance(t, dict) else None
            trace = derive_one_fact(trace, d)
        alert = dict(idx["alerts"].get(d.get("alert_id"), {}))
        # ids the decision (and trace) cite, plus the rows that link the alert to its customer(s); full rows (contracts v2)
        ids = set(d.get("evidence") or []) | ({d["customer_record_id"]} if d.get("customer_record_id") else set())
        if trace is not None:
            ids |= set(ID_IN_TEXT.findall(json.dumps(trace)))
        accounts = [r for r in rows["accounts"] if (alert.get("account_ref") and r["account_id"] == alert["account_ref"])
                    or (alert.get("login_handle") and r.get("login_handle") == alert["login_handle"])]
        acc_ids = {r["account_id"] for r in accounts}
        onboarding = [r for r in rows["onboarding"] if r["account_id"] in acc_ids]
        ids |= {r["customer_id"] for r in accounts + onboarding}
        ids |= {r["record_id"] for r in rows["customers"] if alert.get("email") and r.get("email") == alert["email"]}
        records = [idx["customers"][i] for i in sorted(ids) if i in idx["customers"]]
        apps = {r.get("kyc_applicant_id") for r in onboarding}
        emails = {e for e in [alert.get("email")] + [r.get("email") for r in records] if e}
        t = titles.get(hid)
        t = {"title": t} if isinstance(t, str) else (t or {})
        cases.append({
            "case_id": t.get("case_id", f"S-{n:04d}"), "title": t.get("title", hid), "alert": alert,
            "customer_records": records, "accounts": accounts, "onboarding": onboarding,
            "kyc_checks": [r for r in rows["kyc_checks"] if r["check_id"] in ids or r.get("applicant_id") in apps],
            "notes": [r for r in rows["notes"] if r["note_id"] in ids or r.get("requester_email") in emails],
            "hit": hit, "search_results": [idx["search_results"][i] for i in sorted(ids) if i in idx["search_results"]],
            "decision": d, "trace": trace})
    return cases


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", required=True)
    ap.add_argument("--decisions", required=True)
    ap.add_argument("--trace")
    ap.add_argument("--titles")
    ap.add_argument("--out", required=True)
    ap.add_argument("--i-know-this-is-synthetic", action="store_true")
    a = ap.parse_args(argv)
    if not (a.i_know_this_is_synthetic or os.path.isfile(os.path.join(a.data, "SYNTHETIC"))):
        print("refusing: data folder has no SYNTHETIC marker file. Event data must never go into the public site bundle.")
        return 2
    titles = None
    if a.titles:
        with open(a.titles, encoding="utf-8") as f:
            titles = json.load(f)
    cases = build(a.data, read_jsonl(a.decisions), a.trace, titles)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(cases, f, indent=2, ensure_ascii=False, sort_keys=False)
        f.write("\n")
    no_trace = sum(1 for c in cases if c["trace"] is None)
    print(f"wrote {len(cases)} cases to {a.out} ({no_trace} without trace)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
