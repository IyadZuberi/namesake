"""Stdlib self-check: web/data/sample-cases.json (or a path argument) against docs/contracts.md v2 and POLICY reason codes.
Usage: python selfcheck.py [cases.json]
"""
import json
import re
import sys
from pathlib import Path

PAIRS = {
    "DIFFERENT_ENTITY": {"TEMPORAL_IMPOSSIBILITY", "DOB_MISMATCH", "LOCATION_MISMATCH", "NAME_MISMATCH_VERIFIED", "ENTITY_TYPE_MISMATCH", "DECEASED"},
    "SAME_ENTITY": {"NAME_DOB_LOCATION_MATCH", "NAME_DOB_MATCH", "NAME_LOCATION_MATCH"},
    "REVIEW": {"INSUFFICIENT_DATA", "AMBIGUOUS_CUSTOMER_RECORD"},
}
GATE_FOR = {"DOB_MISMATCH": "DOB", "LOCATION_MISMATCH": "LOCATION", "TEMPORAL_IMPOSSIBILITY": "TIME", "NAME_MISMATCH_VERIFIED": "NAME", "ENTITY_TYPE_MISMATCH": "TYPE", "DECEASED": "DECEASED"}
HEX6 = "[0-9A-F]{6}"
PAT = {"H": re.compile(r"^H-" + HEX6 + "$"), "A": re.compile(r"^A-" + HEX6 + "$"), "CUS": re.compile(r"^CUS-\d{6}$"),
       "ACC": re.compile(r"^ACC-" + HEX6 + "$"), "KYC": re.compile(r"^KYC-[0-9A-Z]+$"), "NOTE": re.compile(r"^NOTE-" + HEX6 + "$"), "SR": re.compile(r"^SR-\d{6}$")}
HIT_FIELDS = {"dobs", "countries", "nationality", "citizenship", "addresses", "place_of_birth", "deceased_date", "life_status", "profile_notes", "aliases", "name"}
RESULTS = {"contradiction", "agreement", "unknown", "not_applicable", "blocked"}
NODE_TYPES = {"Alert", "CustomerRecord", "Account", "KycCheck", "Note", "Hit", "SearchResult", "Fact", "Gate", "Decision"}
TOP = ["case_id", "title", "alert", "customer_records", "kyc_checks", "notes", "hit", "search_results", "decision", "trace"]
DEC = ["hit_id", "alert_id", "decision", "reason_code", "customer_record_id", "reason", "evidence"]
TRACE = ["linked_via", "persons", "hit_facts", "gates", "one_fact", "graph"]

errs = []


def bad(cid, msg):
    errs.append(f"{cid}: {msg}")


