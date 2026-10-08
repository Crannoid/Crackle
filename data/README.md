# Word data

One lowercase word per line unless stated.

- `answers.txt` - candidate pool for suggestions (2,379 words): the 2,315 original Wordle answers (cfreshman's list, https://gist.github.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b) plus 64 answers the NYT has used since that are not in the original list.
- `valid-words.txt` - every word Wordle accepts as a guess plus all answers (14855 words): the tabatkins/wordle-list dictionary (https://github.com/tabatkins/wordle-list) merged with `answers.txt`. Only used as a fallback when no known answer fits the colours, because the NYT's answers are not all in `answers.txt`.
- `used.txt` - every distinct answer used from 2021-06-19 to 2026-10-07 (1,911 words).
- `past-answers.tsv` - the raw record: date, puzzle id, answer (1,937 days). Fetched 2026-10-08 from the NYT per-date endpoint `https://www.nytimes.com/svc/wordle/v2/YYYY-MM-DD.json`, past dates only.

## Notes

- The NYT now repeats answers (26 words appear twice in the record, all second uses in 2026), so a used word can still come up again.
- Today's and future answers are deliberately not included.
- Words the NYT removed from the original list cannot be detected, so `answers.txt` may still hold a few words that will never appear again.
- To refresh: fetch every date after the last one in `past-answers.tsv` up to yesterday, append to the TSV, then rebuild `used.txt` and `answers.txt` (union with the originals).
