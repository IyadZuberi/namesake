"""The always-safe answer for a hit the engine could not process."""


def fallback_line(hit):
    return {
        "hit_id": hit["hit_id"],
        "alert_id": hit["alert_id"],
        "decision": "REVIEW",
        "reason_code": "INSUFFICIENT_DATA",
        "customer_record_id": None,
        "reason": "The engine could not complete the checks for this hit, so it is left for a person. "
                  "Nothing was cleared or confirmed. Re-running with the full data folder would settle it.",
        "evidence": [],
    }
