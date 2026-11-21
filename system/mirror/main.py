"""Mirror engine entry point.

python system/mirror/main.py <data_dir> <out.jsonl> [--trace DIR]

Rules decide every verdict. No model, no network. Any fatal error still writes one
REVIEW/INSUFFICIENT_DATA line per hit; any per-hit error does the same for that hit.
"""
import hashlib
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fallback import fallback_line  # noqa: E402  (stdlib-only module: the fatal path must not depend on the engine)


def write_lines(path, lines):
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        for line in lines:
            handle.write(json.dumps(line, ensure_ascii=True, sort_keys=False) + "\n")


def main(argv):
    args = [a for a in argv[1:]]
    trace_dir = None
    if "--trace" in args:
        i = args.index("--trace")
        trace_dir = args[i + 1] if i + 1 < len(args) else None
        del args[i:i + 2]
    if len(args) != 2:
        print("usage: main.py <data_dir> <out.jsonl> [--trace DIR]", file=sys.stderr)
        return 2
    data_dir, out_path = args
    started = time.time()
    try:
        import engine
        lines, counts = engine.run(data_dir, trace_dir)
    except Exception as error:  # fatal: still answer every hit
        print("fatal error (%s); writing REVIEW for every hit" % type(error).__name__, file=sys.stderr)
        import load
        lines = [fallback_line(h) for h in load.read_hits(data_dir)]
        counts = {"fatal": 1}
    write_lines(out_path, lines)
    with open(out_path, "rb") as handle:
        digest = hashlib.sha256(handle.read()).hexdigest()
    tally = {}
    for line in lines:
        tally[line["decision"]] = tally.get(line["decision"], 0) + 1
    print("hits %d  decisions %s  seconds %.1f" % (len(lines), json.dumps(tally, sort_keys=True), time.time() - started))
    print("counters %s" % json.dumps(counts, sort_keys=True), file=sys.stderr)
    print("sha256 %s" % digest, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
