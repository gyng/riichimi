# Visual checkpoints

These browser captures are committed evidence from the critical mobile-width dogfood journey. They are regenerated only after the corresponding flow has passed its assertions; filenames retain the checkpoint date and sequence.

The source journeys live in `e2e/polished-journeys.spec.ts` and cover the landing page, rules-profile persistence, scored manual hands at mobile and desktop sizes, score-history persistence, gallery-photo review when camera access is unavailable, and a locally persisted table changed through WebMCP. The table journey also posts a successfully scored hand, verifies its transfers and dealer repeat, and captures the resulting ledger.

Checkpoints 11–13 use the V1 recognizer against a generated guided-hand composite derived from a source-separated physical Japanese tile set. Its CC BY-SA 4.0 attribution and reproducible build command are documented in `e2e/README.md`.
