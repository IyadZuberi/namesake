import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
import bundle


def w(p, rows):
    with open(p, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


class BundleTest(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory()
        self.d = self.t.name
        w(f"{self.d}/alerts.jsonl", [{"alert_id": "A-1", "customer": {"name": "Zorbo Quillfeather"}, "hit_ids": ["H-1"]}])
        w(f"{self.d}/customers.jsonl", [{"record_id": "CUS-1", "full_name": "Zorbo Quillfeather"}, {"record_id": "CUS-2"}])
        w(f"{self.d}/kyc_checks.jsonl", [{"check_id": "KYC-1", "verified_name": "Zorbo Quillfeather"}])
        w(f"{self.d}/notes.jsonl", [{"note_id": "NOTE-1", "requester_email": "z@x.example", "text": "hi"}])
        w(f"{self.d}/hits.jsonl", [{"hit_id": "H-1", "alert_id": "A-1", "name": "Q, Z"}])
        w(f"{self.d}/search_results.jsonl", [])
        w(f"{self.d}/out.jsonl", [{"hit_id": "H-1", "alert_id": "A-1", "decision": "REVIEW", "reason_code": "INSUFFICIENT_DATA",
                                   "customer_record_id": "CUS-1", "reason": "r", "evidence": ["KYC-1"]}])
        os.makedirs(f"{self.d}/tr")

    def tearDown(self):
        self.t.cleanup()

    def run_main(self, *extra):
        return bundle.main(["--data", self.d, "--decisions", f"{self.d}/out.jsonl",
                            "--out", f"{self.d}/o/cases.json", *extra])

    def test_refuses_without_marker(self):
        self.assertEqual(self.run_main(), 2)
        self.assertFalse(os.path.exists(f"{self.d}/o/cases.json"))

    def test_builds_with_marker_missing_trace_and_titles(self):
        open(f"{self.d}/SYNTHETIC", "w").close()
        with open(f"{self.d}/titles.json", "w", encoding="utf-8") as f:
            json.dump({"H-1": "Two Zorbos"}, f)
        self.assertEqual(self.run_main("--trace", f"{self.d}/tr", "--titles", f"{self.d}/titles.json"), 0)
        c = load(f"{self.d}/o/cases.json")
        self.assertEqual(len(c), 1)
        self.assertEqual((c[0]["title"], c[0]["case_id"], c[0]["trace"]), ("Two Zorbos", "S-0001", None))
        self.assertEqual(c[0]["alert"]["hit_ids"], ["H-1"])  # contracts v2 keeps hit_ids
        self.assertEqual(c[0]["notes"], [])
        self.assertEqual([r["record_id"] for r in c[0]["customer_records"]], ["CUS-1"])  # CUS-2 not cited
        self.assertEqual(len(c[0]["kyc_checks"]), 1)

    def test_trace_file_and_override_flag(self):
        with open(f"{self.d}/tr/H-1.json", "w", encoding="utf-8") as f:
            json.dump({"trace": {"linked_via": "none", "x": "see NOTE-1"}}, f)
        self.assertEqual(self.run_main("--i-know-this-is-synthetic", "--trace", f"{self.d}/tr"), 0)
        c = load(f"{self.d}/o/cases.json")
        self.assertEqual(c[0]["trace"]["linked_via"], "none")
        self.assertEqual([n["note_id"] for n in c[0]["notes"]], ["NOTE-1"])
        self.assertEqual(c[0]["notes"][0]["requester_email"], "z@x.example")  # full rows

    def test_links_accounts_onboarding_checks_notes(self):
        w(f"{self.d}/alerts.jsonl", [{"alert_id": "A-1", "account_ref": "ACC-1", "email": "z@x.example", "hit_ids": ["H-1"]}])
        w(f"{self.d}/accounts.jsonl", [{"account_id": "ACC-1", "customer_id": "CUS-2"}, {"account_id": "ACC-9", "customer_id": "CUS-1"}])
        w(f"{self.d}/onboarding.jsonl", [{"account_id": "ACC-1", "customer_id": "CUS-2", "kyc_applicant_id": "APP-1"}])
        w(f"{self.d}/kyc_checks.jsonl", [{"check_id": "KYC-7", "applicant_id": "APP-1"}, {"check_id": "KYC-8", "applicant_id": "APP-2"}])
        open(f"{self.d}/SYNTHETIC", "w").close()
        self.assertEqual(self.run_main(), 0)
        c = load(f"{self.d}/o/cases.json")[0]
        self.assertEqual([r["record_id"] for r in c["customer_records"]], ["CUS-1", "CUS-2"])  # CUS-1 cited by the decision
        self.assertEqual([r["account_id"] for r in c["accounts"]], ["ACC-1"])
        self.assertEqual(len(c["onboarding"]), 1)
        self.assertEqual([r["check_id"] for r in c["kyc_checks"]], ["KYC-7"])
        self.assertEqual([r["note_id"] for r in c["notes"]], ["NOTE-1"])  # matched by alert email


if __name__ == "__main__":
    unittest.main()
