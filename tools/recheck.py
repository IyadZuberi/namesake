"""Second Opinion: compare another system's decisions with ours, most dangerous disagreement first.
Usage:
  python tools/recheck.py --ours OURS.jsonl --theirs THEIRS.jsonl [--format auto|namesake|diligent] [--hits hits.jsonl] [--json]
  python tools/recheck.py --ours OURS.jsonl --baseline name-only --data DIR [--write-baseline OUT.jsonl]
Cost = the organisers' matrix with OUR decision taken as truth (theirs said DIFFERENT while ours is
SAME/REVIEW = 60; theirs SAME/REVIEW while ours DIFFERENT = 3; SAME<->REVIEW = 2). Prints IDs only, never names.
This ranks the cost of the disagreement assuming OUR decision is right; it does not prove which side is right.
Diligent mapping: mapping untested against a real export; reason codes synthetic."""
import argparse, difflib, json, os, re, sys, unicodedata

DECISIONS = ("DIFFERENT_ENTITY", "SAME_ENTITY", "REVIEW")
COST = {  # COST[truth][said], copied constants of the organisers' validate.py (score.py imports the real file)
    "DIFFERENT_ENTITY": {"DIFFERENT_ENTITY": 0, "SAME_ENTITY": 3, "REVIEW": 3},
    "SAME_ENTITY": {"DIFFERENT_ENTITY": 60, "SAME_ENTITY": 0, "REVIEW": 2},
    "REVIEW": {"DIFFERENT_ENTITY": 60, "SAME_ENTITY": 2, "REVIEW": 0},
}
DILIGENT = {"TRUE_POSITIVE": "SAME_ENTITY", "FALSE_POSITIVE": "DIFFERENT_ENTITY", "UNRESOLVED": "REVIEW"}
LABEL = {60: "possible unsafe clearance", 3: "missed clearance", 2: "SAME<->REVIEW"}
ID_RE = re.compile(r"^[A-Z]{1,6}-[0-9A-Za-z]+(#\w+)?$")
RANK_NOTE = ("ranks the cost of the disagreement assuming OUR decision is right; "
             "it does not prove which side is right")
DILIGENT_NOTE = "mapping untested against a real export; reason codes synthetic"
BASELINE_NOTE = "our naive baseline, not any vendor"


