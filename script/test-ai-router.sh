#!/usr/bin/env bash
set -euo pipefail
# Synthetic/provider-stub and source-contract tests only; no paid provider requests.
npx --no-install tsx --test --test-concurrency=2 \
  server/lib/ai-router.test.ts \
  server/lib/ai-router-coverage.test.ts \
  server/lib/task-ai-checklist.test.ts \
  server/lib/task-resolution-draft.test.ts \
  server/lib/task-resolution-draft-route.test.ts \
  server/lib/task-sentiment.test.ts \
  server/lib/priority-city-ranking.test.ts \
  server/lib/region-suggestion.test.ts \
  server/lib/representative-region-suggestions.test.ts \
  server/lib/status-list-label-translation.test.ts \
  server/lib/automation-attachment-document.test.ts \
  server/lib/standing-recording-analysis.test.ts \
  server/lib/forwarded-call-reconciliation.test.ts
