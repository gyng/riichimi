# Visual checkpoints

These browser captures are committed evidence from the critical mobile-width dogfood journey. They are regenerated only after the corresponding flow has passed its assertions; filenames retain the checkpoint date and sequence.

The source journeys live in `e2e/polished-journeys.spec.ts` and cover the landing page, scored manual hands at mobile and desktop sizes, score-history persistence, gallery-photo review when camera access is unavailable, and a locally persisted table changed through WebMCP. The table journey also posts a successfully scored hand, verifies its transfers and dealer repeat, and captures the resulting ledger. The gallery fixture is a code-native guided-hand scene in `e2e/fixtures`.
