"""Watchlist side: gather the hit's facts wherever they are (POLICY 5).

HitFacts(hit, data, sr_index) holds derived facts only: possible birth dates, tied countries,
names, dated reports, death date. Sources for a hit DOB, in order: dobs field, first paragraph
of the profile notes, matching web search results.
"""
import re
from collections import defaultdict

import countries
import dates
import names

PHRASES = {
    "Sanctions": "a sanctioned individual",
    "PEP": "a politically exposed person",
    "Enforcement": "the subject of enforcement action",
    "Adverse Media": "named in adverse media",
    "SOE": "a state-owned enterprise official",
}
OTHER_PHRASE = "named on a watchlist"
FULL_MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
REPORT_RX = re.compile(r"^According to [^;\n]+; (%s) (\d{1,2}), (\d{4}):" % FULL_MONTHS, re.M)
_DATE = r"(?:\d{1,2} %s \d{4}|%s \d{1,2},? \d{4}|%s,? \d{4}|\d{4}-\d{2}-\d{2}|\d{4})" % (dates._MON, dates._MON, dates._MON)
BORN_RX = re.compile(r"\bborn (?:on |in |around |circa )?(%s)\b" % _DATE, re.I)
YEAR_RX = re.compile(r"(?<![\d$])(1[89]\d\d|20\d\d)(?!\d)")
# an age must sit in an age phrase: "aged 45", "45-year-old", "45 years old", "was 45", and in a search
# snippet also the "Name, 45," form; "28 years in prison" or "$45" is not an age
AGE_RXS = [
    re.compile(r"\b(?:aged?|age of)\s+(\d{2})\b(?!\s*(?:years? (?:in|of|and)|months|%|percent))", re.I),
    re.compile(r"\b(\d{2})[- ]years?[- ]old\b", re.I),
    re.compile(r"\bwas (\d{2})\b(?!\s*(?:years? (?:in|of|and)|months|%|percent))", re.I),
]
COMMA_AGE_RX = re.compile(r"[A-Za-zÀ-ɏ], (\d{2}),")
RELATIVE_RX = re.compile(r"\b(son|daughter|wife|husband|brother|sister|father|mother|children|child|nephew|niece|cousin|grand\w+|spouse|parents?)\b", re.I)


def tokens(name):
    """Order-free token set for search-result matching (accents, brackets, punctuation, initials ignored)."""
    return frozenset(names.parts(name))


def build_sr_index(results):
    idx = defaultdict(list)
    for s in results:
        idx[tokens(s.get("query"))].append(s)
    return idx


def age_years(sentence, snippet=False):
    """'aged 45 ... March 2019' -> two possible birth years as year-only PDates, else None."""
    if len(sentence) > 240:
        return None
    spans = []
    for rx in (dates.SCAN_RX, dates.SCAN_PARTIAL_RX, YEAR_RX):
        for m in rx.finditer(sentence):
            if not any(a < m.end() and m.start() < b for a, b, _ in spans):
                spans.append((m.start(), m.end(), m.group(0)))
    refs = set()
    for _, _, text in spans:
        p = dates.parse(text)
        if p:
            refs.add(p.y)
    if len(refs) != 1:
        return None
    ages = set()
    for rx in AGE_RXS + ([COMMA_AGE_RX] if snippet else []):
        ages |= {int(x) for x in rx.findall(sentence) if 14 <= int(x) <= 99}
    if len(ages) != 1:
        return None
    ref, age = refs.pop(), ages.pop()
    return [dates.PDate(ref - age - 1, None, None), dates.PDate(ref - age, None, None)]


def sentence_dobs(text, snippet=False):
    """DOBs stated in a paragraph or snippet: 'born on/in ...' and age-at-date forms."""
    out = []
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", text or ""):
        if sentence.startswith("According to") or RELATIVE_RX.search(sentence):
            continue
        found = False
        for m in BORN_RX.finditer(sentence):
            p = dates.parse(m.group(1))
            if p:
                out.append(p)
                found = True
        if not found:
            ages = age_years(sentence, snippet)
            if ages:
                out += ages
    return out


