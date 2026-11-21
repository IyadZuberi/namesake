"""Robustness fixes found in the fresh-eyes audit. SYNTHETIC data only (Fire Drill and invented rows)."""
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "system", "mirror"))
sys.path.insert(0, HERE)
import engine  # noqa: E402

FIRE = os.path.join(HERE, "..", "demo-data", "firedrill")


def run_without(*drop):
    folder = tempfile.mkdtemp(prefix="namesake_robust_")
    try:
        for name in os.listdir(FIRE):
            if name not in drop:
                shutil.copy(os.path.join(FIRE, name), folder)
        lines, counts = engine.run(folder)
        return {l["hit_id"]: l for l in lines}, counts
    finally:
        shutil.rmtree(folder, ignore_errors=True)


class MissingOptionalFiles(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.full, _ = run_without()

    def check_no_new_clears(self, *drop):
        out, counts = run_without(*drop)
        self.assertEqual(len(out), len(self.full))
        self.assertEqual(counts.get("hit_errors"), 0)
        for hid, line in out.items():
            if line["decision"] == "DIFFERENT_ENTITY":
                self.assertEqual(self.full[hid]["decision"], "DIFFERENT_ENTITY", hid)
        return out

    def test_missing_search_results_is_empty_not_fatal(self):
        self.check_no_new_clears("search_results.jsonl")

    def test_missing_name_variants_blocks_name_clears(self):
        out = self.check_no_new_clears("name_variants.json")
        self.assertFalse(any(l["reason_code"] == "NAME_MISMATCH_VERIFIED" for l in out.values()))

    def test_missing_notes_blocks_location_clears(self):
        # without notes, a record DOB can contradict where a KYC note would have agreed; that is the data
        # as given. What must hold: no crash, and no clear on location (notes can hold past residences).
        out, counts = run_without("notes.jsonl")
        self.assertEqual((len(out), counts.get("hit_errors")), (len(self.full), 0))
        self.assertFalse(any(l["reason_code"] == "LOCATION_MISMATCH" for l in out.values()))


if __name__ == "__main__":
    unittest.main()


# ---- gate-level fixes (SYNTHETIC facts, no files) --------------------------------------------
from types import SimpleNamespace as NS  # noqa: E402

import customer  # noqa: E402
import dates  # noqa: E402
import gates  # noqa: E402
import names  # noqa: E402
import load  # noqa: E402
from test_customer import alert, cus, make_data, note  # noqa: E402

P = dates.PDate
DATA = NS(pairs=names.variant_pairs([["muhammad", "mohammed"]]), legal=frozenset({"ltd"}))


def person(**kw):
    base = dict(etypes=["Individual"], record_ids=["CUS-000001"], is_company=False, dob=P(1980, 1, 2), dob_source="KYC-000001",
                dob_alts=[], ver=NS(name="Anna Berg", source_id="KYC-000001"), alt_ver_names=[],
                countries={"NO": [("residence", "CUS-000001")]}, country_unparsed=False, place_unparsed=False,
                names=[("Anna Berg", "KYC-000001")], lived_notes=[])
    base.update(kw)
    return NS(**base)


def hit(**kw):
    base = dict(hit_id="H-000001", etype="Individual", company=False, death=None, deceased_no_date=False, first_report=None,
                dobs=[], other_dobs=[], dob_source="dobs", sr_ids=[], names=[("Anna Berg", ["anna", "berg"])],
                countries={"SE"}, countries_unparsed=False)
    base.update(kw)
    return NS(**base)


class LivedNoteWithoutCountry(unittest.TestCase):
    def test_city_only_residence_note_blocks_location_clear(self):
        rows = [cus("CUS-000001", "Anna Berg")]
        email = rows[0]["email"]
        r = customer.Resolver(load.Data(make_data(customers=rows, notes=[note("NOTE-000001", email, "Customer said she lived in Gothenburg until 2019.", channel="phone")])))
        res = r.resolve(alert(account_ref=None, email=email, customer={"name": "Anna Berg"}))
        p = res.persons[0]
        self.assertTrue(p.place_unparsed)
        self.assertIn("NOTE-000001", p.lived_notes)

    def test_place_unparsed_never_clears_on_location(self):
        d = gates.evaluate(person(place_unparsed=True, ver=None), hit(names=[("Bo Lind", ["bo", "lind"])]), P(2026, 11, 1), DATA)
        self.assertNotEqual(d[1], "LOCATION_MISMATCH")
        self.assertEqual(person(ver=None).place_unparsed, False)
        d2 = gates.evaluate(person(ver=None), hit(names=[("Bo Lind", ["bo", "lind"])]), P(2026, 11, 1), DATA)
        self.assertEqual(d2[1], "LOCATION_MISMATCH")


class KycNoteNeedsPositiveOutcome(unittest.TestCase):
    def kyc(self, text):
        return customer.parse_kyc_note({"note_id": "NOTE-000009", "created_at": "2024-02-02", "text": text})

    def test_pending_note_is_not_evidence(self):
        for text in ("Identity check for ANNA BERG, born 1980-01-02, pending documents from Norway.",
                     "Awaiting passport for ANNA BERG (DOB 02/01/1980); on hold.",
                     "ID check for ANNA BERG inconclusive, born 1980-01-02."):
            self.assertFalse(self.kyc(text)["ok"], text)

    def test_passed_and_failed_notes(self):
        self.assertTrue(self.kyc("On 2024-02-02, Onfido verified the passport of ANNA BERG, DOB 02/01/1980.")["ok"])
        self.assertFalse(self.kyc("Passport check for ANNA BERG was rejected on 2024-02-02.")["ok"])


class ReasonLength(unittest.TestCase):
    def test_cap_keeps_every_fact_in_four_sentences(self):
        import explain
        text = "Dates agree for KYC-000001. The names agree. Both are linked to Norway. No gate contradicts them. The customer was found as CUS-000001."
        out = explain.cap_sentences(text)
        self.assertEqual(len([s for s in explain._SENT_RX.split(out)]), 4)
        for frag in ("KYC-000001", "Norway", "contradicts", "CUS-000001"):
            self.assertIn(frag, out)
        self.assertEqual(explain.cap_sentences("One. Two."), "One. Two.")


class DobReasonStatesHitDate(unittest.TestCase):
    def test_full_hit_date_is_named(self):
        import explain
        self.assertEqual(explain._hit_dates({"hit_dobs": ["1985-01-01"], "hit_years": [1985], "customer_dob": "1985-01-03"}),
                         "the date 1985-01-01: the same year, but the day differs")
        self.assertEqual(explain._hit_dates({"hit_dobs": ["1960", "1961"], "hit_years": [1960, 1961], "customer_dob": "1985-01-03"}),
                         "only the year 1960 or 1961")

    def test_gate_carries_hit_dates(self):
        g = gates.dob_gate(person(dob=P(1985, 1, 3)), hit(dobs=[P(1985, 1, 1)]))
        self.assertEqual((g["result"], g["facts"]["hit_dobs"]), ("contradiction", ["1985-01-01"]))


class UnreadCustomerCountry(unittest.TestCase):
    def test_known_countries_still_block_a_confirm(self):
        # residence unreadable, nationality NO, hit SE, name and DOB agree: REVIEW, not SAME (POLICY 6)
        d = gates.evaluate(person(country_unparsed=True), hit(dobs=[P(1980, 1, 2)]), P(2026, 11, 1), DATA)
        self.assertEqual((d[0], d[1]), ("REVIEW", "INSUFFICIENT_DATA"))

    def test_unread_country_never_clears(self):
        d = gates.evaluate(person(country_unparsed=True, ver=None), hit(names=[("Bo Lind", ["bo", "lind"])]), P(2026, 11, 1), DATA)
        self.assertNotEqual(d[0], "DIFFERENT_ENTITY")

    def test_overlap_still_confirms(self):
        d = gates.evaluate(person(country_unparsed=True), hit(dobs=[P(1980, 1, 2)], countries={"NO"}), P(2026, 11, 1), DATA)
        self.assertEqual(d[0], "SAME_ENTITY")


class CompanyTimeWording(unittest.TestCase):
    def test_company_reason_does_not_talk_about_adults(self):
        import explain
        self.assertNotIn("adult", explain._clear_second("TEMPORAL_IMPOSSIBILITY", NS(is_company=True), None, {}))
        self.assertIn("adult", explain._clear_second("TEMPORAL_IMPOSSIBILITY", NS(is_company=False), None, {}))
