"""Customer side: who is the customer? (POLICY 2, 3, 4)

Resolver(data).resolve(alert) -> Resolution(via, persons, ...)
A Person is one real human: a cluster of records joined by (phone + full parsed DOB) or by the
same document number on approved checks (transitive, union-find on PARSED dates).
"""
import re
from collections import defaultdict

import countries
import dates
import names

FAILURE_RX = re.compile(r"reject|fail|declin|expire|unsuccess|denied|refus|not (?:approved|verified|passed)|could not", re.I)
# an approved check must SAY it passed: a note with no positive outcome (pending, awaiting, on hold,
# inconclusive...) is not evidence (POLICY 4: only approved checks count)
SUCCESS_RX = re.compile(r"\b(?:verifi\w*|success\w*|confirm\w*|clear(?:ed|s)?|pass(?:ed|es)?|approv\w*|complet\w*|"
                        r"validat\w*|match(?:ed|es)?|processed|accepted|authenticat\w*)\b", re.I)
TOKEN_RX = re.compile(r"[^\s,;:()\"]+")
BORN_CUE_RX = re.compile(r"(?:DOB|date of birth|born|birth)\D{0,30}$", re.I)
BORN_YEAR_RX = re.compile(r"(?:DOB|born|birth)\D{0,25}(\d{4})\b", re.I)
# a non-KYC note that talks about living or working somewhere: if no country can be read from it,
# the customer's places are not fully known, so the location rule may not clear (POLICY 6, unknown stays unknown)
LIVED_RX = re.compile(r"\b(?:liv(?:e|ed|es|ing)|moved|mov(?:e|es|ing) (?:to|from)|relocat\w*|resid\w*|domicil\w*|settled|"
                      r"based (?:in|at|out)|grew up|raised in|stay(?:ed|ing) in|work(?:ed|s|ing)? (?:in|abroad)|"
                      r"employ\w* (?:in|abroad)|home (?:in|country|town)|from (?:abroad|overseas)|emigrat\w*|immigrat\w*)\b", re.I)
STOP_CAPS = {"DOB", "ID", "KYC", "UK", "US", "USA", "UAE", "OK"}


class Fact:
    """One verified identity source: an approved KYC check or a KYC-channel note."""

    def __init__(self, source_id, how, when, name, dob, countries_):
        self.source_id = source_id
        self.how = how                  # 'kyc_check' | 'kyc_note'
        self.when = when                # sortable tuple
        self.name = name
        self.dob = dob
        self.countries = countries_     # sorted list of alpha-2 codes (document country)


class Person:
    def __init__(self):
        self.record_ids = []
        self.linked_ids = []
        self.merged_by = "none"
        self.etypes = []
        self.ver = None                 # best Fact (latest approved)
        self.ver_all = []               # every approved Fact, newest first
        self.dob = None                 # PDate used for agreement
        self.dob_source = None          # id that gave it
        self.dob_alts = []              # [(PDate, source_id)] other known DOBs (blocking only)
        self.names = []                 # [(name, source_id)] used for agreement
        self.alt_ver_names = []         # [(name, source_id)] older approved verified names (blocking)
        self.countries = {}             # code -> [(kind, source_id)]
        self.country_unparsed = False
        self.place_unparsed = False     # a note mentions living/working somewhere we could not read as a country
        self.lived_notes = []
        self.is_company = False
        self.dob_conflict = False
        self.record_names = []

    @property
    def rid(self):
        """Record id reported as customer_record_id: the smallest linked record, else the smallest."""
        return (self.linked_ids or self.record_ids)[0]


class Resolution:
    def __init__(self, via, persons, note=""):
        self.via = via
        self.persons = persons
        self.note = note


def _when(text):
    p = dates.parse(text)
    return (p.y, p.m or 0, p.d or 0) if p else (0, 0, 0)


def parse_kyc_note(note):
    """-> dict(ok, name, dob, countries) from a KYC-channel note; structure, not templates."""
    text = note.get("text") or ""
    created = dates.parse(note.get("created_at"))
    found = []
    spans = []
    for rx in (dates.SCAN_RX, dates.SCAN_PARTIAL_RX):
        for m in rx.finditer(text):
            if any(a < m.end() and m.start() < b for a, b in spans):
                continue
            spans.append((m.start(), m.end()))
            p = dates.parse(m.group(0))
            if p and p != created:
                found.append((m.start(), p))
    found.sort()
    distinct = []
    for _, p in found:
        if p not in distinct:
            distinct.append(p)
    dob = distinct[0] if len(distinct) == 1 else None
    if len(distinct) > 1:
        cued = []
        for start, p in found:
            if BORN_CUE_RX.search(text[max(0, start - 40):start]) and p not in cued:
                cued.append(p)
        dob = cued[0] if len(cued) == 1 else None
    if not found:
        m = BORN_YEAR_RX.search(text)
        if m:
            dob = dates.parse(m.group(1))
    runs = []
    run, last_end = [], -1
    for m in list(TOKEN_RX.finditer(text)) + [None]:
        tok = m.group(0).strip(".'’-") if m else ""
        if m and tok.isupper() and len(tok) >= 2 and tok not in STOP_CAPS and (not run or m.start() == last_end + 1):
            run.append(tok)
        else:
            if len(run) >= 2 and " ".join(run) not in runs:
                runs.append(" ".join(run))
            run = [tok] if m and tok.isupper() and len(tok) >= 2 and tok not in STOP_CAPS else []
        last_end = m.end() if m else last_end
    return {
        "ok": bool(SUCCESS_RX.search(text)) and not FAILURE_RX.search(text),
        "name": runs[0] if len(runs) == 1 else None,
        "dob": dob,
        "countries": sorted(countries.scan_text(text, codes=False)),
    }


