import json
import os
import re
import subprocess
import sys
import tempfile
import unicodedata
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import firedrill  # noqa: E402

EVENT = r"C:\projects\fincrime-hackathon\data\official\track2\screening"
FILES = ["alerts", "hits", "customers", "accounts", "onboarding", "kyc_checks", "notes", "search_results", "expected"]
DIFF = {"TEMPORAL_IMPOSSIBILITY", "DOB_MISMATCH", "LOCATION_MISMATCH", "NAME_MISMATCH_VERIFIED",
        "ENTITY_TYPE_MISMATCH", "DECEASED"}
SAME = {"NAME_DOB_LOCATION_MATCH", "NAME_DOB_MATCH", "NAME_LOCATION_MATCH"}
REV = {"INSUFFICIENT_DATA", "AMBIGUOUS_CUSTOMER_RECORD"}
DECISION_OF = {**{c: "DIFFERENT_ENTITY" for c in DIFF}, **{c: "SAME_ENTITY" for c in SAME}, **{c: "REVIEW" for c in REV}}


def rows(d, name):
    with open(os.path.join(d, name + ".jsonl"), encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return " ".join(sorted(re.findall(r"[a-z0-9]+", s)))


class FireDrill(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.a, cls.b = os.path.join(cls.tmp.name, "a"), os.path.join(cls.tmp.name, "b")
        for d in (cls.a, cls.b):
            subprocess.run([sys.executable, os.path.join(ROOT, "tools", "firedrill.py"), "--out", d, "--seed", "7"],
                           check=True, capture_output=True)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_rerun_is_byte_identical(self):
        names = sorted(os.listdir(self.a))
        self.assertEqual(names, sorted(os.listdir(self.b)))
        self.assertIn("SYNTHETIC", names)
        for n in names:
            with open(os.path.join(self.a, n), "rb") as x, open(os.path.join(self.b, n), "rb") as y:
                self.assertEqual(x.read(), y.read(), n)

    def test_other_seed_differs(self):
        self.assertNotEqual(firedrill.build(7).t["hits"], firedrill.build(8).t["hits"])

    def test_every_line_is_json_and_ids_match_patterns(self):
        pats = {"alerts": ("alert_id", r"A-[0-9A-F]{6}"), "hits": ("hit_id", r"H-[0-9A-F]{6}"),
                "customers": ("record_id", r"CUS-\d{6}"), "accounts": ("account_id", r"ACC-[0-9A-F]{6}"),
                "kyc_checks": ("check_id", r"KYC-[0-9A-F]{6}"), "notes": ("note_id", r"NOTE-[0-9A-F]{6}"),
                "search_results": ("result_id", r"SR-[0-9A-F]{6}")}
        for n in FILES:
            with open(os.path.join(self.a, n + ".jsonl"), encoding="utf-8") as fh:
                for line in fh:
                    self.assertIsInstance(json.loads(line), dict)
        for n, (k, p) in pats.items():
            for r in rows(self.a, n):
                self.assertRegex(r[k], "^" + p + "$")
        for n in ("name_variants.json", "titles.json"):
            with open(os.path.join(self.a, n), encoding="utf-8") as fh:
                json.load(fh)

    def test_links_are_consistent(self):
        A, H, C = rows(self.a, "alerts"), rows(self.a, "hits"), rows(self.a, "customers")
        acc, onb, chk, notes = (rows(self.a, n) for n in ("accounts", "onboarding", "kyc_checks", "notes"))
        exp = rows(self.a, "expected")
        with open(os.path.join(self.a, "titles.json"), encoding="utf-8") as fh:
            titles = json.load(fh)
        hits = {h["hit_id"]: h for h in H}
        cids = {c["record_id"] for c in C}
        self.assertEqual(len(cids), len(C))
        self.assertEqual(len(hits), len(H))
        accs = {x["account_id"] for x in acc}
        logins = {x["login_handle"] for x in acc}
        emails = {c["email"] for c in C}
        for a in A:
            for hid in a["hit_ids"]:
                self.assertEqual(hits[hid]["alert_id"], a["alert_id"])
            if a["account_ref"]:
                self.assertIn(a["account_ref"], accs)
            if a["login_handle"]:
                self.assertIn(a["login_handle"], logins)
            if a["email"]:
                self.assertIn(a["email"], emails)
        self.assertEqual(sorted(sum((a["hit_ids"] for a in A), [])), sorted(hits))
        self.assertEqual({e["hit_id"] for e in exp}, set(hits))
        self.assertEqual(set(titles), set(hits))
        for x in acc + onb:
            self.assertIn(x["customer_id"], cids)
        apps = {o["kyc_applicant_id"] for o in onb}
        for c in chk:
            self.assertIn(c["applicant_id"], apps)
        for n in notes:
            self.assertIn(n["requester_email"], emails)
        for e in exp:
            self.assertTrue(e["expected_reason_codes"])
            for code in e["expected_reason_codes"]:
                self.assertEqual(DECISION_OF[code], e["expected_decision"], e)
            for r in e["expected_customer_record_ids"]:
                self.assertTrue(r == "AMBIGUOUS" or r in cids)
            self.assertTrue(e["why"].strip() and e["trap_class"])

    def test_validate_py_reports_no_problems(self):
        v = os.path.join(EVENT, "validate.py")
        if not os.path.exists(v):
            self.skipTest("event validate.py not readable")
        out = os.path.join(self.tmp.name, "review.jsonl")
        with open(out, "w", encoding="utf-8") as fh:
            for h in rows(self.a, "hits"):
                fh.write(json.dumps({"hit_id": h["hit_id"], "alert_id": h["alert_id"], "decision": "REVIEW",
                                     "reason_code": "INSUFFICIENT_DATA", "customer_record_id": None,
                                     "reason": "stub", "evidence": []}) + "\n")
        r = subprocess.run([sys.executable, v, "--data", self.a, "--output", out], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("0 problems", r.stdout)

    def test_no_collision_with_event_names(self):
        dev = os.path.join(EVENT, "dev")
        if not os.path.isdir(dev):
            self.skipTest("event data not readable")
        seen = {norm(r["full_name"]) for r in rows(dev, "customers")}
        for r in rows(dev, "hits"):
            seen.add(norm(r["name"]))
            seen.update(norm(re.sub(r"\(.*?\)", "", a)) for a in r["aliases"])
        seen.discard("")
        ours = [r["full_name"] for r in rows(self.a, "customers")]
        ours += [h["name"] for h in rows(self.a, "hits")] + [a["customer"]["name"] for a in rows(self.a, "alerts")]
        ours += [re.sub(r"\(.*?\)", "", x) for h in rows(self.a, "hits") for x in h["aliases"]]
        bad = [n for n in ours if norm(n) in seen]
        self.assertEqual(bad, [], "generated names collide with event data")
        contact = {r["email"] for r in rows(dev, "customers")} | {r["phone"] for r in rows(dev, "customers")}
        for r in rows(self.a, "customers"):
            self.assertNotIn(r["email"], contact)
            self.assertNotIn(r["phone"], contact)

    def test_synthetic_markers(self):
        for r in rows(self.a, "customers"):
            self.assertTrue(r["email"].endswith(".example"), r["email"])
            self.assertIn(" 555", r["phone"])
        with open(os.path.join(self.a, "SYNTHETIC"), encoding="utf-8") as fh:
            self.assertEqual(fh.read().strip(), "synthetic data, invented names")

    def test_dob_formats_covered(self):
        pats = {"Y": r"\d{4}", "YM": r"\d{4}-\d\d", "iso": r"\d{4}-\d\d-\d\d", "slash": r"\d\d/\d\d/\d{4}",
                "MY": r"[A-Z][a-z]+ \d{4}", "mdy": r"[A-Z][a-z]+ \d+, \d{4}", "dmy": r"\d+ [A-Z][a-z]+ \d{4}"}
        got = set()
        for r in rows(self.a, "customers") + rows(self.a, "kyc_checks"):
            d = r.get("dob") if "dob" in r else r.get("verified_dob")
            if d is None:
                got.add("null")
            else:
                got.update(k for k, p in pats.items() if re.fullmatch(p, d))
        self.assertEqual(got, {"null", *pats})


if __name__ == "__main__":
    unittest.main()
