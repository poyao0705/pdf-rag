---
status: accepted
date: 2026-09-28
---

# 0007. Start with text-embedding-3-small as a provisional baseline

## Context and Problem Statement

The project needs an initial embedding model for ingestion and retrieval. The author wants a starting point that can be replaced if retrieval accuracy proves insufficient, rather than treating the first model choice as final.

This choice is independent of input size and of the chunking decision. A particular chunk size does not guarantee adequate embedding quality.

## Considered Options

- Start with `text-embedding-3-small`.

No specific replacement models or completed model comparison were established in the discussion. Considering an upgrade later is a review condition, not evidence that alternatives have already been evaluated.

## Decision Outcome

Chosen option: "Start with text-embedding-3-small", because it provides the initial baseline. Consider upgrading the embedding model if retrieval results show insufficient accuracy.

This is an accepted starting choice, not a claim that the model is optimal or sufficiently accurate on the intended corpora.

Relevant commits: `aa3a161` (ingestion embeddings), `41c4df6` (query embeddings).

Implementation references: `scripts/ingest.ts`, `src/agent/tools.ts`, `src/db/schema.ts`.

### Consequences

- Good, because development has a concrete baseline without requiring a completed embedding-model evaluation first.
- Bad, because retrieval accuracy remains to be evaluated on representative documents and questions.
- Bad, because changing models is not necessarily just a configuration swap: ingestion and query embeddings must stay compatible, stored vectors may need rebuilding, and a dimension change requires a matching schema change.
