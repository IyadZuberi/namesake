import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "system", "mirror"))
import dates
from dates import PDate, parse, agree, contradict


class ParseTests(unittest.TestCase):
    def test_all_formats(self):
        self.assertEqual(parse("2004-05-19"), PDate(2004, 5, 19))
        self.assertEqual(parse("19/05/2004"), PDate(2004, 5, 19))
        self.assertEqual(parse("19 May 2004"), PDate(2004, 5, 19))
        self.assertEqual(parse("May 19, 2004"), PDate(2004, 5, 19))
        self.assertEqual(parse("May 9, 2004"), PDate(2004, 5, 9))
        self.assertEqual(parse("9 May 2004"), PDate(2004, 5, 9))
        self.assertEqual(parse("2004"), PDate(2004, None, None))
        self.assertEqual(parse("2004-05"), PDate(2004, 5, None))
        self.assertEqual(parse("May 2004"), PDate(2004, 5, None))
        self.assertIsNone(parse(None))
        self.assertIsNone(parse("not a date"))

    def test_slash_is_day_first(self):
        self.assertEqual(parse("03/04/1990"), PDate(1990, 4, 3))
        self.assertIsNone(parse("04/13/1990"))  # month 13 never guessed

    def test_find_all_in_order(self):
        text = "On 2024-03-16 the check of DOB 22/09/1956 was done; also May 3, 1990."
        self.assertEqual(dates.find_all(text), [PDate(2024, 3, 16), PDate(1956, 9, 22), PDate(1990, 5, 3)])


class CompareTests(unittest.TestCase):
    def test_year_only_agrees_with_full_date(self):
        self.assertTrue(agree(PDate(1973, 3, 5), PDate(1973, None, None)))
        self.assertTrue(agree(PDate(1973, None, None), PDate(1973, 3, 5)))

    def test_plus_minus_one_year_is_unknown(self):
        c, h = PDate(1973, 3, 5), PDate(1974, None, None)
        self.assertFalse(agree(c, h))
        self.assertFalse(contradict(c, h))

    def test_two_years_apart_contradicts(self):
        self.assertTrue(contradict(PDate(1973, 3, 5), PDate(1975, None, None)))

    def test_same_year_different_month_or_day(self):
        self.assertTrue(contradict(PDate(1973, 3, 5), PDate(1973, 4, None)))
        self.assertTrue(contradict(PDate(1973, 3, 5), PDate(1973, 3, 6)))
        self.assertFalse(contradict(PDate(1973, 3, 5), PDate(1973, 3, None)))

    def test_all_contradicted_needs_every_date(self):
        c = PDate(1980, 1, 1)
        self.assertFalse(dates.all_contradicted(c, [PDate(1990, None, None), PDate(1981, None, None)]))
        self.assertTrue(dates.all_contradicted(c, [PDate(1990, None, None), PDate(1995, None, None)]))
        self.assertFalse(dates.all_contradicted(c, []))

    def test_max_age(self):
        self.assertEqual(dates.max_age_at(PDate(2007, None, None), PDate(2020, 1, 8)), 13)
        self.assertEqual(dates.max_age_at(PDate(2000, 6, 10), PDate(2016, 6, 9)), 15)
        self.assertEqual(dates.max_age_at(PDate(2000, 6, 10), PDate(2016, 6, 10)), 16)

    def test_latest_possible(self):
        self.assertEqual(dates.latest_possible(PDate(2022, 3, None)), (2022, 3, 31))
        self.assertEqual(dates.latest_possible(PDate(2022, None, None)), (2022, 12, 31))


if __name__ == "__main__":
    unittest.main()