class HitFacts:
    def __init__(self, hit, data, sr_index):
        self.hit_id = hit["hit_id"]
        self.etype = hit.get("entity_type")
        company = self.etype == "Company"
        self.company = company

        # names
        raw = [hit.get("name"), hit.get("best_matching_name")] + list(hit.get("aliases") or [])
        full = " ".join(x for x in (hit.get("first_name"), hit.get("middle_name"), hit.get("last_name")) if x)
        raw.append(full or None)
        self.names = []
        for n in raw:
            p = names.parts(n, company, data.legal)
            if p and p not in [q for q in (x[1] for x in self.names)]:
                self.names.append((n, p))
        self.alias_names = [n for n in (hit.get("aliases") or [])]

        # countries tied to the hit
        self.countries = set()
        self.countries_unparsed = False
        values = []
        for fld in ("countries", "nationality", "citizenship", "addresses"):
            values += [(fld, v) for v in (hit.get(fld) or [])]
        for v in (hit.get("place_of_birth") or "").split(";"):
            if v.strip():
                values.append(("place_of_birth", v))
        pob_parsed = pob_unparsed = False  # place_of_birth is "City; Country": a lone city piece is not an unparsed country
        for fld, v in values:
            if not isinstance(v, str) or not v.strip():
                continue
            code = countries.parse_place(v)
            if code:
                self.countries.add(code)
                pob_parsed = pob_parsed or fld == "place_of_birth"
                continue
            last = re.sub(r"\s*\[[^\]]*\]", "", v).split(",")[-1]
            if countries.is_non_country(last):
                continue
            found = countries.scan_text(re.sub(r"\s*\[[^\]]*\]", "", v))
            if found:
                self.countries |= found  # over-including the hit's countries only blocks a clear
                pob_parsed = pob_parsed or fld == "place_of_birth"
            elif fld == "place_of_birth":
                pob_unparsed = True
            else:
                self.countries_unparsed = True
        if pob_unparsed and not pob_parsed:
            self.countries_unparsed = True

        # dated reports and death
        notes = hit.get("profile_notes") or ""
        self.reports = sorted(dates.PDate(int(m.group(3)), dates._MONTHS[m.group(1).lower()], int(m.group(2)))
                              for m in REPORT_RX.finditer(notes))
        self.first_report = self.reports[0] if self.reports else None
        self.death = dates.parse(hit.get("deceased_date"))
        self.deceased_no_date = hit.get("life_status") == "Deceased" and self.death is None

        # birth dates by source
        self.dob_sources = {}
        self.sr_ids = []
        field = [p for p in (dates.parse(x) for x in (hit.get("dobs") or [])) if p]
        if field:
            self.dob_sources["dobs"] = field
        if not company:
            first = sentence_dobs(notes.split("\n\n")[0]) if notes else []
            if first:
                self.dob_sources["first_paragraph"] = first
            sr = self._from_search(hit, sr_index)
            if sr:
                self.dob_sources["search_result"] = sr
        order = ("dobs", "first_paragraph", "search_result")
        self.dob_source = next((s for s in order if s in self.dob_sources), "none")
        self.dobs = list(self.dob_sources.get(self.dob_source, []))
        # every other source: used only to BLOCK a DOB clear when it agrees with the customer
        self.other_dobs = [p for s in order if s in self.dob_sources and s != self.dob_source for p in self.dob_sources[s]]

    def _from_search(self, hit, sr_index):
        cat = hit.get("primary_category") or (hit.get("categories") or [None])[0]
        phrase = PHRASES.get(cat, OTHER_PHRASE)
        seen, out = set(), []
        if not self.countries:
            return out
        for n, _ in self.names:
            for s in sr_index.get(tokens(n), []):
                if s["result_id"] in seen:
                    continue
                seen.add(s["result_id"])
                snip = s.get("snippet") or ""
                if phrase not in snip.lower() or not (countries.scan_text(snip) & self.countries):
                    continue
                got = sentence_dobs(snip, snippet=True)
                if got:
                    out += got
                    self.sr_ids.append(s["result_id"])
        self.sr_ids.sort()
        return out