def read_jsonl(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def load_decisions(path, fmt="auto", stats=None):
    """Return {hit_id: {"decision", "reason_code", "evidence"}}. Format is detected per line when auto.
    stats (dict, optional) gets "diligent_rows" = number of rows read through the Diligent mapping."""
    out = {}
    for row in read_jsonl(path):
        hid = row.get("hit_id")
        if hid is None:
            continue
        is_dil = fmt == "diligent" or (fmt == "auto" and "determination" in row and "decision" not in row)
        if is_dil:
            if stats is not None:
                stats["diligent_rows"] = stats.get("diligent_rows", 0) + 1
            dec = DILIGENT.get(str(row.get("determination", "")).strip().upper())
        else:
            dec = row.get("decision")
        if dec not in DECISIONS:
            dec = "REVIEW"  # unreadable/unknown verdict counts as REVIEW, as for the organisers' missing lines
        ev = row.get("evidence")
        out[hid] = {"decision": dec, "reason_code": row.get("reason_code"),
                    "evidence": [e for e in ev if isinstance(e, str) and ID_RE.match(e)] if isinstance(ev, list) else []}
    return out


# ponytail: name-only baseline = difflib token ratio; ceiling = no DOB/country/notes, no variant table, no transliteration.
def norm_tokens(name):
    s = unicodedata.normalize("NFKD", name or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    toks = re.findall(r"[a-z0-9]+", s)
    return [t for t in dict.fromkeys(toks) if len(t) > 1]  # drops initials, keeps each part once


def names_agree(a, b, cut=0.85):
    ta, tb = norm_tokens(a), norm_tokens(b)
    if not ta or not tb:
        return False
    short, long_ = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    matched = sum(1 for t in short if any(difflib.SequenceMatcher(None, t, u).ratio() >= cut for u in long_))
    return matched >= 2 or matched == len(short)


def baseline_decisions(data):
    alerts = {a["alert_id"]: a for a in read_jsonl(os.path.join(data, "alerts.jsonl"))}
    out = {}
    for h in read_jsonl(os.path.join(data, "hits.jsonl")):
        al = alerts.get(h.get("alert_id"))
        cust = ((al or {}).get("customer") or {}).get("name")
        names = [h.get("name")] + list(h.get("aliases") or [])
        same = bool(cust) and any(names_agree(cust, n) for n in names if n)
        out[h["hit_id"]] = {"decision": "SAME_ENTITY" if same else "DIFFERENT_ENTITY",
                            "reason_code": "NAME_DOB_MATCH" if same else "NAME_MISMATCH_VERIFIED",
                            "evidence": [], "alert_id": h.get("alert_id")}
    return out


def compare(ours, theirs, universe=None):
    hits = sorted(universe if universe is not None else set(ours) & set(theirs))
    missing = lambda d: [h for h in hits if h not in d]
    agree, dis, pairs = 0, [], {}
    for h in hits:
        o = ours.get(h, {"decision": "REVIEW", "reason_code": None, "evidence": []})
        t = theirs.get(h, {"decision": "REVIEW"})
        if o["decision"] == t["decision"]:
            agree += 1
            continue
        c = COST[o["decision"]][t["decision"]]
        key = (t["decision"], o["decision"])
        pairs[key] = pairs.get(key, 0) + 1
        dis.append({"hit_id": h, "theirs": t["decision"], "ours": o["decision"], "cost": c, "label": LABEL[c],
                    "ours_reason_code": o.get("reason_code"), "ours_evidence": o.get("evidence", [])})
    dis.sort(key=lambda d: (-d["cost"], d["hit_id"]))
    by_pair = [{"theirs": k[0], "ours": k[1], "cost": COST[k[1]][k[0]], "count": n}
               for k, n in sorted(pairs.items(), key=lambda kv: (-COST[kv[0][1]][kv[0][0]], kv[0]))]
    return {"counts": {"compared": len(hits), "agree": agree, "disagree": len(dis)},
            "agree_pct": round(100 * agree / len(hits), 1) if hits else None,
            "total_cost_if_ours_right": sum(d["cost"] for d in dis),
            "by_pair": by_pair, "rows": dis, "note": RANK_NOTE,
            "missing_in_ours_counted_as_review": missing(ours), "missing_in_theirs_counted_as_review": missing(theirs)}


def render(r, theirs_label, diligent_rows=0):
    c = r["counts"]
    out = [f"theirs: {theirs_label}", "note: this " + RANK_NOTE]
    if diligent_rows:
        out.append(f"note: Diligent mapping used for {diligent_rows} rows: {DILIGENT_NOTE}")
    out.append(f"compared {c['compared']} hits: {c['agree']} agree, {c['disagree']} disagree "
               f"({r['agree_pct']}% agree); cost if ours is right: {r['total_cost_if_ours_right']}")
    for p in r["by_pair"]:
        out.append(f"  theirs {p['theirs']} -> ours {p['ours']}: {p['count']}  (cost {p['cost']}, {LABEL[p['cost']]})")
    for side in ("ours", "theirs"):
        m = r[f"missing_in_{side}_counted_as_review"]
        if m:
            out.append(f"  {len(m)} hits missing in {side}, counted as REVIEW (e.g. {m[:3]})")
    out.append("disagreements, most dangerous first (open the case by hit_id):")
    for d in r["rows"]:
        out.append(f"  {d['cost']:>2} {d['hit_id']} theirs={d['theirs']} ours={d['ours']} "
                   f"code={d['ours_reason_code']} evidence={','.join(d['ours_evidence']) or '-'}  [{d['label']}]")
    return "\n".join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ours", required=True)
    ap.add_argument("--theirs")
    ap.add_argument("--format", default="auto", choices=["auto", "namesake", "diligent"])
    ap.add_argument("--hits", help="hits.jsonl: full hit list; hits absent from a file count as REVIEW")
    ap.add_argument("--baseline", choices=["name-only"], help=f"use {BASELINE_NOTE} as 'theirs'")
    ap.add_argument("--data", help="data folder (needed for --baseline)")
    ap.add_argument("--write-baseline", help="also write the baseline as scored-output JSONL")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    if bool(a.theirs) == bool(a.baseline):
        ap.error("give exactly one of --theirs or --baseline")
    if a.baseline and not a.data:
        ap.error("--baseline needs --data")
    stats = {}
    ours = load_decisions(a.ours, "namesake")
    if a.baseline:
        theirs, label = baseline_decisions(a.data), BASELINE_NOTE
        if a.write_baseline:
            with open(a.write_baseline, "w", encoding="utf-8", newline="\n") as f:
                for h in sorted(theirs):
                    t = theirs[h]
                    f.write(json.dumps({"hit_id": h, "alert_id": t["alert_id"], "decision": t["decision"],
                                        "reason_code": t["reason_code"], "customer_record_id": None,
                                        "reason": f"Name-only baseline ({BASELINE_NOTE}).", "evidence": []}) + "\n")
    else:
        theirs = load_decisions(a.theirs, a.format, stats)
        label = "other system (" + os.path.basename(a.theirs) + ")"
    universe = {r["hit_id"] for r in read_jsonl(a.hits)} if a.hits else None
    r = compare(ours, theirs, universe)
    r["theirs_label"] = label
    if stats.get("diligent_rows"):
        r["note"] += "; Diligent mapping: " + DILIGENT_NOTE
    print(json.dumps(r, indent=2) if a.json else render(r, label, stats.get("diligent_rows", 0)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
