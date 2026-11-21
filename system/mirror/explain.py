"""Reasons and evidence by TEMPLATE over gate facts. Derived facts only: years, countries, gate
names and record ids. Never verbatim note / snippet / profile text, never quotes, never names."""
import re

import countries

EVIDENCE_RX = re.compile(r"^(?:CUS-\d{6}|KYC-[0-9A-Z]+|NOTE-[0-9A-Z]+|SR-[0-9A-Z]+|H-[0-9A-F]{6}#\w+)$")
VIA_TEXT = {
    "account_ref": "through the alert's account link",
    "login_handle": "through the alert's login handle",
    "email": "through the alert's email",
    "fit_search": "by searching the system of record for the screened name, date of birth, country and city",
}
SOURCE_TEXT = {
    "dobs": "date-of-birth field",
    "first_paragraph": "profile notes",
    "search_result": "matching web search results",
}


def clean_evidence(items):
    return sorted({i for i in items if i and EVIDENCE_RX.match(i)})


def _ids(items):
    items = sorted(set(items))
    return ", ".join(items) if items else "no record"


def _countries(codes):
    return ", ".join(sorted(countries.display(c) for c in codes))


def _years(years):
    years = sorted(set(years))
    if len(years) == 1:
        return "the year %d" % years[0]
    return "the year " + ", ".join(str(y) for y in years[:-1]) + " or " + str(years[-1])


def _hit_dates(d):
    """The hit's own birth dates as given: years only when it gives only years, else the dates themselves,
    and say which part differs when the year is the same."""
    hd = d.get("hit_dobs") or []
    if not any("-" in x for x in hd):
        return "only " + _years(d["hit_years"])
    text = ("the date " if len(hd) == 1 else "the dates ") + ", ".join(hd)
    cy = (d.get("customer_dob") or "")[:4]
    if cy and any(x[:4] == cy for x in hd):
        text += ": the same year, but the %s differs" % ("month" if all(x[5:7] != (d["customer_dob"] or "")[5:7] for x in hd if x[:4] == cy and len(x) >= 7) else "day")
    return text


def _a(word):
    word = word.lower()
    return ("an " if word[0] in "aeiou" else "a ") + word


def _who(person, via):
    where = VIA_TEXT.get(via, "from the records")
    return "The customer was found %s as %s." % (where, _ids(person.record_ids))


def _gate(gates, name):
    return next(g for g in gates if g["gate"] == name)


def gate_sentence(g):
    """One short sentence per gate for the trace."""
    f = g["facts"]
    return "%s gate: %s." % (g["gate"], g["result"].replace("_", " ")) + (" Blocked: %s." % g["blocked_by"] if g.get("blocked_by") else "")


def reason(decision, code, person, hit, gates, via, extra):
    f = {g["gate"]: g["facts"] for g in gates}
    if decision == "DIFFERENT_ENTITY":
        lead = _clear_lead(code, person, hit, gates, f)
        second = _clear_second(code, person, hit, f)
        return " ".join([lead, second, _who(person, via)])
    if decision == "SAME_ENTITY":
        return _same(code, person, hit, f, via)
    return _review(person, hit, gates, f, via, extra)


def _clear_lead(code, person, hit, gates, f):
    if code == "DOB_MISMATCH":
        d = f["DOB"]
        return ("The customer's date of birth is %s (%s), but the hit's date of birth, taken from its %s%s, gives %s." %
                (d["customer_dob"], d["dob_source"], SOURCE_TEXT.get(d["hit_source"], "profile"),
                 " (%s)" % ", ".join(d["sr_ids"]) if d["hit_source"] == "search_result" and d["sr_ids"] else "", _hit_dates(d)))
    if code == "TEMPORAL_IMPOSSIBILITY":
        t = f["TIME"]
        if person.is_company:
            return ("The customer company was incorporated %s %s (%s), after the hit's earliest dated report on %s." %
                    ("on" if len(t["incorporated"]) == 10 else "in", t["incorporated"], person.dob_source, t["report"]))
        return ("The customer was born in %s (%s), so at most %d years old at the hit's earliest dated report on %s, "
                "under the minimum age of 16." % (t["dob"][:4], person.dob_source, t["max_age"], t["report"]))
    if code == "DECEASED":
        d = f["DECEASED"]
        return "The hit's profile gives a date of death of %s, before the customer was screened on %s." % (d["death"], d["screened"])
    if code == "NAME_MISMATCH_VERIFIED":
        n = f["NAME"]
        return ("The customer's verified legal name (%s) agrees with none of the hit's %d listed names and aliases." %
                (n["verified_source"], n["hit_names"]))
    if code == "ENTITY_TYPE_MISMATCH":
        t = f["TYPE"]
        return "The customer is %s but the hit is %s." % (_a(t["customer"]), _a(t["hit"]))
    loc = f["LOCATION"]
    return ("Every country tied to the customer (%s) differs from every country tied to the hit (%s)." %
            (_countries(loc["customer"]), _countries(loc["hit"])))


