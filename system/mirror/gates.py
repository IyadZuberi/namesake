"""Gates: one function per POLICY 6/7 test. Pure; facts only; no text.

Each gate returns a dict:
  gate, result (contradiction|agreement|unknown|not_applicable|blocked), blocked_by, facts, evidence
Facts that BLOCK a clear are a union of every source; an unknown never clears.
"""
import dates
import names

# LOCATION before TIME/DOB/NAME: the practice labels cite the location evidence when several gates fire
CLEAR_ORDER = ("TYPE", "DECEASED", "LOCATION", "TIME", "DOB", "NAME")
CODE_OF = {
    "TYPE": "ENTITY_TYPE_MISMATCH",
    "DECEASED": "DECEASED",
    "TIME": "TEMPORAL_IMPOSSIBILITY",
    "DOB": "DOB_MISMATCH",
    "NAME": "NAME_MISMATCH_VERIFIED",
    "LOCATION": "LOCATION_MISMATCH",
}
MIN_AGE = 16


def _gate(gate, result, facts=None, evidence=(), blocked_by=None):
    return {"gate": gate, "result": result, "blocked_by": blocked_by, "facts": facts or {}, "evidence": sorted({e for e in evidence if e})}


def _hit_ref(hit, field):
    return "%s#%s" % (hit.hit_id, field)


def type_gate(person, hit):
    if len(person.etypes) != 1 or hit.etype not in ("Individual", "Company"):
        return _gate("TYPE", "unknown")
    facts = {"customer": person.etypes[0], "hit": hit.etype}
    if person.etypes[0] != hit.etype:
        return _gate("TYPE", "contradiction", facts, person.record_ids)
    return _gate("TYPE", "agreement", facts)


def deceased_gate(hit, screened):
    if hit.death is None or screened is None:
        return _gate("DECEASED", "unknown", {"no_date": hit.deceased_no_date})
    facts = {"death": dates.iso(hit.death), "screened": dates.iso(screened)}
    if dates.latest_possible(hit.death) < (screened.y, screened.m, screened.d):
        return _gate("DECEASED", "contradiction", facts, [_hit_ref(hit, "deceased_date")])
    return _gate("DECEASED", "not_applicable", facts)


def time_gate(person, hit):
    rep = hit.first_report
    if rep is None or person.dob is None:
        return _gate("TIME", "unknown")
    every = [person.dob] + [d for d, _ in person.dob_alts]  # a single DOB allowing the report blocks the clear
    if person.is_company:
        facts = {"incorporated": dates.iso(person.dob), "report": dates.iso(rep)}
        if all(dates.earliest_possible(d) > (rep.y, rep.m, rep.d) for d in every):
            return _gate("TIME", "contradiction", facts, [person.dob_source])
        return _gate("TIME", "not_applicable", facts)
    ages = [dates.max_age_at(d, rep) for d in every]
    facts = {"dob": dates.iso(person.dob), "report": dates.iso(rep), "max_age": ages[0]}
    if all(a < MIN_AGE for a in ages):
        return _gate("TIME", "contradiction", facts, [person.dob_source])
    return _gate("TIME", "not_applicable", facts)


def dob_agreement(person, hit):
    return dates.any_agree(person.dob, hit.dobs)


def dob_gate(person, hit):
    if person.dob is None or not hit.dobs:
        return _gate("DOB", "unknown", {"hit_source": hit.dob_source})
    years = sorted({d.y for d in hit.dobs})
    facts = {"customer_dob": dates.iso(person.dob), "dob_source": person.dob_source,
             "hit_years": years, "hit_dobs": sorted({dates.iso(d) for d in hit.dobs}), "hit_source": hit.dob_source, "sr_ids": list(hit.sr_ids), "hit_has_full": any(dates.is_full(d) for d in hit.dobs)}
    cite = [person.dob_source] + (hit.sr_ids if hit.dob_source == "search_result" else [])
    if dates.any_agree(person.dob, hit.dobs):
        return _gate("DOB", "agreement", facts, cite)
    if not dates.all_contradicted(person.dob, hit.dobs):
        return _gate("DOB", "unknown", facts)
    for alt, src in person.dob_alts:
        if not dates.all_contradicted(alt, hit.dobs):
            return _gate("DOB", "blocked", facts, cite, "another customer date of birth is not contradicted")
    if dates.any_agree(person.dob, hit.other_dobs):
        return _gate("DOB", "blocked", facts, cite, "another source of the hit's birth date agrees")
    return _gate("DOB", "contradiction", facts, cite)


def customer_name_parts(person, data):
    out = []
    for name, _ in person.names:
        p = names.parts(name, person.is_company, data.legal)
        if p:
            out.append(p)
    return out


def name_agreement(person, hit, data):
    """Name agrees (names list = verified name if there is one, else record names)."""
    cps = customer_name_parts(person, data)
    if not person.is_company and not any(len(p) >= 2 for p in cps):
        return False  # fewer than two real parts: neither confirm nor clear on name
    return any(names.agree(cp, hp, data.pairs) for cp in cps for _, hp in hit.names)


