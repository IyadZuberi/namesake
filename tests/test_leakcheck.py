import contextlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))
import leakcheck

NAME = "Zorbo Quillfeather"   # invented
ALIAS = "Mirta Dunwoody"      # invented


def put(root, rel, text):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


class LeakcheckTest(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory()
        self.data = os.path.join(self.t.name, "data")
        self.repo = os.path.join(self.t.name, "repo")
        os.makedirs(self.repo)
        put(self.data, "customers.jsonl", json.dumps({"record_id": "CUS-123456", "full_name": NAME, "preferred_name": "Zo"}) + "\n")
        put(self.data, "hits.jsonl",
            json.dumps({"hit_id": "H-ABCDEF", "alert_id": "A-ABCDEF", "name": "Doe, J", "aliases": [ALIAS]}) + "\n"
            + json.dumps({"hit_id": "H-FEDCBA", "alert_id": "A-FEDCBA", "name": "Roe, K", "aliases": []}) + "\n")
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)

    def tearDown(self):
        self.t.cleanup()

    def track(self, files):
        for rel, text in files.items():
            put(self.repo, rel, text)
        subprocess.run(["git", "add", "-A"], cwd=self.repo, check=True)

    def test_clean_repo_passes_and_allowlist_works(self):
        self.track({"README.md": "hello H-1 and CUS-1 are fake", "output/dev.jsonl": f"{NAME} H-ABCDEF CUS-123456"})
        self.assertEqual(leakcheck.scan(self.data, self.repo), {})

    def test_leaks_found_by_name_id_and_never_printed(self):
        self.track({"a.txt": f"see {NAME.upper()} here", "b.txt": "ids H-ABCDEF A-ABCDEF H-FEDCBA", "c.txt": ALIAS,
                    "ok.txt": "nothing; Zo, CUS-123456 and H-ABCDEF alone are not a dump"})
        self.assertEqual(leakcheck.scan(self.data, self.repo),
                         {"a.txt": {"names": 1, "ids": 0}, "b.txt": {"names": 0, "ids": 3}, "c.txt": {"names": 1, "ids": 0}})
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = leakcheck.main(["--data", self.data, "--repo", self.repo])
        self.assertEqual(rc, 1)
        for secret in (NAME, NAME.upper(), ALIAS, "CUS-123456"):
            self.assertNotIn(secret, buf.getvalue())
        self.assertIn("LEAK a.txt", buf.getvalue())

    def test_bad_data_dir(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(leakcheck.main(["--data", os.path.join(self.t.name, "nope"), "--repo", self.repo]), 2)


if __name__ == "__main__":
    unittest.main()
