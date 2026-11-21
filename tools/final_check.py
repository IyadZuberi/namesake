"""Last step before push. PASS/FAIL per check, exit 1 on any FAIL.
Usage: python tools/final_check.py --data DEV_DATA_DIR [--repo REPO] [--validate PATH] [--timeout 1800]
Checks: engine twice (PYTHONHASHSEED=1, =2) byte-identical to output/dev.jsonl; organisers' validate.py on
output/dev.jsonl; leakcheck; system/run mode 100755; clean-checkout run (tracked files copied to a temp dir,
system/run run there, output byte-identical); no tracked receipts/graphs/cache files.
The clean-checkout copy takes the working-tree content of tracked files, so commit first: the check cannot see
what is only in your working tree."""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import leakcheck  # noqa: E402
import score  # noqa: E402

BAD_PATH = re.compile(r"(^|/)(receipts|graphs|cache|__pycache__)/|\.receipt\.json$|\.pyc$")


def git(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True, encoding="utf-8")


def read(path):
    with open(path, "rb") as f:
        return f.read()


def run_engine(repo, data, out, seed, timeout):
    main_py = os.path.join(repo, "system", "mirror", "main.py")
    if not os.path.isfile(main_py):
        return False, f"engine not found: {main_py}"
    env = dict(os.environ, PYTHONHASHSEED=str(seed))
    try:
        p = subprocess.run([sys.executable, main_py, data, out], env=env, capture_output=True, timeout=timeout, cwd=repo)
    except subprocess.TimeoutExpired:
        return False, f"timeout after {timeout}s"
    if p.returncode != 0 or not os.path.isfile(out):
        tail = p.stderr.decode("utf-8", "replace").strip().splitlines()[-1:] or [""]
        return False, f"exit {p.returncode} {tail[0][:200]}"
    return True, ""


def check_determinism(repo, data, timeout):
    ref = os.path.join(repo, "output", "dev.jsonl")
    if not os.path.isfile(ref):
        return False, "output/dev.jsonl missing"
    with tempfile.TemporaryDirectory() as t:
        for seed in (1, 2):
            out = os.path.join(t, f"s{seed}.jsonl")
            ok, why = run_engine(repo, data, out, seed, timeout)
            if not ok:
                return False, f"PYTHONHASHSEED={seed}: {why}"
            if read(out) != read(ref):
                return False, f"PYTHONHASHSEED={seed}: output differs from output/dev.jsonl"
    return True, "both seeds byte-identical to output/dev.jsonl"


def check_validate(repo, data, validate_path):
    vp = score.find_validate(validate_path)
    if not vp:
        return False, "validate.py not found (pass --validate)"
    answers, errors = score.load_validate(vp).validate(data, os.path.join(repo, "output", "dev.jsonl"))
    return (not errors), f"{len(answers)} lines, {len(errors)} problems" + (f"; first: {errors[0]}" if errors else "")


def check_leak(repo, data):
    try:
        leaks = leakcheck.scan(data, repo)
    except (ValueError, OSError, subprocess.CalledProcessError) as e:
        return False, f"leakcheck error: {e}"
    return (not leaks), ("no names or ids in tracked files" if not leaks else
                         "; ".join(f"{p} ({c['names']} names, {c['ids']} ids)" for p, c in sorted(leaks.items())))


def check_mode(repo):
    out = git(repo, "ls-files", "-s", "system/run").stdout.strip()
    return out.startswith("100755"), out.split("\t")[0] if out else "system/run is not tracked"


def check_patterns(repo):
    bad = [p for p in leakcheck.tracked_files(repo) if BAD_PATH.search(p)]
    return (not bad), ("none tracked" if not bad else "tracked: " + ", ".join(bad))


def check_clean_checkout(repo, data, timeout):
    ref = os.path.join(repo, "output", "dev.jsonl")
    with tempfile.TemporaryDirectory() as t:
        for p in leakcheck.tracked_files(repo):
            src = os.path.join(repo, p)
            if os.path.isfile(src):
                os.makedirs(os.path.dirname(os.path.join(t, p)) or t, exist_ok=True)
                shutil.copy2(src, os.path.join(t, p))
        out = os.path.join(t, "clean_out.jsonl")
        sh = shutil.which("sh")
        run = os.path.join(t, "system", "run")
        if not os.path.isfile(run):
            return False, "system/run not tracked"
        cmd = [sh, run, data, out] if sh else [sys.executable, os.path.join(t, "system", "mirror", "main.py"), data, out]
        try:
            p = subprocess.run(cmd, capture_output=True, timeout=timeout, cwd=t)
        except subprocess.TimeoutExpired:
            return False, f"timeout after {timeout}s"
        how = "system/run" if sh else "main.py directly (no sh on PATH, system/run not exercised)"
        if p.returncode != 0 or not os.path.isfile(out):
            tail = p.stderr.decode("utf-8", "replace").strip().splitlines()[-1:] or [""]
            return False, f"{how}: exit {p.returncode} {tail[0][:200]}"
        same = os.path.isfile(ref) and read(out) == read(ref)
        return same, f"ran via {how}; " + ("byte-identical to output/dev.jsonl" if same else "output differs from output/dev.jsonl")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", required=True)
    ap.add_argument("--repo", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument("--validate")
    ap.add_argument("--timeout", type=int, default=1800)
    a = ap.parse_args(argv)
    repo, data = os.path.abspath(a.repo), os.path.abspath(a.data)
    checks = [("determinism (hash seeds 1 and 2)", lambda: check_determinism(repo, data, a.timeout)),
              ("organisers' validate.py", lambda: check_validate(repo, data, a.validate)),
              ("leakcheck", lambda: check_leak(repo, data)),
              ("system/run mode 100755", lambda: check_mode(repo)),
              ("clean-checkout run", lambda: check_clean_checkout(repo, data, a.timeout)),
              ("no receipts/graphs/cache tracked", lambda: check_patterns(repo))]
    failed = 0
    for name, fn in checks:
        try:
            ok, detail = fn()
        except Exception as e:  # a crashing check is a failing check
            ok, detail = False, f"{type(e).__name__}: {e}"
        failed += not ok
        print(f"{'PASS' if ok else 'FAIL'} {name}: {detail}")
    print("ALL PASS" if not failed else f"{failed} CHECK(S) FAILED")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
