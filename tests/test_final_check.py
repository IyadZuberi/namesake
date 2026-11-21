import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
import final_check
import score

LINE = {"hit_id": "H-000001", "alert_id": "A-000001", "decision": "REVIEW", "reason_code": "INSUFFICIENT_DATA",
        "customer_record_id": None, "reason": "No data.", "evidence": []}
# ids are split in the engine source so the leak scan (data ids in tracked files) stays clean
SRC = repr(LINE).replace("H-000001", "H-' + '000001").replace("A-000001", "A-' + '000001")
GOOD = ("import sys, json\n"
        "open(sys.argv[2], 'w', encoding='utf-8', newline='\\n').write(json.dumps(%s) + '\\n')\n" % SRC)
# set order of strings depends on PYTHONHASHSEED: a seed-dependent engine
BAD = ("import sys, json\n"
       "L = %r\nL['reason'] = ','.join(set('abcdefghijklmnop'))\n"
       "open(sys.argv[2], 'w', encoding='utf-8', newline='\\n').write(json.dumps(L) + '\\n')\n" % SRC)
RUN = "#!/bin/sh\nhere=\"$(cd \"$(dirname \"$0\")\" && pwd)\"\nexec python \"$here/mirror/main.py\" \"$1\" \"$2\"\n"


def put(root, rel, text):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def git(repo, *a):
    subprocess.run(["git", *a], cwd=repo, check=True, capture_output=True)


class FinalCheckTest(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory()
        self.data = os.path.join(self.t.name, "data")
        self.repo = os.path.join(self.t.name, "repo")
        os.makedirs(self.repo)
        for name in ("alerts", "accounts", "onboarding", "kyc_checks", "notes", "search_results"):
            put(self.data, name + ".jsonl", "")
        put(self.data, "customers.jsonl", json.dumps({"record_id": "CUS-123456", "full_name": "Zorbo Quillfeather"}) + "\n")
        put(self.data, "alerts.jsonl", json.dumps({"alert_id": "A-000001"}) + "\n")
        put(self.data, "hits.jsonl", json.dumps({"hit_id": "H-000001", "alert_id": "A-000001", "name": "Mirta Dunwoody"}) + "\n")
        git(self.repo, "init", "-q")

    def tearDown(self):
        self.t.cleanup()

    def build(self, engine, mode="+x"):
        put(self.repo, "system/run", RUN)
        put(self.repo, "system/mirror/main.py", engine)
        put(self.repo, "output/dev.jsonl", json.dumps(LINE) + "\n")
        git(self.repo, "add", "-A")
        git(self.repo, "update-index", f"--chmod={mode}", "system/run")

    def test_mode_and_patterns(self):
        self.build(GOOD, "-x")
        self.assertFalse(final_check.check_mode(self.repo)[0])
        git(self.repo, "update-index", "--chmod=+x", "system/run")
        self.assertTrue(final_check.check_mode(self.repo)[0])
        self.assertTrue(final_check.check_patterns(self.repo)[0])
        put(self.repo, "system/cache/x.json", "{}")
        put(self.repo, "pkg/a.receipt.json", "{}")
        git(self.repo, "add", "-f", "-A")
        ok, detail = final_check.check_patterns(self.repo)
        self.assertFalse(ok)
        self.assertIn("system/cache/x.json", detail)
        self.assertIn("pkg/a.receipt.json", detail)

    def test_determinism_fails_for_seed_dependent_engine(self):
        self.build(BAD)
        self.assertFalse(final_check.check_determinism(self.repo, self.data, 60)[0])

    def test_full_run_passes(self):
        vp = score.find_validate()
        if not vp:
            self.skipTest("organisers' validate.py not on this machine")
        self.build(GOOD)
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = final_check.main(["--data", self.data, "--repo", self.repo, "--validate", vp, "--timeout", "120"])
        self.assertEqual(rc, 0, buf.getvalue())
        self.assertEqual(buf.getvalue().count("PASS "), 6, buf.getvalue())

    def test_full_run_fails_on_stale_output(self):
        vp = score.find_validate()
        if not vp:
            self.skipTest("organisers' validate.py not on this machine")
        self.build(GOOD.replace("INSUFFICIENT_DATA", "AMBIGUOUS_CUSTOMER_RECORD"))
        with contextlib.redirect_stdout(io.StringIO()):
            rc = final_check.main(["--data", self.data, "--repo", self.repo, "--validate", vp, "--timeout", "120"])
        self.assertEqual(rc, 1)


if __name__ == "__main__":
    unittest.main()
