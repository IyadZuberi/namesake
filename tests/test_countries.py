import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "system", "mirror"))
import countries as C


class CountryTests(unittest.TestCase):
    def test_names_codes_demonyms(self):
        self.assertEqual(C.parse_country("Nigeria"), "NG")
        self.assertEqual(C.parse_country("NG"), "NG")
        self.assertEqual(C.parse_country("Nigerian"), "NG")
        self.assertEqual(C.parse_country("British"), "GB")
        self.assertEqual(C.parse_country("Cote D'Ivoire"), "CI")
        self.assertEqual(C.parse_country("C�te d'Ivoire"), "CI")

    def test_bracket_suffix(self):
        self.assertEqual(C.parse_country("United States [Associated]"), "US")

    def test_last_comma_part(self):
        self.assertEqual(C.parse_place("Santa Prisca, Quito, Pichincha, Ecuador"), "EC")
        self.assertEqual(C.parse_place("1 Example Road, Testville, Canada [Business]"), "CA")

    def test_not_countries(self):
        self.assertIsNone(C.parse_country("International"))
        self.assertIsNone(C.parse_country("Europe"))
        self.assertTrue(C.is_non_country("Europe"))

    def test_territories_are_their_own_country(self):
        self.assertEqual(C.parse_country("Puerto Rico"), "PR")
        self.assertEqual(C.parse_country("Hong Kong"), "HK")
        self.assertNotEqual(C.parse_country("Jersey"), C.parse_country("United Kingdom"))

    def test_ambiguous_demonym_is_unparsed_but_scanned(self):
        self.assertIsNone(C.parse_country("Congolese"))
        self.assertEqual(C.scan_text("a Congolese national"), {"CG", "CD"})

    def test_unknown_value(self):
        self.assertIsNone(C.parse_country("Atlantis"))

    def test_scan_text(self):
        self.assertEqual(C.scan_text("They lived in Portugal and later in Brazil."), {"PT", "BR"})
        self.assertEqual(C.scan_text("The client has a house in the United States."), {"US"})
        self.assertEqual(C.scan_text("No place is named here."), set())

    def test_stress_reworded_residence_notes(self):
        notes = [
            ("The client maintained a job and home in Portugal between 2010 and 2011.", "PT"),
            ("Employment and residency in Bangladesh were reported for 2015 to 2019.", "BD"),
            ("Customer resided in Norway until 2014.", "NO"),
            ("Previously based in Kenya; moved for work.", "KE"),
            ("Lived abroad (Ghana) during their early twenties.", "GH"),
            ("Used to stay in the UK before relocating.", "GB"),
            ("Former address: Lagos, Nigeria.", "NG"),
            ("A German address was on file from 2012.", "DE"),
            ("Customer says they grew up in South Africa.", "ZA"),
            ("Worked in Singapore 2016-2018, then returned.", "SG"),
            ("Spent a decade in the Netherlands.", "NL"),
            ("Home was in the U.S. at the time.", "US"),
            ("RESIDENT IN FRANCE FROM 2009", "FR"),
            ("Moved from Poland in 2020.", "PL"),
            ("Student years were spent in Ireland.", "IE"),
            ("Customer reports a Brazilian flat they rented.", "BR"),
            ("Relocated: Sweden -> here.", "SE"),
            ("had lived in Cote d'Ivoire for years", "CI"),
            ("Lived in Panama (2011).", "PA"),
            ("Resident in Hong Kong 2013-2015.", "HK"),
            ("The customer stayed in Austria, then Italy.", "AT"),
            ("Address history: ES until 2018.", "ES"),
            ("An Indonesian residence permit expired.", "ID"),
            ("Was living in Thailand during 2019.", "TH"),
        ]
        self.assertGreaterEqual(len(notes), 20)
        for text, code in notes:
            self.assertIn(code, C.scan_text(text), text)


if __name__ == "__main__":
    unittest.main()
