"""Gate tests on SYNTHETIC facts (no files)."""
import os
import sys
import unittest
from types import SimpleNamespace as NS

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "system", "mirror"))
import dates  # noqa: E402
import gates  # noqa: E402
import names  # noqa: E402

P = dates.PDate
PAIRS = names.variant_pairs([["muhammad", "mohammed"]])
DATA = NS(pairs=PAIRS, legal=frozenset({"ltd", "gmbh"}))


def person(**kw):
    base = dict(etypes=["Individual"], record_ids=["CUS-000001"], is_company=False, dob=P(1980, 1, 2), dob_source="KYC-000001",
                dob_alts=[], ver=NS(name="Anna Berg", source_id="KYC-000001"), alt_ver_names=[],
                countries={"NO": [("residence", "CUS-000001")]}, country_unparsed=False,
                names=[("Anna Berg", "KYC-000001")], lived_notes=[])
    base.update(kw)
    return NS(**base)


def hit(**kw):
    base = dict(hit_id="H-000001", etype="Individual", company=False, death=None, deceased_no_date=False, first_report=None,
                dobs=[], other_dobs=[], dob_source="dobs", sr_ids=[], names=[("Anna Berg", ["anna", "berg"])],
                countries={"NO"}, countries_unparsed=False)
    base.update(kw)
    return NS(**base)


def run(p, h, screened=P(2026, 11, 1)):
    return gates.evaluate(p, h, screened, DATA)


class DobGateTests(unittest.TestCase):
    def test_all_hit_dates_contradicted_clears(self):
        d = run(person(), hit(dobs=[P(1960, None, None), P(1961, None, None)]))
        self.assertEqual((d[0], d[1]), ("DIFFERENT_ENTITY", "DOB_MISMATCH"))
        self.assertEqual(d[3], ["KYC-000001"])  # KYC/NOTE, never CUS

    def test_one_agreeing_date_prevents_the_clear(self):
        d = run(person(), hit(dobs=[P(1960, None, None), P(1980, None, None)]))
        self.assertEqual(d[0], "SAME_ENTITY")

    def test_year_apart_is_unknown(self):
        d = run(person(), hit(dobs=[P(1981, None, None)]))
        self.assertEqual(d[0], "REVIEW")

    def test_same_year_other_month_contradicts(self):
        d = run(person(), hit(dobs=[P(1980, 2, None)], countries={"NO"}))
        self.assertEqual(d[1], "DOB_MISMATCH")

    def test_other_hit_source_agreeing_blocks_the_clear(self):
        d = run(person(), hit(dobs=[P(1950, None, None)], other_dobs=[P(1980, None, None)]))
        self.assertEqual(d[0], "REVIEW")

    def test_second_customer_dob_not_contradicted_blocks_the_clear(self):
        d = run(person(dob_alts=[(P(1950, None, None), "CUS-000001")]), hit(dobs=[P(1950, None, None)]))
        self.assertNotEqual(d[1], "DOB_MISMATCH")

    def test_unknown_dob_never_clears(self):
        self.assertEqual(run(person(dob=None), hit(dobs=[P(1950, None, None)]))[0], "REVIEW")
        self.assertEqual(run(person(), hit(dobs=[]))[0], "REVIEW")


class TimeGateTests(unittest.TestCase):
    def test_under_16_at_earliest_report_with_partial_dob(self):
        d = run(person(dob=P(2007, None, None)), hit(first_report=P(2020, 1, 8)))
        self.assertEqual((d[0], d[1]), ("DIFFERENT_ENTITY", "TEMPORAL_IMPOSSIBILITY"))
        self.assertEqual(d[3], ["KYC-000001"])

    def test_partial_dob_that_could_allow_adult_does_not_clear(self):
        self.assertEqual(run(person(dob=P(2004, None, None)), hit(first_report=P(2020, 1, 8)))[0], "REVIEW")

    def test_company_incorporated_after_report(self):
        p = person(etypes=["Company"], is_company=True, dob=P(2012, 11, 14), names=[("Acme Ltd", "K")], ver=None)
        h = hit(etype="Company", company=True, first_report=P(1998, 3, 30), names=[("Acme Ltd", ["acme"])])
        self.assertEqual(run(p, h)[1], "TEMPORAL_IMPOSSIBILITY")


class DeathGateTests(unittest.TestCase):
    def test_death_before_screening_clears(self):
        d = run(person(), hit(death=P(2022, 3, None)))
        self.assertEqual(d[1], "DECEASED")

    def test_death_after_screening_does_not(self):
        self.assertEqual(run(person(), hit(death=P(2026, 12, 1)))[0], "REVIEW")

    def test_deceased_without_date_does_not_clear(self):
        self.assertEqual(run(person(), hit(deceased_no_date=True))[0], "REVIEW")

    def test_death_month_in_screening_month_is_not_before(self):
        self.assertEqual(run(person(), hit(death=P(2026, 11, None)))[0], "REVIEW")