def _clear_second(code, person, hit, f):
    if code == "LOCATION_MISMATCH":
        return "The customer's countries come from %s; name and date of birth do not both agree with the hit, so the country difference decides." % _ids(
            [s for c in person.countries.values() for k, s in c if s and k != "screened"] + person.record_ids)
    if code == "DOB_MISMATCH":
        return "No other date of birth known for the customer, and no other source of the hit's birth date, agrees."
    if code == "TEMPORAL_IMPOSSIBILITY":
        if person.is_company:
            return "No other known incorporation date for the customer comes before that report, so the company did not yet exist."
        return "No other known date of birth for the customer allows an adult at that report."
    if code == "NAME_MISMATCH_VERIFIED":
        return "The verified name outranks the record name, and no older approved check agrees with any hit name."
    if code == "DECEASED":
        return "A person who died before the screening cannot be the living customer."
    return "Records of the same kind are never the same party."


def _same(code, person, hit, f, via):
    a = f["AGREEMENT"]
    ids = _ids(person.record_ids)
    if code == "NAME_LOCATION_MATCH":
        return ("The customer company's name agrees with a name of the hit, and both are linked to %s. "
                "Nothing in the records of %s contradicts the hit. %s" % (_countries(set(person.countries) & hit.countries), ids, _who(person, via)))
    d = f["DOB"]
    s1 = ("The customer's date of birth %s (%s) agrees with the hit's date of birth, %s, taken from its %s." %
          (d["customer_dob"], d["dob_source"], _years(d["hit_years"]), SOURCE_TEXT.get(d["hit_source"], "profile")))
    s2 = "The customer's name agrees with a name or alias of the hit."
    if code == "NAME_DOB_LOCATION_MATCH":
        s2 += " Both are linked to %s." % _countries(set(person.countries) & hit.countries)
    return " ".join([s1, s2, "No gate contradicts them. " + _who(person, via)])


def _review(person, hit, gates, f, via, extra):
    a = f["AGREEMENT"]
    known = []
    if a["name"]:
        known.append("the customer's name agrees with a name of the hit")
    if a["country"]:
        known.append("both are linked to %s" % _countries(set(person.countries) & hit.countries))
    s1 = ("Nothing contradicts the hit, but not enough agrees to confirm it: " + "; ".join(known) + "." if known
          else "Nothing contradicts the hit, and nothing agrees strongly enough to confirm it.")
    blocked = extra.get("blocked") or []
    if blocked:
        why = "; ".join("%s clear blocked (%s)" % (k, _gate(gates, k)["blocked_by"]) for k in blocked)
        s1 = "A clear was prevented: %s." % why
        if a["name"] and a["dob"]:
            s1 += " Name and date of birth agree, but the countries differ."
    gap, fix = _gap(person, hit, a, f)
    return " ".join([s1, gap + " " + fix, _who(person, via)])


def _gap(person, hit, a, f):
    if a["name"] and a["dob"]:
        return ("The countries of the customer and the hit differ, so the hit is neither cleared nor confirmed.",
                "A documented place of residence or nationality for the listed person would settle it.")
    if not hit.dobs:
        gap = "The hit gives no usable date of birth, so dates of birth cannot be compared."
        fix = "A full date of birth for the hit would settle it."
        if not a["name"]:
            gap = "The hit gives no usable date of birth and the names do not clearly agree."
        return gap, fix
    if person.dob is None:
        return ("No date of birth is known for the customer.", "A verified date of birth for the customer would settle it.")
    if not a["name"]:
        return ("The customer's name cannot be shown to agree with the hit's names (a verified full name is missing or too short).",
                "A verified full legal name for the customer would settle it.")
    if f["DOB"].get("customer_dob") and not a["dob"]:
        return ("The dates of birth neither agree nor clearly contradict (a year apart or partial).",
                "A full date of birth for the hit would settle it.")
    return ("The facts known do not settle it.", "A verified date of birth or document country would settle it.")


def no_customer(hit_row, via_note):
    return ("No customer record could be resolved for this alert (%s), so nothing could be compared with the hit. "
            "The hit is left for a person. A customer link or a record matching the screened details would settle it."
            % via_note)


def failure():
    return ("The engine could not complete the checks for this hit, so it is left for a person. "
            "Nothing was cleared or confirmed. Re-running with the full data folder would settle it.")


_LOWER_OK = {"The", "No", "Both", "A", "All", "Nothing", "Every", "Name", "Records", "Dates"}
_SENT_RX = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")


def cap_sentences(text, most=4):
    """The brief asks for two to four sentences. Merge the shortest neighbouring pair until it fits;
    nothing is dropped. Deterministic: ties go to the earliest pair."""
    parts = [p for p in _SENT_RX.split(text.strip()) if p]
    while len(parts) > most:
        i = min(range(len(parts) - 1), key=lambda k: (len(parts[k]) + len(parts[k + 1]), k))
        first, second = parts[i].rstrip(".!?"), parts[i + 1]
        word = second.split(" ", 1)[0]
        if word in _LOWER_OK:  # only plain sentence openers; names and countries keep their capitals
            second = word.lower() + second[len(word):]
        parts[i:i + 2] = [first + "; " + second]
    return " ".join(parts)
