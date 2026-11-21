"""POLICY 8 name comparison. Pure functions; no I/O.

parts(name, company, legal)      distinct real name parts (lower case, accents/brackets/punctuation gone)
agree(a_parts, b_parts, pairs)   True when the names agree
Variant pairs come straight from name_variants.json groups: a pair matches only when both
parts sit in the same group (groups are NOT merged, so joe~joseph and joe~yusuf do not chain).
"""
import re
import unicodedata

PLACEHOLDERS = {"na", "n/a", "test", "unknown", "xxx", "none", "null", "nil"}


def strip_accents(text):
    text = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in text if not unicodedata.combining(ch))


def variant_pairs(groups):
    """Set of (a, b) ordered pairs, one group at a time."""
    pairs = set()
    for group in groups:
        for a in group:
            for b in group:
                pairs.add((a.lower(), b.lower()))
    return pairs


def parts(name, company=False, legal=frozenset()):
    """Distinct real parts in order of first appearance. Single letters, placeholders, digits dropped."""
    if not name or not isinstance(name, str):
        return []
    s = strip_accents(name).lower()
    s = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", s)
    s = s.replace("n/a", " ")
    s = s.replace("'", "").replace("’", "").replace("�", " ")
    out = []
    for tok in re.split(r"[^a-z0-9]+", s):
        if len(tok) < 2 or tok in PLACEHOLDERS or tok.isdigit() or re.fullmatch(r"x+", tok):
            continue
        if company and tok in legal:
            continue
        if tok not in out:
            out.append(tok)
    return out


def edit_distance(a, b, limit=3):
    """Levenshtein (insert, delete, change; no swaps). Returns limit+1 when clearly larger."""
    if abs(len(a) - len(b)) > limit:
        return limit + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def part_match(a, b, pairs):
    if a == b or (a, b) in pairs:
        return True
    shorter = min(len(a), len(b))
    if shorter < 4:
        return False
    return edit_distance(a, b) <= (1 if shorter <= 6 else 2)


def _units(p):
    """Single parts plus adjacent joined pairs (written together or apart)."""
    units = [(x, (i,)) for i, x in enumerate(p)]
    units += [(p[i] + p[i + 1], (i, i + 1)) for i in range(len(p) - 1)]
    return units


def match_info(a, b, pairs, generous=False):
    """(matches, covered_a, covered_b): greedy deterministic matching, joined forms first."""
    ua, ub = _units(a), _units(b)
    cand = []
    for x, ia in ua:
        for y, ib in ub:
            joined = (len(ia) > 1 or len(ib) > 1) and not generous
            # Written together or apart means the letters are the same once joined: no edit tolerance on joined forms.
            if (x == y or (x, y) in pairs) if joined else part_match(x, y, pairs):
                cand.append((-(len(ia) + len(ib)), 0 if x == y else 1, ia, ib))
    cand.sort()
    used_a, used_b, n = set(), set(), 0
    for _, _, ia, ib in cand:
        if used_a & set(ia) or used_b & set(ib):
            continue
        used_a |= set(ia)
        used_b |= set(ib)
        n += 1
    return n, used_a, used_b


def agree(a, b, pairs, generous=False):
    """Names agree: at least two parts match, or every part of the shorter name matches.

    generous=True also lets joined name parts match with edit tolerance. Use it only where
    agreement BLOCKS a clear (an ambiguous reading must never lead to a clear); confirmations
    stay strict.
    """
    if not a or not b:
        return False
    n, used_a, used_b = match_info(a, b, pairs, generous)
    if n >= 2:
        return True
    shorter, used = (a, used_a) if len(a) <= len(b) else (b, used_b)
    return len(used) == len(shorter)
