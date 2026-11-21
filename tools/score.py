"""Score an output file on practice labels using the organisers' validate.py (imported by path, not copied).
Usage: python tools/score.py --data DIR --output OUT.jsonl [--labels practice_labels.jsonl] [--validate PATH] [--json]"""
import argparse, glob, importlib.util, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HACK = r"C:\projects\fincrime-hackathon\data\official\track2\screening\validate.py"


def find_validate(explicit: "str | None" = None) -> "str | None":
    for p in [explicit, os.environ.get("NAMESAKE_VALIDATE"),
              *glob.glob(os.path.join(ROOT, "**", "validate.py"), recursive=True), HACK]:
        if p and os.path.isfile(p):
            return p
    return None


def load_validate(path):
    spec = importlib.util.spec_from_file_location("organiser_validate", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def score(v, data, output, labels_path):
    answers, errors = v.validate(data, output)
    labels = v.read_jsonl(labels_path)
    dec = v.DECISIONS
    grid = {t: {s: 0 for s in dec + ["nothing"]} for t in dec}
    cost = base = 0
    for row in labels:
        said = answers.get(row["hit_id"], {}).get("decision", "REVIEW")
        grid[row["decision"]][answers.get(row["hit_id"], {}).get("decision", "nothing")] += 1
        cost += v.COST[row["decision"]][said]
        base += v.COST[row["decision"]]["REVIEW"]
    right = [r for r in labels if answers.get(r["hit_id"], {}).get("decision") == r["decision"]]
    unsafe = sum(grid[t]["DIFFERENT_ENTITY"] for t in dec if t != "DIFFERENT_ENTITY")
    said_diff = sum(grid[t]["DIFFERENT_ENTITY"] for t in dec)
    n_same = sum(grid["SAME_ENTITY"].values())
    codes = sum(1 for r in right if answers[r["hit_id"]].get("reason_code") in r["reason_codes"])
    recs = sum(1 for r in right if answers[r["hit_id"]].get("customer_record_id") in r["customer_record_ids"]
               or (r["customer_record_ids"] == ["AMBIGUOUS"]
                   and answers[r["hit_id"]].get("customer_record_id") in (None, "", "AMBIGUOUS")))
    reviews = sum(1 for a in answers.values() if a.get("decision") == "REVIEW")
    pct = lambda a, b: round(100 * a / b, 1) if b else None
    return {
        "lines_read": len(answers), "problems": len(errors), "problem_samples": errors[:10],
        "labelled_hits": len(labels),
        "decision_score": round(100 * max(0.0, 1 - cost / base), 1) if base else None,
        "unsafe_clearances": unsafe, "review_rate_pct": pct(reviews, len(answers)),
        "clearance_precision_pct": pct(said_diff - unsafe, said_diff),
        "same_entity_recall_pct": pct(grid["SAME_ENTITY"]["SAME_ENTITY"], n_same),
        "reason_code_pct_on_right": pct(codes, len(right)),
        "customer_record_pct_on_right": pct(recs, len(right)),
        "confusion_label_by_said": grid,
    }


def scoreboard(r):
    """docs/contracts.md section 5: aggregates only (no hit IDs, no names). None = 'not yet measured'."""
    import datetime
    return {"generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
            "source": "practice labels (tuned on these 50; not held out)",
            "lines": r["lines_read"], "problems": r["problems"], "decision_score": r["decision_score"],
            "unsafe_clearances": r["unsafe_clearances"], "review_rate": r["review_rate_pct"],
            "clearance_precision": r["clearance_precision_pct"], "same_recall": r["same_entity_recall_pct"],
            "reason_code_pct": r["reason_code_pct_on_right"], "customer_record_pct": r["customer_record_pct_on_right"],
            "confusion": r["confusion_label_by_said"], "repro": None, "run_seconds": None}


def render(r):
    out = [f"{r['lines_read']} lines read, {r['problems']} problems"] + ["  " + e for e in r["problem_samples"]]
    for k in ("decision_score", "unsafe_clearances", "review_rate_pct", "clearance_precision_pct",
              "same_entity_recall_pct", "reason_code_pct_on_right", "customer_record_pct_on_right"):
        out.append(f"{k}: {r[k]}")
    cols = list(next(iter(r["confusion_label_by_said"].values())))
    out.append("confusion (rows = label, columns = our decision)")
    out.append(f"{'':18}" + "".join(f"{c:>18}" for c in cols))
    for t, row in r["confusion_label_by_said"].items():
        out.append(f"{t:18}" + "".join(f"{row[c]:>18}" for c in cols))
    return "\n".join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--labels")
    ap.add_argument("--validate")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--scoreboard", help="also write web/data/scoreboard.json-style aggregates to this path")
    a = ap.parse_args(argv)
    vp = find_validate(a.validate)
    if not vp:
        print("validate.py not found; pass --validate PATH or set NAMESAKE_VALIDATE")
        return 2
    labels = a.labels or os.path.join(a.data, "practice_labels.jsonl")
    if not os.path.isfile(labels):
        print(f"practice labels not found: {labels}")
        return 2
    r = score(load_validate(vp), a.data, a.output, labels)
    if a.scoreboard:
        with open(a.scoreboard, "w", encoding="utf-8", newline="\n") as f:
            json.dump(scoreboard(r), f, indent=2)
            f.write("\n")
    print(json.dumps(r, indent=2) if a.json else render(r))
    return 1 if r["problems"] else 0


if __name__ == "__main__":
    sys.exit(main())
