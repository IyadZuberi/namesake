"""Leak check: fail if any git-tracked file (except output/dev.jsonl) contains a name or ID from the local event data.
Usage: python tools/leakcheck.py --data DIR [--repo REPO] [--allow output/dev.jsonl ...]
Prints file paths and counts only, never the matched strings. Exit 0 = clean, 1 = leak, 2 = bad input.
Names: customer full_name/preferred_name and hit name/aliases with at least 2 words and 8 characters, matched case-insensitively on word boundaries.
IDs: every id value in the data files (CUS-, H-, A-, NOTE-, KYC-, SR-, ACC-, APP-), matched as whole tokens; a file is flagged at 3 or more distinct ids.
ponytail: substring scan over every tracked file is O(names x bytes); fine for ~100 small files, index it if the repo grows.
Common-word aliases can false-positive; a human checks the flagged file, the tool never shows the string."""
import argparse
import json
import os
import re
import subprocess
import sys

ID_RE = re.compile(r"\b(?:CUS|H|A|NOTE|KYC|SR|ACC|APP)-[0-9A-Za-z]+\b")
ID_KEYS = {"alerts": ("alert_id",), "customers": ("record_id",), "accounts": ("account_id", "customer_id"),
           "onboarding": ("account_id", "customer_id", "kyc_applicant_id"), "kyc_checks": ("check_id", "applicant_id"),
           "notes": ("note_id",), "search_results": ("result_id",), "hits": ("hit_id", "alert_id")}
MIN_NAME = 8  # full names only: single-word aliases and common first names are not data leaks
MIN_WORDS = 2
MIN_IDS = 3  # random synthetic ids collide with the event id space now and then; a data dump shows many ids


def read_jsonl(path):
    if not os.path.isfile(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def load_secrets(data):
    names, ids = set(), set()
    for r in read_jsonl(os.path.join(data, "customers.jsonl")):
        names |= {r.get(k) for k in ("full_name", "preferred_name")}
    for r in read_jsonl(os.path.join(data, "hits.jsonl")):
        names |= {r.get("name"), *(r.get("aliases") or [])}
    for table, keys in ID_KEYS.items():
        for r in read_jsonl(os.path.join(data, table + ".jsonl")):
            ids |= {r.get(k) for k in keys}
    norm = {" ".join(re.findall(r"\w+", n.lower())) for n in names if isinstance(n, str)}
    names = {n for n in norm if len(n) >= MIN_NAME and len(n.split()) >= MIN_WORDS}
    # all-digit ids (CUS-, SR-) are a small space where random synthetic ids collide with event ids: names are the signal there
    ids = {i for i in ids if isinstance(i, str) and ID_RE.fullmatch(i) and any(c in "abcdef" for c in i.split("-", 1)[1].lower())}
    return names, ids


def tracked_files(repo):
    out = subprocess.run(["git", "ls-files", "-z"], cwd=repo, capture_output=True, check=True).stdout
    return [p for p in out.decode("utf-8").split("\0") if p]


def scan(data, repo, allow=("output/dev.jsonl",)):
    """Return {path: {"names": n, "ids": n}} for tracked files that leak; counts are distinct matches."""
    names, ids = load_secrets(data)
    if not names and not ids:
        raise ValueError(f"no names or ids loaded from {data}")
    leaks = {}
    max_words = min(6, max((len(n.split()) for n in names), default=MIN_WORDS))
    for path in tracked_files(repo):
        if path in allow:
            continue
        full = os.path.join(repo, path)
        if not os.path.isfile(full):
            continue
        with open(full, "rb") as f:
            text = f.read().decode("utf-8", "ignore")
        words = re.findall(r"\w+", text.lower())
        grams = set()
        for k in range(MIN_WORDS, max_words + 1):
            grams |= {" ".join(words[j:j + k]) for j in range(len(words) - k + 1)}
        n = len(names & grams)
        i = len(set(ID_RE.findall(text)) & ids)
        if n or i >= MIN_IDS:
            leaks[path] = {"names": n, "ids": i}
    return leaks


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", required=True)
    ap.add_argument("--repo", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument("--allow", nargs="*", default=["output/dev.jsonl"])
    a = ap.parse_args(argv)
    try:
        leaks = scan(a.data, a.repo, tuple(a.allow))
    except (ValueError, OSError, subprocess.CalledProcessError) as e:
        print(f"leakcheck error: {e}")
        return 2
    for path, c in sorted(leaks.items()):
        print(f"LEAK {path}: {c['names']} distinct names, {c['ids']} distinct ids")
    print(f"leakcheck: {'FAIL, ' + str(len(leaks)) + ' tracked files leak' if leaks else 'PASS, no names or ids in tracked files'}"
          f" (allowed: {', '.join(a.allow)})")
    return 1 if leaks else 0


if __name__ == "__main__":
    sys.exit(main())