class Resolver:
    def __init__(self, data):
        self.d = data
        self.dob_of = {rid: dates.parse(c.get("dob")) for rid, c in data.customers.items()}
        self._cluster()
        self._indexes = None

    # ---- clusters -------------------------------------------------------------------------
    def _cluster(self):
        parent = {}
        kinds = defaultdict(set)

        def find(x):
            while parent.get(x, x) != x:
                parent[x] = parent.get(parent[x], parent[x])
                x = parent[x]
            return x

        def union(a, b, kind):
            ra, rb = find(a), find(b)
            if ra == rb:
                kinds[ra].add(kind)
                return
            lo, hi = (ra, rb) if ra < rb else (rb, ra)
            parent[hi] = lo
            kinds[lo] |= kinds.pop(hi, set()) | {kind}

        by_phone = defaultdict(list)
        for rid in sorted(self.d.customers):
            c = self.d.customers[rid]
            digits = re.sub(r"\D", "", c.get("phone") or "")
            if digits and dates.is_full(self.dob_of[rid]):
                by_phone[(digits, self.dob_of[rid])].append(rid)
        for key in sorted(by_phone):
            ids = by_phone[key]
            for other in ids[1:]:
                union(ids[0], other, "phone+dob")
        by_doc = defaultdict(set)
        for applicant in sorted(self.d.checks_of):
            for k in self.d.checks_of[applicant]:
                num = (k.get("document_number") or "").strip().upper()
                if k.get("result") == "approved" and num:
                    for rid in self.d.customers_of_applicant.get(applicant, []):
                        by_doc[num].add(rid)
        for num in sorted(by_doc):
            ids = sorted(by_doc[num])
            for other in ids[1:]:
                union(ids[0], other, "document")
        self.root = {rid: find(rid) for rid in self.d.customers}
        members = defaultdict(list)
        for rid in sorted(self.d.customers):
            members[self.root[rid]].append(rid)
        self.members = dict(members)
        self.merge_kinds = {r: "+".join(sorted(k)) for r, k in kinds.items()}

    # ---- person facts ---------------------------------------------------------------------
    def person(self, root, linked):
        d = self.d
        p = Person()
        p.record_ids = list(self.members[root])
        p.linked_ids = sorted(set(linked) & set(p.record_ids))
        p.merged_by = self.merge_kinds.get(root, "none") if len(p.record_ids) > 1 else "none"
        rows = [d.customers[r] for r in p.record_ids]
        p.etypes = sorted({r.get("entity_type") for r in rows if r.get("entity_type")})
        p.is_company = p.etypes == ["Company"]

        facts = []
        seen_notes = set()
        for r in rows:
            for app in d.applicants_of.get(r["record_id"], []):
                for k in d.checks_of.get(app, []):
                    if k.get("result") == "approved":
                        nm = k.get("verified_name")
                        facts.append(Fact(k["check_id"], "kyc_check", _when(k.get("checked_at")), nm if names.parts(nm) else None,
                                          dates.parse(k.get("verified_dob")),
                                          [c for c in [countries.parse_country(k.get("document_country"))] if c]))
                        if k.get("document_country") and not countries.parse_country(k["document_country"]):
                            p.country_unparsed = True
            email = (r.get("email") or "").strip().lower()
            for n in d.notes_of.get(email, []):
                if n["note_id"] in seen_notes:
                    continue
                seen_notes.add(n["note_id"])
                if n.get("channel") == "kyc":
                    info = parse_kyc_note(n)
                    if info["ok"]:
                        facts.append(Fact(n["note_id"], "kyc_note", _when(n.get("created_at")), info["name"], info["dob"], info["countries"]))
                else:
                    found = countries.scan_text(n.get("text"))
                    if not found and LIVED_RX.search(n.get("text") or ""):
                        p.place_unparsed = True
                        p.lived_notes.append(n["note_id"])
                    if found:
                        p.lived_notes.append(n["note_id"])
                        for code in sorted(found):
                            p.countries.setdefault(code, []).append(("note_lived", n["note_id"]))
        # newest first; ties: kyc_check before note, then smallest id
        facts.sort(key=lambda f: f.source_id)
        facts.sort(key=lambda f: (f.when, f.how == "kyc_check"), reverse=True)
        p.ver_all = facts
        p.ver = facts[0] if facts else None
        for f in facts:
            for code in f.countries:
                p.countries.setdefault(code, []).append(("document", f.source_id))

        for r in rows:
            for fld, kind in (("residence_country", "residence"), ("nationality", "nationality")):
                raw = r.get(fld)
                if not raw:
                    continue
                code = countries.parse_place(raw)
                if code:
                    p.countries.setdefault(code, []).append((kind, r["record_id"]))
                else:
                    p.country_unparsed = True

        # DOB: newest approved verified DOB wins; else the one DOB the records agree on
        rec_dobs = [(self.dob_of[r], r) for r in p.record_ids if self.dob_of[r]]
        with_dob = [f for f in facts if f.dob]
        if with_dob:
            p.dob, p.dob_source = with_dob[0].dob, with_dob[0].source_id
        elif rec_dobs and len({x[0] for x in rec_dobs}) == 1:
            p.dob, p.dob_source = rec_dobs[0]
        for f in with_dob[1:]:
            p.dob_alts.append((f.dob, f.source_id))
        for dob, rid in rec_dobs:
            p.dob_alts.append((dob, rid))
        if p.dob is None and len({x[0] for x in rec_dobs}) > 1:
            p.dob_conflict = True

        # names: the verified legal name outranks record names
        named = [f for f in facts if f.name]
        if named:
            p.names = [(named[0].name, named[0].source_id)]
            p.alt_ver_names = [(f.name, f.source_id) for f in named[1:]]
        else:
            for r in rows:
                for fld in ("full_name", "preferred_name", "login_name"):
                    if r.get(fld):
                        p.names.append((r[fld], r["record_id"]))
        p.record_names = [(r[f], r["record_id"]) for r in rows for f in ("full_name", "preferred_name", "login_name") if r.get(f)]
        return p

    # ---- finding the records --------------------------------------------------------------
    def _search_indexes(self):
        if self._indexes is None:
            by_year, no_dob = defaultdict(list), []
            for rid in sorted(self.d.customers):
                dob = self.dob_of[rid]
                (by_year[dob.y] if dob else no_dob).append(rid)
            self._indexes = (by_year, no_dob)
        return self._indexes

    def fits(self, scr, rid):
        """Does record `rid` fit what was screened (POLICY 2)? Unknown screened fields do not filter."""
        d = self.d
        c = d.customers[rid]
        if scr.get("entity_type") and c.get("entity_type") and scr["entity_type"] != c["entity_type"]:
            return False
        sd = dates.parse(scr.get("dob"))
        cd = self.dob_of[rid]
        if sd and cd and not dates.agree(cd, sd):
            return False
        code = countries.parse_place(scr.get("country")) if scr.get("country") else None
        if code:
            have = {countries.parse_place(c.get("residence_country")), countries.parse_place(c.get("nationality"))}
            if code not in have:
                return False
        if scr.get("city"):
            hay = countries.norm((c.get("city") or "") + " " + (c.get("address") or ""))
            if countries.norm(scr["city"]) not in hay:
                return False
        company = scr.get("entity_type") == "Company"
        want = names.parts(scr.get("name"), company, d.legal)
        if want:
            if not any(names.agree(want, names.parts(c.get(f), company, d.legal), d.pairs, True)
                       for f in ("full_name", "preferred_name", "login_name") if c.get(f)):
                return False
        return True

    def resolve(self, alert):
        d = self.d
        scr = alert.get("customer") or {}
        via, cands = "none", []
        for key, table, label in (("account_ref", d.by_account, "account_ref"),
                                  ("login_handle", d.by_login, "login_handle"),
                                  ("email", d.by_email, "email")):
            val = alert.get(key)
            if val:
                found = table.get(val.strip().lower() if key == "email" else val, [])
                if found:
                    via, cands = label, list(found)
                    break
        if via == "none":
            by_year, no_dob = self._search_indexes()
            sd = dates.parse(scr.get("dob"))
            pool = by_year.get(sd.y, []) + no_dob if sd else sorted(d.customers)
            cands = [r for r in pool if self.fits(scr, r)]
            via = "fit_search"
        elif len(cands) > 1:
            cands = [r for r in cands if self.fits(scr, r)]
        roots = sorted({self.root[r] for r in cands})
        persons = [self.person(root, cands) for root in roots]
        screened = countries.parse_place(scr.get("country")) if scr.get("country") else None
        for p in persons:  # blocking only: the screened country counts as a place tied to the customer
            if screened:
                p.countries.setdefault(screened, []).append(("screened", ""))
        return Resolution(via, persons)