def check_case(c, seen):
    cid = c.get("case_id", "?")
    for k in TOP:
        if k not in c:
            bad(cid, f"missing key {k}")
    if errs and any(e.startswith(cid + ": missing") for e in errs):
        return
    if cid in seen:
        bad(cid, "duplicate case_id")
    seen.add(cid)
    d, hit, al, tr = c["decision"], c["hit"], c["alert"], c["trace"]
    for k in DEC:
        if k not in d:
            bad(cid, f"decision missing {k}")
    for k in TRACE:
        if k not in tr:
            bad(cid, f"trace missing {k}")
    dec, code = d.get("decision"), d.get("reason_code")
    if code not in PAIRS.get(dec, set()):
        bad(cid, f"invalid decision/reason pair {dec}/{code}")
    if d.get("hit_id") != hit.get("hit_id") or d.get("alert_id") != al.get("alert_id"):
        bad(cid, "decision ids do not match hit/alert")
    # id patterns
    for name, val in (("H", hit["hit_id"]), ("A", al["alert_id"])):
        if not PAT[name].match(val):
            bad(cid, f"bad id {val}")
    ids = {}
    for key, idk, p in (("customer_records", "record_id", "CUS"), ("kyc_checks", "check_id", "KYC"), ("notes", "note_id", "NOTE"), ("search_results", "result_id", "SR")):
        for r in c[key]:
            if not PAT[p].match(r[idk]):
                bad(cid, f"bad id {r[idk]}")
            ids[r[idk]] = r
    if al.get("account_ref") and not PAT["ACC"].match(al["account_ref"]):
        bad(cid, "bad account_ref")
    # synthetic-only: .example emails
    mails = [al.get("email")] + [r.get("email") for r in c["customer_records"]]
    for m in mails:
        if m and not m.endswith(".example"):
            bad(cid, f"email not .example: {m}")
    # customer_record_id
    cr = d.get("customer_record_id")
    if cr == "AMBIGUOUS":
        if code != "AMBIGUOUS_CUSTOMER_RECORD":
            bad(cid, "AMBIGUOUS record id without AMBIGUOUS_CUSTOMER_RECORD")
    elif cr is not None and cr not in ids:
        bad(cid, f"customer_record_id {cr} not in records")
    # evidence rule (contracts s1)
    ev = d.get("evidence", [])
    if not ev:
        bad(cid, "empty evidence")
    for e in ev:
        base, _, field = e.partition("#")
        if base.startswith(("ACC-", "A-")):
            bad(cid, f"evidence may not cite {e}")
        elif base == hit["hit_id"]:
            if field not in HIT_FIELDS:
                bad(cid, f"evidence {e}: hit field must be one of {sorted(HIT_FIELDS)}")
            elif field not in hit:
                bad(cid, f"evidence {e}: field not on hit")
        elif base not in ids or field:
            bad(cid, f"evidence id {e} not among the case's records or hit")
    persons = tr.get("persons", [])
    cluster = {r for p in persons for r in p["record_ids"]}
    if code in ("DOB_MISMATCH", "NAME_MISMATCH_VERIFIED", "TEMPORAL_IMPOSSIBILITY") and any(e.startswith("CUS-") for e in ev):
        bad(cid, f"{code} must cite KYC/NOTE/SR, not CUS")
    if (code == "LOCATION_MISMATCH" or dec == "SAME_ENTITY") and not cluster <= set(ev):
        bad(cid, "LOCATION/SAME must cite every CUS record of the person cluster")
    # trace
    for p in persons:
        for r in p["record_ids"]:
            if r not in ids:
                bad(cid, f"person record {r} missing")
        for x in p.get("countries", []):
            if x["source_id"] not in ids:
                bad(cid, f"country source {x['source_id']} missing")
    if code == "AMBIGUOUS_CUSTOMER_RECORD" and len({p.get("decision") for p in persons}) < 2:
        bad(cid, "AMBIGUOUS needs persons with different decisions")
    texts = [r.get("text") or r.get("snippet") or "" for r in c["notes"] + c["search_results"]] + [hit.get("profile_notes", "")]
    gates = tr.get("gates", [])
    for g in gates:
        if g["result"] not in RESULTS:
            bad(cid, f"gate {g['gate']} bad result {g['result']}")
        for f in g.get("facts", []):
            sid = f["source_id"]
            if sid != hit["hit_id"] and sid not in ids:
                bad(cid, f"gate fact source {sid} missing")
            if f.get("quote") and not any(f["quote"] in t for t in texts):
                bad(cid, f"quote not found verbatim in any record: {f['quote'][:40]}")
    if code in GATE_FOR and not any(g["gate"] == GATE_FOR[code] and g["result"] == "contradiction" for g in gates):
        bad(cid, f"{code} needs a {GATE_FOR[code]} contradiction gate")
    if dec == "REVIEW" and not tr.get("one_fact"):
        bad(cid, "REVIEW needs one_fact")
    if dec == "SAME_ENTITY" and any(g["result"] in ("contradiction", "blocked") for g in gates):
        bad(cid, "SAME_ENTITY with a contradicting gate")
    gr = tr["graph"]
    nid = {n["id"] for n in gr["nodes"]}
    if len(nid) != len(gr["nodes"]):
        bad(cid, "duplicate node ids")
    for n in gr["nodes"]:
        if n["type"] not in NODE_TYPES:
            bad(cid, f"node type {n['type']}")
    for e in gr["edges"]:
        if e["src"] not in nid or e["dst"] not in nid or e["verdict"] not in ("neutral", "agrees", "contradicts"):
            bad(cid, f"bad edge {e}")
    path = gr["decisive_path"]
    if not path or any(p not in nid for p in path):
        bad(cid, "decisive_path empty or has unknown nodes")
    elif len(path) > 14:
        bad(cid, f"decisive_path has {len(path)} nodes (max 14)")
    if code == "INSUFFICIENT_DATA" and not any(n.get("missing") for n in gr["nodes"]) and not any(g["result"] == "blocked" for g in gates):
        bad(cid, "INSUFFICIENT_DATA should show a missing-fact node or a blocked gate")


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "data" / "sample-cases.json"
    cases = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(cases, list) or not cases:
        sys.exit("FAIL: not a non-empty JSON array")
    seen, hits = set(), set()
    for c in cases:
        check_case(c, seen)
        if c["hit"]["hit_id"] in hits:
            bad(c["case_id"], "duplicate hit_id")
        hits.add(c["hit"]["hit_id"])
    want = {"DOB_MISMATCH", "LOCATION_MISMATCH", "NAME_MISMATCH_VERIFIED", "TEMPORAL_IMPOSSIBILITY", "NAME_DOB_LOCATION_MATCH", "INSUFFICIENT_DATA", "AMBIGUOUS_CUSTOMER_RECORD"}
    miss = want - {c["decision"]["reason_code"] for c in cases}
    if miss:
        bad("coverage", f"missing reason codes {sorted(miss)}")
    for c in cases:
        print(f"{c['case_id']}  {c['decision']['decision']:17} {c['decision']['reason_code']:26} path={len(c['trace']['graph']['decisive_path'])} nodes  {c['title']}")
    if errs:
        print(f"\nFAIL: {len(errs)} problem(s)")
        print("\n".join(" - " + e for e in errs))
        sys.exit(1)
    print(f"\nOK: {len(cases)} cases, all checks passed ({path.name})")


if __name__ == "__main__":
    main()
