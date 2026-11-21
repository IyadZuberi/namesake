"""Read the data folder and build lookup indexes. Standard library only; utf-8 everywhere."""
import json
import os
from collections import defaultdict

import names


def read_jsonl(path):
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                yield json.loads(line)


def read_hits(data_dir):
    """Just hits.jsonl (used by the fatal-error fallback in main)."""
    return sorted(read_jsonl(os.path.join(data_dir, "hits.jsonl")), key=lambda h: h["hit_id"])


class Data:
    """All files plus the indexes the engine needs. Lists inside indexes are sorted (determinism)."""

    def __init__(self, data_dir):
        self.missing = set()  # optional files that were absent: treated as empty, never as a reason to clear

        def table(name, optional=False):
            path = os.path.join(data_dir, name + ".jsonl")
            if optional and not os.path.exists(path):
                self.missing.add(name)
                return []
            return list(read_jsonl(path))

        self.hits = sorted(table("hits"), key=lambda h: h["hit_id"])
        self.alerts = {a["alert_id"]: a for a in table("alerts")}
        customers = table("customers")
        self.customers = {c["record_id"]: c for c in customers}
        self.search_results = sorted(table("search_results", True), key=lambda s: s["result_id"])

        nv_path = os.path.join(data_dir, "name_variants.json")
        if os.path.exists(nv_path):
            with open(nv_path, encoding="utf-8") as handle:
                nv = json.load(handle)
        else:  # without the variant list a name could look different when it is not: no clear on name
            self.missing.add("name_variants")
            nv = {}
        nv.setdefault("groups", [])
        nv.setdefault("company_legal_forms", [])
        self.pairs = names.variant_pairs(nv["groups"])
        self.legal = frozenset(x.lower() for x in nv["company_legal_forms"])

        acc = defaultdict(set)
        login = defaultdict(set)
        for a in table("accounts", True):
            acc[a["account_id"]].add(a["customer_id"])
            if a.get("login_handle"):
                login[a["login_handle"]].add(a["customer_id"])
        self.by_account = {k: sorted(v) for k, v in acc.items()}
        self.by_login = {k: sorted(v) for k, v in login.items()}

        email = defaultdict(set)
        for c in customers:
            if c.get("email"):
                email[c["email"].strip().lower()].add(c["record_id"])
        self.by_email = {k: sorted(v) for k, v in email.items()}

        apps = defaultdict(set)      # customer -> applicant ids
        app_cus = defaultdict(set)   # applicant -> customer ids
        for o in table("onboarding", True):
            apps[o["customer_id"]].add(o["kyc_applicant_id"])
            app_cus[o["kyc_applicant_id"]].add(o["customer_id"])
        self.applicants_of = {k: sorted(v) for k, v in apps.items()}
        self.customers_of_applicant = {k: sorted(v) for k, v in app_cus.items()}

        checks = defaultdict(list)
        for k in sorted(table("kyc_checks", True), key=lambda k: k["check_id"]):
            checks[k["applicant_id"]].append(k)
        self.checks_of = dict(checks)

        notes = defaultdict(list)
        for n in sorted(table("notes", True), key=lambda n: n["note_id"]):
            if n.get("requester_email"):
                notes[n["requester_email"].strip().lower()].append(n)
        self.notes_of = dict(notes)
