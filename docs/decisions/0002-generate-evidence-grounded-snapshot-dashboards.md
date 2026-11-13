---
status: accepted
date: 2026-09-28
---

# 0002. Generate evidence-grounded snapshot dashboards

## Context and Problem Statement

The source of truth should be the user's documents indexed in the supplied database. The starter dashboard application's npm, GitHub, and OSV connectors are unrelated to that source material. The desired dashboard feature is persistence and reuse, not independent external data fetching.

The dashboard generator cannot directly access chat history, so its request must contain the actual information needed to build the artifact.

## Considered Options

- Generate saved snapshots from evidence supplied by the conversation and RAG pipeline.
- Generate dashboards that fetch data through the starter application's external connectors.

The author explicitly chose saved, reusable artifacts rather than independently data-refreshing dashboards.

## Decision Outcome

Chosen option: "Generate saved snapshots from supplied evidence", because the RAG pipeline already retrieves the relevant source material from the document database.

Pass the relevant facts, findings, decisions, labels, numbers, and layout requirements in a self-contained dashboard-generation request. Use only information supplied by the user or supported by retrieved sources; label missing information instead of inventing it.

The agent can retrieve evidence before generating a dashboard. The generated dashboard itself should not fetch unrelated external data or use `Query()` calls.

Relevant commits: `fb3cc8b` (self-contained, evidence-grounded generation requests), `bca3940` (remove external data-tool wiring and use snapshot instructions).

Implementation references: `src/agent/dashboard-tool-contracts.ts`, `src/lib/openui.ts`.

### Consequences

- Good, because dashboard contents remain grounded in the document-based source of truth.
- Good, because dashboard generation does not require operating unrelated external API integrations.
- Bad, because reopening a snapshot does not automatically incorporate new or changed PDFs; updated findings must be supplied through a subsequent generation or edit request.
- Bad, because omitting evidence from the generation request cannot be repaired by expecting the generator to read the chat history.
