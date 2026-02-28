"""
threat_level.py — Compute a DEFCON-style threat level from classified attack articles.

Levels:
  5 - LOW (Green)      : 0-1 low-severity incidents in 24h
  4 - GUARDED (Blue)   : 2-5 low/medium incidents
  3 - ELEVATED (Yellow) : Any high-severity OR >5 medium
  2 - HIGH (Orange)    : Multiple high-severity OR any major
  1 - MAJOR (Red)      : Multiple major incidents, active large-scale conflict
"""

import json
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# Severity weights
SEVERITY_WEIGHTS = {
    "major": 10,
    "critical": 10,   # LLM sometimes returns "critical"; treat as "major"
    "high": 5,
    "medium": 2,
    "low": 1,
}

# Threat level thresholds (cumulative score over 24h)
THREAT_LEVELS = [
    {"level": 1, "label": "MAJOR",    "color": "#DC2626", "min_score": 30},
    {"level": 2, "label": "HIGH",     "color": "#EA580C", "min_score": 15},
    {"level": 3, "label": "ELEVATED", "color": "#CA8A04", "min_score": 6},
    {"level": 4, "label": "GUARDED",  "color": "#2563EB", "min_score": 2},
    {"level": 5, "label": "LOW",      "color": "#16A34A", "min_score": 0},
]


def compute_threat_score(attack_articles: list[dict], hours: int = 24) -> dict:
    """
    Compute threat score from attack articles within the given time window.

    Returns:
        Dict with score, level, label, color, incident counts
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Filter to recent articles
    recent = []
    for article in attack_articles:
        try:
            pub_str = article.get("published", "")
            if pub_str:
                pub_dt = datetime.fromisoformat(pub_str)
                if pub_dt.tzinfo is None:
                    pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                if pub_dt >= cutoff:
                    recent.append(article)
            else:
                # If no date, include it (could be recent)
                recent.append(article)
        except (ValueError, TypeError):
            recent.append(article)

    # Calculate score
    total_score = 0
    severity_counts = {"major": 0, "high": 0, "medium": 0, "low": 0}

    for article in recent:
        severity = article.get("classification", {}).get("severity", "low")
        weight = SEVERITY_WEIGHTS.get(severity, 1)
        total_score += weight
        severity_counts[severity] = severity_counts.get(severity, 0) + 1

    # Determine threat level
    current_level = THREAT_LEVELS[-1]  # Default: LOW
    for level in THREAT_LEVELS:
        if total_score >= level["min_score"]:
            current_level = level
            break

    return {
        "score": total_score,
        "level": current_level["level"],
        "label": current_level["label"],
        "color": current_level["color"],
        "incident_count": len(recent),
        "severity_breakdown": severity_counts,
        "window_hours": hours,
    }


def compute_and_save_threat_level(
    attack_articles: list[dict],
    output_path: str,
) -> dict:
    """
    Compute current threat level and maintain 7-day history.

    Args:
        attack_articles: List of classified attack articles
        output_path: Path to threat_level.json

    Returns:
        Full threat level data with history
    """
    # Load existing data for history
    existing = {}
    try:
        with open(output_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        existing = {"current": {}, "history": []}

    # Compute current threat level
    current = compute_threat_score(attack_articles, hours=24)
    current["computed_at"] = datetime.now(timezone.utc).isoformat()

    # Also compute 6h and 48h windows for context
    short_term = compute_threat_score(attack_articles, hours=6)
    medium_term = compute_threat_score(attack_articles, hours=48)

    # Build history entry
    history_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": current["level"],
        "label": current["label"],
        "score": current["score"],
        "incident_count": current["incident_count"],
    }

    # Append to history, keep last 7 days (~672 entries at 15-min intervals)
    history = existing.get("history", [])
    history.append(history_entry)

    # Prune history older than 7 days
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    history = [
        h for h in history
        if datetime.fromisoformat(h["timestamp"]).replace(tzinfo=timezone.utc) >= cutoff
    ]

    # Compute trend
    trend = "stable"
    if len(history) >= 4:
        recent_scores = [h["score"] for h in history[-4:]]
        older_scores = [h["score"] for h in history[-8:-4]] if len(history) >= 8 else [0]
        avg_recent = sum(recent_scores) / len(recent_scores)
        avg_older = sum(older_scores) / len(older_scores)
        if avg_recent > avg_older * 1.5:
            trend = "escalating"
        elif avg_recent < avg_older * 0.5:
            trend = "de-escalating"

    result = {
        "current": current,
        "short_term_6h": {
            "score": short_term["score"],
            "level": short_term["level"],
            "label": short_term["label"],
            "incident_count": short_term["incident_count"],
        },
        "medium_term_48h": {
            "score": medium_term["score"],
            "level": medium_term["level"],
            "label": medium_term["label"],
            "incident_count": medium_term["incident_count"],
        },
        "trend": trend,
        "history": history,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Save
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    logger.info(
        f"Threat level: {current['label']} (Level {current['level']}, "
        f"Score {current['score']}, {current['incident_count']} incidents, "
        f"Trend: {trend})"
    )

    return result
