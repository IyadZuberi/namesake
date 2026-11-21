"""5-run sameness harness. Copies system/ into N fresh temp dirs (empty cache), runs the
engine on DIR each time, compares per-hit decision+reason_code and output bytes.
Usage: python tools/repro.py --data DIR --runs 5 [--engine system/mirror/main.py] [--json]
Exit 0 = identical, 1 = any difference or failed run, 2 = engine missing / bad input."""
import argparse, hashlib, json, os, shutil, subprocess, sys, tempfile
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = shutil.ignore_patterns("cache", "receipts", "graphs", "__pycache__", "*.pyc")


def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def read_out(path):
    rows = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                try:
                    r = json.loads(line)
                    rows[r.get("hit_id")] = (r.get("decision"), r.get("reason_code"))
                except (json.JSONDecodeError, AttributeError):
                    pass
    return rows


def system_root(engine):
    """Return (system dir, engine path relative to the system dir's parent) or None."""
    parts = os.path.abspath(engine).split(os.sep)
    if "system" not in parts:
        return None
    i = len(parts) - 1 - parts[::-1].index("system")
    return os.sep.join(parts[: i + 1]), os.sep.join(parts[i:])


def run(data, runs, engine, timeout=1800):
    root = system_root(engine)
    if root is None or not os.path.isfile(engine):
        return {"error": f"engine not found or not under a 'system' folder: {engine}. Build the engine first."}
    sysdir, rel = root
    outs, fails = [], []
    for n in range(runs):
        with tempfile.TemporaryDirectory(prefix=f"repro{n}_") as tmp:
            shutil.copytree(sysdir, os.path.join(tmp, "system"), ignore=SKIP)
            out = os.path.join(tmp, "out.jsonl")
            try:
                p = subprocess.run([sys.executable, os.path.join(tmp, rel), data, out],
                                   capture_output=True, timeout=timeout, cwd=tmp)
            except subprocess.TimeoutExpired:
                fails.append(f"run {n + 1}: timeout after {timeout}s")
                continue
            if p.returncode != 0 or not os.path.isfile(out):
                tail = p.stderr.decode("utf-8", "replace").strip().splitlines()[-1:] or [""]
                fails.append(f"run {n + 1}: exit {p.returncode} {tail[0][:200]}")
                continue
            keep = os.path.join(tempfile.gettempdir(), f"repro_keep_{os.getpid()}_{n}.jsonl")
            shutil.copyfile(out, keep)
            outs.append(keep)
    res = {"runs": runs, "ok_runs": len(outs), "failures": fails}
    if outs:
        hashes = [sha(o) for o in outs]
        tables = [read_out(o) for o in outs]
        hit_ids = sorted({h for t in tables for h in t}, key=str)
        per_hit, diff = {}, []
        for h in hit_ids:
            vals = [t.get(h) for t in tables]
            share = Counter(vals).most_common(1)[0][1] / len(vals)
            per_hit[h] = round(100 * share, 1)
            if share < 1:
                diff.append(h)
        res.update(fingerprints=hashes, bytes_identical=len(set(hashes)) == 1,
                   hits=len(hit_ids), hits_with_difference=diff,
                   agreement_pct={h: per_hit[h] for h in diff},
                   mean_agreement_pct=round(sum(per_hit.values()) / len(per_hit), 2) if per_hit else None)
        for o in outs:
            os.remove(o)
    res["identical"] = (not fails and res.get("bytes_identical", False) and not res.get("hits_with_difference"))
    return res


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", required=True)
    ap.add_argument("--runs", type=int, default=5)
    ap.add_argument("--engine", default=os.path.join(ROOT, "system", "mirror", "main.py"))
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    res = run(os.path.abspath(a.data), a.runs, os.path.abspath(a.engine))
    if a.json:
        print(json.dumps(res, indent=2))
    elif "error" in res:
        print(res["error"])
    else:
        for i, h in enumerate(res.get("fingerprints", []), 1):
            print(f"run {i}: sha256 {h}")
        for f in res["failures"]:
            print("FAILED " + f)
        for h, p in res.get("agreement_pct", {}).items():
            print(f"  {h}: agreement {p}%")
        print(f"{res['ok_runs']}/{res['runs']} runs ok; hits {res.get('hits')}; "
              f"mean agreement {res.get('mean_agreement_pct')}%; "
              f"bytes identical: {res.get('bytes_identical')}; "
              + ("IDENTICAL" if res["identical"] else "DIFFERENT"))
    if "error" in res:
        return 2
    return 0 if res["identical"] else 1


if __name__ == "__main__":
    sys.exit(main())
