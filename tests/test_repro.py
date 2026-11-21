import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
import repro

OK = """import sys, json
rows = [("H-1", "REVIEW", "INSUFFICIENT_DATA"), ("H-2", "DIFFERENT_ENTITY", "DOB_MISMATCH")]
with open(sys.argv[2], "w", encoding="utf-8", newline="\\n") as f:
    f.write("".join(json.dumps({"hit_id": h, "decision": d, "reason_code": c}) + "\\n" for h, d, c in rows))
"""
FLAKY = OK.replace('("H-1", "REVIEW", "INSUFFICIENT_DATA")',
                   '("H-1", __import__("random").choice(["REVIEW", "SAME_ENTITY"]), "X")')


class ReproTest(unittest.TestCase):
    def engine(self, tmp, src):
        p = os.path.join(tmp, "system", "mirror")
        os.makedirs(p)
        with open(os.path.join(p, "main.py"), "w", encoding="utf-8") as f:
            f.write(src)
        return os.path.join(p, "main.py")

    def test_identical(self):
        with tempfile.TemporaryDirectory() as t:
            r = repro.run(t, 3, self.engine(t, OK), timeout=60)
        self.assertTrue(r["identical"], r)
        self.assertEqual((r["ok_runs"], r["hits"], len(set(r["fingerprints"]))), (3, 2, 1))

    def test_flaky_detected(self):
        with tempfile.TemporaryDirectory() as t:
            r = repro.run(t, 12, self.engine(t, FLAKY), timeout=60)  # 2^-11 chance of a false pass
        self.assertFalse(r["identical"])
        self.assertEqual(r["hits_with_difference"], ["H-1"])
        self.assertLess(r["agreement_pct"]["H-1"], 100)

    def test_crash_and_missing_engine(self):
        with tempfile.TemporaryDirectory() as t:
            r = repro.run(t, 2, self.engine(t, "raise SystemExit(3)"), timeout=60)
            self.assertFalse(r["identical"])
            self.assertEqual(len(r["failures"]), 2)
            nope = os.path.join(t, "system", "nope.py")
            self.assertIn("error", repro.run(t, 2, nope))
            self.assertEqual(repro.main(["--data", t, "--engine", nope]), 2)


if __name__ == "__main__":
    unittest.main()