def name_gate(person, hit, data):
    if "name_variants" in getattr(data, "missing", ()):
        return _gate("NAME", "unknown", {"missing": "name_variants.json"})
    ver = person.ver
    if person.is_company or hit.company or ver is None or not ver.name or not hit.names:
        return _gate("NAME", "not_applicable" if person.is_company else "unknown")
    vp = names.parts(ver.name, False, data.legal)
    if len(vp) < 2:
        return _gate("NAME", "unknown", {"verified_source": ver.source_id})
    facts = {"verified_source": ver.source_id, "hit_names": len(hit.names)}
    if any(names.agree(vp, hp, data.pairs, True) for _, hp in hit.names):
        return _gate("NAME", "agreement", facts, [ver.source_id])
    for nm, src in person.alt_ver_names:
        ap = names.parts(nm, False, data.legal)
        if any(names.agree(ap, hp, data.pairs, True) for _, hp in hit.names):
            return _gate("NAME", "blocked", facts, [ver.source_id], "an older approved check agrees with a hit name")
    return _gate("NAME", "contradiction", facts, [ver.source_id])


def location_gate(person, hit, name_dob_agree, missing=frozenset()):
    mine = sorted(person.countries)
    theirs = sorted(hit.countries)
    if not mine or not theirs or hit.countries_unparsed or "notes" in missing:
        return _gate("LOCATION", "unknown", {"customer": mine, "hit": theirs})
    facts = {"customer": mine, "hit": theirs}
    if set(mine) & set(theirs):
        return _gate("LOCATION", "agreement", facts)
    if person.country_unparsed or getattr(person, "place_unparsed", False):
        # some customer place could not be read: the countries we did read may only block, never clear
        facts["unread_place"] = True
        if name_dob_agree:
            return _gate("LOCATION", "blocked", facts, [], "name and date of birth agree")
        return _gate("LOCATION", "unknown", facts)
    cite = list(person.record_ids)
    for code in mine:
        for kind, src in person.countries[code]:
            if src and kind != "screened":
                cite.append(src)
    if name_dob_agree:
        return _gate("LOCATION", "blocked", facts, cite, "name and date of birth agree")
    return _gate("LOCATION", "contradiction", facts, cite)


def evaluate(person, hit, screened, data):
    """-> (decision, code, gates, evidence, extra)"""
    g = {}
    g["TYPE"] = type_gate(person, hit)
    g["DECEASED"] = deceased_gate(hit, screened)
    g["TIME"] = time_gate(person, hit)
    g["DOB"] = dob_gate(person, hit)
    g["NAME"] = name_gate(person, hit, data)
    name_ok = name_agreement(person, hit, data)
    dob_ok = dob_agreement(person, hit)
    missing = getattr(data, "missing", frozenset())
    nv_missing = "name_variants" in missing  # names might agree through a variant we cannot see: block, never clear
    g["LOCATION"] = location_gate(person, hit, (name_ok or nv_missing) and dob_ok, missing)
    country_ok = bool(set(person.countries) & hit.countries) and not hit.countries_unparsed
    agreement = {"name": name_ok, "dob": dob_ok, "country": country_ok}
    g["AGREEMENT"] = _gate("AGREEMENT", "agreement" if name_ok and dob_ok else "unknown", agreement)
    gates = [g[k] for k in CLEAR_ORDER] + [g["AGREEMENT"]]

    for k in CLEAR_ORDER:
        if g[k]["result"] == "contradiction":
            return "DIFFERENT_ENTITY", CODE_OF[k], gates, g[k]["evidence"], {"fired": k, "agreement": agreement}
    same_type = len(person.etypes) == 1 and hit.etype == person.etypes[0]
    if g["LOCATION"]["result"] == "blocked":  # name and DOB agree but countries differ: REVIEW (POLICY 6)
        return "REVIEW", "INSUFFICIENT_DATA", gates, _looked_at(person, hit), {"agreement": agreement, "blocked": ["LOCATION"]}
    if same_type and person.is_company and name_ok and country_ok:
        ev = list(person.record_ids) + _ver_ids(person)
        return "SAME_ENTITY", "NAME_LOCATION_MATCH", gates, sorted(set(ev)), {"agreement": agreement}
    if same_type and not person.is_company and name_ok and dob_ok:
        ev = list(person.record_ids) + [person.dob_source] + (hit.sr_ids if hit.dob_source == "search_result" else [])
        ev += _ver_ids(person)
        code = "NAME_DOB_LOCATION_MATCH" if country_ok else "NAME_DOB_MATCH"
        return "SAME_ENTITY", code, gates, sorted(set(ev)), {"agreement": agreement}
    blocked = [k for k in CLEAR_ORDER if g[k]["result"] == "blocked"]
    return "REVIEW", "INSUFFICIENT_DATA", gates, _looked_at(person, hit), {"agreement": agreement, "blocked": blocked}


def _looked_at(person, hit):
    """Evidence for a REVIEW: the customer records and verified sources the checks drew on."""
    out = list(person.record_ids) + _ver_ids(person) + list(person.lived_notes)
    return out + (hit.sr_ids if hit.dob_source == "search_result" else [])


def _ver_ids(person):
    """KYC/NOTE ids that gave the name / country facts of a SAME decision."""
    out = []
    if person.ver is not None:
        out.append(person.ver.source_id)
    return out
