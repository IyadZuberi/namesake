import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "system", "mirror"))
import names as N

PAIRS = N.variant_pairs([
    ["muhammad", "mohammed", "mohamed"],
    ["yusuf", "joseph", "joe"],
    ["joseph", "josef", "joe", "joey"],
])
LEGAL = frozenset({"ltd", "gmbh", "na", "sa", "ab"})


def ag(a, b, company=False):
    return N.agree(N.parts(a, company, LEGAL), N.parts(b, company, LEGAL), PAIRS)


class PartsTests(unittest.TestCase):
    def test_case_accents_punctuation_brackets(self):
        self.assertEqual(N.parts("Zoë (Zozo) O'Neil-Park"), ["zoe", "oneil", "park"])

    def test_initials_not_parts_and_distinct_once(self):
        self.assertEqual(N.parts("J. R. Smith Smith"), ["smith"])

    def test_placeholders(self):
        for p in ("NA", "N/A", "TEST", "UNKNOWN", "XXX", "NONE", "12345"):
            self.assertEqual(N.parts(p), [], p)

    def test_legal_forms_only_for_companies(self):
        self.assertEqual(N.parts("Acme Trading Ltd", True, LEGAL), ["acme", "trading"])
        self.assertEqual(N.parts("Sa Ab", False, LEGAL), ["sa", "ab"])
        self.assertEqual(N.parts("Acme NA", True, LEGAL), ["acme"])


class AgreeTests(unittest.TestCase):
    def test_variant_pair(self):
        self.assertTrue(ag("Mohammed Rahimi", "Muhammad Rahimi"))

    def test_joined_split(self):
        self.assertTrue(ag("Abdulsalam Kareem", "Abdul Salam Kareem"))
        self.assertTrue(ag("Abdulsalam", "Abdul Salam"))

    def test_edit_boundaries(self):
        self.assertTrue(N.part_match("karim", "kariim", PAIRS))        # 5 letters, 1 edit
        self.assertFalse(N.part_match("karim", "kairm", PAIRS))        # swap = 2 edits
        self.assertFalse(N.part_match("johnson", "jonxxon", PAIRS))    # 7 letters, 3 edits
        self.assertTrue(N.part_match("jonathan", "jonathen", PAIRS))
        self.assertTrue(N.part_match("jonathan", "jonathxx", PAIRS))   # 2 edits ok for long
        self.assertFalse(N.part_match("ann", "anna", PAIRS))           # <4 letters: identical only
        self.assertFalse(N.part_match("li", "lo", PAIRS))

    def test_shorter_part_length_decides(self):
        self.assertFalse(N.part_match("lena", "lenxxxx", PAIRS))

    def test_groups_not_merged(self):
        self.assertTrue(N.part_match("joe", "joseph", PAIRS))
        self.assertTrue(N.part_match("joe", "yusuf", PAIRS))
        self.assertFalse(N.part_match("josef", "yusuf", PAIRS))  # would only chain through joseph

    def test_two_parts_or_all_of_shorter(self):
        self.assertTrue(ag("Anna Petrova", "Anna K Petrova Ivanova"))
        self.assertTrue(ag("Li Wei", "Wei Li"))
        self.assertFalse(ag("Anna Petrova", "Anna Smirnova"))
        self.assertTrue(ag("Petrova", "Anna Petrova"))

    def test_single_part_alias_can_agree(self):
        self.assertTrue(ag("Tomas Berg", "Berg"))

    def test_no_parts_never_agree(self):
        self.assertFalse(ag("N/A", "Anna Berg"))

    def test_company_legal_form_ignored(self):
        self.assertTrue(ag("Acme Trading Ltd", "Acme Trading GmbH", True))


if __name__ == "__main__":
    unittest.main()
