import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
import recheck


def w(path, rows):
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")


def row(h, d, code="INSUFFICIENT_DATA", ev=()):
    return {"hit_id": h, "alert_id": "A-1", "decision": d, "reason_code": code, "evidence": list(ev)}


class RecheckTest(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.TemporaryDirectory()
        self.p = lambda n: os.path.join(self.d.name, n)

    def tearDown(self):
        self.d.cleanup()

    def test_costs_sorted_and_diligent_mapping(self):
        w(self.p("ours.jsonl"), [
            row("H-3", "SAME_ENTITY", "NAME_DOB_MATCH", ["CUS-1", "KYC-1"]),
            row("H-1", "DIFFERENT_ENTITY", "DOB_MISMATCH", ["NOTE-9"]),
            row("H-2", "REVIEW"), row("H-4", "SAME_ENTITY", "NAME_DOB_MATCH"), row("H-5", "REVIEW"),
        ])
        w(self.p("theirs.jsonl"), [
            {"hit_id": "H-3", "determination": "FALSE_POSITIVE"},  # DIFF vs our SAME -> 60
            {"hit_id": "H-1", "determination": "TRUE_POSITIVE"},   # SAME vs our DIFF -> 3
            {"hit_id": "H-2", "determination": "FALSE_POSITIVE"},  # DIFF vs our REVIEW -> 60
            {"hit_id": "H-4", "determination": "UNRESOLVED"},      # REVIEW vs our SAME -> 2
            {"hit_id": "H-5", "determination": "UNRESOLVED"},      # agree
        ])
        r = recheck.compare(recheck.load_decisions(self.p("ours.jsonl"), "namesake"),
                            recheck.load_decisions(self.p("theirs.jsonl")))
        self.assertEqual((r["counts"]["agree"], r["counts"]["disagree"], r["total_cost_if_ours_right"]), (1, 4, 125))
        self.assertEqual([(d["hit_id"], d["cost"]) for d in r["rows"]],
                         [("H-2", 60), ("H-3", 60), ("H-1", 3), ("H-4", 2)])
        self.assertEqual(r["rows"][1]["ours_evidence"], ["CUS-1", "KYC-1"])
        self.assertEqual({(p["theirs"], p["ours"]): p["count"] for p in r["by_pair"]}[("DIFFERENT_ENTITY", "SAME_ENTITY")], 1)
        self.assertEqual(r["by_pair"][0]["cost"], 60)
        self.assertIn("does not prove which side is right", r["note"])
        txt = recheck.render(r, "x", 4)
        self.assertIn("possible unsafe clearance", txt)
        self.assertIn("does not prove which side is right", txt)
        self.assertIn("untested against a real export", txt)

    def test_scored_shape_theirs_and_missing_hits(self):
        w(self.p("o.jsonl"), [row("H-1", "SAME_ENTITY", "NAME_DOB_MATCH")])
        w(self.p("t.jsonl"), [row("H-2", "DIFFERENT_ENTITY", "DOB_MISMATCH")])
        r = recheck.compare(recheck.load_decisions(self.p("o.jsonl"), "namesake"),
                            recheck.load_decisions(self.p("t.jsonl"), "auto"), {"H-1", "H-2"})
        self.assertEqual(r["missing_in_theirs_counted_as_review"], ["H-1"])
        # H-1: theirs missing=REVIEW vs ours SAME = 2; H-2: theirs DIFF vs ours missing=REVIEW = 60
        self.assertEqual({d["hit_id"]: d["cost"] for d in r["rows"]}, {"H-1": 2, "H-2": 60})

    def test_evidence_only_ids_no_names(self):
        w(self.p("o.jsonl"), [row("H-1", "SAME_ENTITY", "NAME_DOB_MATCH", ["CUS-1", "Alice Invented"])])
        self.assertEqual(recheck.load_decisions(self.p("o.jsonl"))["H-1"]["evidence"], ["CUS-1"])

    def test_name_only_baseline(self):
        w(self.p("alerts.jsonl"), [{"alert_id": "A-1", "customer": {"name": "Zorbo Quillfeather"}},
                                    {"alert_id": "A-2", "customer": {"name": "Zorbo Quillfeather"}},
                                    {"alert_id": "A-3", "customer": {"name": "Zorbo Quillfeather"}}])
        w(self.p("hits.jsonl"), [
            {"hit_id": "H-1", "alert_id": "A-1", "name": "Quillfeather, Zorbo", "aliases": []},
            {"hit_id": "H-2", "alert_id": "A-2", "name": "Mirta Dunwoody", "aliases": ["Zorbo Quilfeather"]},
            {"hit_id": "H-3", "alert_id": "A-3", "name": "Mirta Dunwoody", "aliases": []},
        ])
        b = recheck.baseline_decisions(self.d.name)
        self.assertEqual(b["H-1"]["decision"], "SAME_ENTITY")       # reordered name agrees
        self.assertEqual(b["H-2"]["decision"], "SAME_ENTITY")       # alias with one-letter typo agrees
        self.assertEqual(b["H-3"]["decision"], "DIFFERENT_ENTITY")
        self.assertTrue(recheck.BASELINE_NOTE.startswith("our naive baseline"))


if __name__ == "__main__":
    unittest.main()
