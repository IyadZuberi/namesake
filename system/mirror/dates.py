"""Partial dates and the POLICY 6/7 comparisons.

PDate(y, m, d): m and d may be None (partial). All slash dates are DD/MM/YYYY.
Supported: YYYY-MM-DD, DD/MM/YYYY, '19 May 2004', 'May 19, 2004', YYYY, YYYY-MM, 'Month YYYY'.
"""
import re
from collections import namedtuple
from datetime import date

PDate = namedtuple("PDate", "y m d")

_MONTHS = {}
for _i, _name in enumerate("january february march april may june july august september october november december".split(), 1):
    _MONTHS[_name] = _i
    _MONTHS[_name[:3]] = _i
_MONTHS["sept"] = 9

_MON = r"(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\.?"
_FORMS = [
    ("iso", re.compile(r"(\d{4})-(\d{2})-(\d{2})")),
    ("ym", re.compile(r"(\d{4})-(\d{2})")),
    ("dmy", re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})")),
    ("d_mon_y", re.compile(r"(\d{1,2}) (%s) (\d{4})" % _MON, re.I)),
    ("mon_d_y", re.compile(r"(%s) (\d{1,2}),? (\d{4})" % _MON, re.I)),
    ("mon_y", re.compile(r"(%s),? (\d{4})" % _MON, re.I)),
    ("y", re.compile(r"(\d{4})")),
]
# one scanner for free text; longest forms first so a full date is never read as its prefix
SCAN_RX = re.compile(
    r"(?<![\d/-])(?:\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}/\d{4}|\d{1,2} %s \d{4}|%s \d{1,2},? \d{4})(?![\d/-])" % (_MON, _MON),
    re.I,
)
SCAN_PARTIAL_RX = re.compile(r"(?<![\d/-])(?:%s,? \d{4}|\d{4}-\d{2})(?![\d/-])" % _MON, re.I)


def _mk(y, m, d):
    """Validated PDate or None."""
    if not (1000 <= y <= 2999):
        return None
    if m is not None and not 1 <= m <= 12:
        return None
    if d is not None:
        if m is None or not 1 <= d <= 31:
            return None
        try:
            date(y, m, d)
        except ValueError:
            return None
    return PDate(y, m, d)


def parse(text):
    """Parse one date string -> PDate or None. Never guesses."""
    if not text or not isinstance(text, str):
        return None
    s = " ".join(text.strip().split())
    for kind, rx in _FORMS:
        m = rx.fullmatch(s)
        if not m:
            continue
        g = m.groups()
        if kind == "iso":
            return _mk(int(g[0]), int(g[1]), int(g[2]))
        if kind == "ym":
            return _mk(int(g[0]), int(g[1]), None)
        if kind == "dmy":
            return _mk(int(g[2]), int(g[1]), int(g[0]))
        if kind == "d_mon_y":
            return _mk(int(g[2]), _MONTHS[g[1].lower().rstrip(".")], int(g[0]))
        if kind == "mon_d_y":
            return _mk(int(g[2]), _MONTHS[g[0].lower().rstrip(".")], int(g[1]))
        if kind == "mon_y":
            return _mk(int(g[1]), _MONTHS[g[0].lower().rstrip(".")], None)
        if kind == "y":
            return _mk(int(g[0]), None, None)
    return None


def find_all(text):
    """Every full or month-level date written in free text, in order (PDate list)."""
    out = []
    spans = []
    for rx in (SCAN_RX, SCAN_PARTIAL_RX):
        for m in rx.finditer(text or ""):
            if any(a < m.end() and m.start() < b for a, b in spans):
                continue
            spans.append((m.start(), m.end()))
            p = parse(m.group(0))
            if p:
                out.append((m.start(), p))
    return [p for _, p in sorted(out)]


def iso(p):
    if p is None:
        return None
    if p.m is None:
        return "%04d" % p.y
    if p.d is None:
        return "%04d-%02d" % (p.y, p.m)
    return "%04d-%02d-%02d" % p


def is_full(p):
    return p is not None and p.m is not None and p.d is not None


def agree(c, h):
    """POLICY 7: same year and every part both give is equal."""
    if c is None or h is None or c.y != h.y:
        return False
    if c.m is not None and h.m is not None and c.m != h.m:
        return False
    if c.d is not None and h.d is not None and c.d != h.d:
        return False
    return True


def contradict(c, h):
    """POLICY 6: year more than 1 apart, or same year and a month (or day) both give differs."""
    if c is None or h is None:
        return False
    if abs(c.y - h.y) > 1:
        return True
    if c.y != h.y:
        return False  # exactly one year apart: unknown, not a contradiction
    if c.m is not None and h.m is not None and c.m != h.m:
        return True
    if c.m is not None and h.m is not None and c.d is not None and h.d is not None and c.d != h.d:
        return True
    return False


def all_contradicted(c, hits):
    """Every date the hit gives is contradicted (needs at least one date)."""
    return bool(hits) and c is not None and all(contradict(c, h) for h in hits)


def any_agree(c, hits):
    return c is not None and any(agree(c, h) for h in hits)


def max_age_at(dob, when):
    """Largest age the person can have had at `when` (PDate), given a possibly partial dob."""
    if dob is None or when is None:
        return None
    age = when.y - dob.y
    if dob.m is not None and when.m is not None:
        if when.m < dob.m:
            age -= 1  # birthday month not reached yet
        elif when.m == dob.m and dob.d is not None and when.d is not None and when.d < dob.d:
            age -= 1
    return age


def latest_possible(p):
    """Last day this (possibly partial) date can stand for, as a full tuple."""
    if p.m is None:
        return (p.y, 12, 31)
    if p.d is None:
        nxt = date(p.y + (p.m == 12), p.m % 12 + 1, 1)
        return (p.y, p.m, (nxt.toordinal() - date(p.y, p.m, 1).toordinal()))
    return (p.y, p.m, p.d)


def earliest_possible(p):
    return (p.y, p.m or 1, p.d or 1)
