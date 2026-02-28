"""
reset_for_reprocess.py — Reset articles that need re-evaluation with the new Iran-US war LLM filter.
Resets:
  - Articles with translated=False (API failures)
  - Articles keyword-filtered as irrelevant (old system, may be relevant to Iran-US war)
  - Articles with "[Not relevant to monitoring topics]" summary (from previous LLM pass)
Keeps:
  - Articles with translated=True and a real English summary
"""
import json
import os

FEEDS_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'feeds')

STALE_SUMMARIES = {
    "[Filtered: not relevant to monitoring topics]",
    "[Not relevant to monitoring topics]",
    "[Not relevant to Iran–US war monitor]",
}

total_reset = 0
total_kept = 0

for fname in sorted(os.listdir(FEEDS_DIR)):
    if not fname.endswith('.json'):
        continue
    fpath = os.path.join(FEEDS_DIR, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        articles = json.load(f)

    reset_count = 0
    for a in articles:
        translated = a.get('translated')
        summary = a.get('summary_en', '')

        should_reset = (
            translated is False  # API failure
            or summary in STALE_SUMMARIES  # keyword/old LLM filtered
        )

        if should_reset:
            # Clear translation fields so pipeline re-processes them
            a.pop('translated', None)
            a.pop('title_en', None)
            a.pop('summary_en', None)
            a.pop('relevant', None)
            reset_count += 1

    total_reset += reset_count
    total_kept += len(articles) - reset_count
    print(f'{fname}: reset {reset_count}, kept {len(articles) - reset_count}')

    with open(fpath, 'w', encoding='utf-8') as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)

print(f'\nTotal reset: {total_reset}, total kept: {total_kept}')