class NameGateTests(unittest.TestCase):
    def test_verified_name_agreeing_with_none_clears_even_if_record_name_agrees(self):
        p = person(ver=NS(name="Greta Holm", source_id="KYC-000009"), names=[("Greta Holm", "KYC-000009")])
        d = run(p, hit())
        self.assertEqual((d[0], d[1]), ("DIFFERENT_ENTITY", "NAME_MISMATCH_VERIFIED"))
        self.assertEqual(d[3], ["KYC-000009"])

    def test_variant_spelling_agrees(self):
        p = person(ver=NS(name="Mohammed Rahimi", source_id="K"), names=[("Mohammed Rahimi", "K")])
        h = hit(names=[("Muhammad Rahimi", ["muhammad", "rahimi"])], dobs=[P(1980, None, None)])
        self.assertEqual(run(p, h)[0], "SAME_ENTITY")

    def test_single_real_part_cannot_be_cleared_on_name(self):
        p = person(ver=NS(name="Anna N/A", source_id="K"), names=[("Anna N/A", "K")])
        self.assertEqual(run(p, hit(names=[("Zed Quinn", ["zed", "quinn"])]))[0], "REVIEW")

    def test_older_approved_name_agreeing_blocks_the_clear(self):
        p = person(ver=NS(name="Greta Holm", source_id="K2"), names=[("Greta Holm", "K2")], alt_ver_names=[("Anna Berg", "K1")])
        self.assertEqual(run(p, hit())[0], "REVIEW")

    def test_hit_single_part_alias_can_agree(self):
        h = hit(names=[("Zed Quinn", ["zed", "quinn"]), ("Berg", ["berg"])], dobs=[P(1980, None, None)])
        self.assertEqual(run(person(), h)[0], "SAME_ENTITY")


class LocationGateTests(unittest.TestCase):
    def test_every_country_differs_clears_and_cites_all_records(self):
        p = person(record_ids=["CUS-000001", "CUS-000002"], countries={"NO": [("residence", "CUS-000001"), ("document", "KYC-000001")]})
        d = run(p, hit(countries={"SE"}))
        self.assertEqual((d[0], d[1]), ("DIFFERENT_ENTITY", "LOCATION_MISMATCH"))
        self.assertEqual(d[3], ["CUS-000001", "CUS-000002", "KYC-000001"])

    def test_one_shared_country_prevents_the_clear(self):
        self.assertEqual(run(person(), hit(countries={"SE", "NO"}))[0], "REVIEW")

    def test_name_and_dob_agree_but_country_differs_is_review(self):
        d = run(person(), hit(countries={"SE"}, dobs=[P(1980, None, None)]))
        self.assertEqual((d[0], d[1]), ("REVIEW", "INSUFFICIENT_DATA"))

    def test_unparsed_customer_country_never_clears(self):
        self.assertEqual(run(person(country_unparsed=True), hit(countries={"SE"}))[0], "REVIEW")

    def test_unparsed_hit_country_never_clears(self):
        self.assertEqual(run(person(), hit(countries={"SE"}, countries_unparsed=True))[0], "REVIEW")

    def test_no_countries_never_clears(self):
        self.assertEqual(run(person(countries={}), hit(countries={"SE"}))[0], "REVIEW")
        self.assertEqual(run(person(), hit(countries=set()))[0], "REVIEW")

    def test_screened_country_is_a_blocking_country_not_cited(self):
        p = person(countries={"NO": [("residence", "CUS-000001")], "SE": [("screened", "")]})
        self.assertEqual(run(p, hit(countries={"SE"}))[0], "REVIEW")


class TypeAndSameTests(unittest.TestCase):
    def test_person_vs_company_clears(self):
        d = run(person(), hit(etype="Company", company=True))
        self.assertEqual(d[1], "ENTITY_TYPE_MISMATCH")

    def test_same_with_country_code(self):
        d = run(person(), hit(dobs=[P(1980, 1, None)]))
        self.assertEqual(d[1], "NAME_DOB_LOCATION_MATCH")
        self.assertEqual(d[3], ["CUS-000001", "KYC-000001"])

    def test_same_without_country_info(self):
        d = run(person(), hit(dobs=[P(1980, None, None)], countries=set()))
        self.assertEqual(d[1], "NAME_DOB_MATCH")

    def test_company_same_on_name_and_country(self):
        p = person(etypes=["Company"], is_company=True, dob=None, ver=None, names=[("Acme Trading Ltd", "CUS-000001")])
        h = hit(etype="Company", company=True, names=[("Acme Trading GmbH", ["acme", "trading"])])
        self.assertEqual(run(p, h)[1], "NAME_LOCATION_MATCH")

    def test_no_dob_means_no_confirmation(self):
        self.assertEqual(run(person(), hit(dobs=[]))[0], "REVIEW")


if __name__ == "__main__":
    unittest.main()
