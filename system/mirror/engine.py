"""Pipeline: load -> resolve customer -> hit facts -> gates -> decision -> lines (hit_id order)."""
import json
import os

import customer
import decide
import hit as hitmod
import load
from fallback import fallback_line


def run(data_dir, trace_dir=None):
    data = load.Data(data_dir)
    resolver = customer.Resolver(data)
    sr_index = hitmod.build_sr_index(data.search_results)
    resolutions = {}
    lines, counts = [], {"hit_errors": 0}
    if trace_dir:
        os.makedirs(trace_dir, exist_ok=True)
    for row in data.hits:  # already sorted by hit_id
        try:
            alert = data.alerts[row["alert_id"]]
            if alert["alert_id"] not in resolutions:
                resolutions[alert["alert_id"]] = resolver.resolve(alert)
            facts = hitmod.HitFacts(row, data, sr_index)
            line, trace = decide.decide(row, alert, resolutions[alert["alert_id"]], facts, data)
        except Exception:  # a bug in one hit must not lose the others
            counts["hit_errors"] += 1
            line, trace = fallback_line(row), None
        lines.append(line)
        if trace_dir and trace:
            trace["decision"] = line
            with open(os.path.join(trace_dir, row["hit_id"] + ".json"), "w", encoding="utf-8", newline="\n") as handle:
                json.dump(trace, handle, indent=1, sort_keys=True)
    return lines, counts
