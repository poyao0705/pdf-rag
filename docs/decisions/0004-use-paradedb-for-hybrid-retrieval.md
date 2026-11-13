---
status: accepted
date: 2026-09-28
---

# 0004. Use ParadeDB for hybrid retrieval in one database

## Context and Problem Statement

In previous experiments using DeepEval, the author found keyword-only and semantic-only retrieval performed worse than hybrid retrieval. This motivated introducing hybrid-search capability here while keeping document content, metadata, keyword indexing, and vectors in one data source.

Those comparative results came from earlier experiments, not measurements reproduced by this repository.

## Considered Options

- Use keyword-only retrieval.
- Use semantic-only retrieval.
- Use hybrid retrieval with a separate search service, such as Elasticsearch.
- Use hybrid retrieval in a single PostgreSQL-based data source with ParadeDB.

The earlier experiments inform the retrieval-method comparison. No comparative benchmark of ParadeDB against Elasticsearch was claimed.

## Decision Outcome

Chosen option: "Use ParadeDB/Postgres for hybrid retrieval", because it provides the desired keyword and vector capabilities without introducing a separate search service.

The recorded schema defines a ParadeDB text index and a vector column. However, the current agent search tool calls `PGVectorStore.similaritySearch`; it does not demonstrate keyword/vector fusion. Hybrid retrieval is the accepted architectural direction, not an established end-to-end property of the current search path.

Relevant commits: `e27530d` (ParadeDB setup), `b3e2415` (schema and text index), `c24c635` (LangChain PGVector integration), `af5b200` (vector column).

Implementation references: `compose.yaml`, `src/db/schema.ts`, `src/agent/tools.ts`.

### Consequences

- Good, because one database can hold document content, metadata, and both search representations.
- Good, because the architecture follows the author's earlier retrieval-quality findings without operating a separate search service.
- Bad, because database capability alone does not implement hybrid retrieval; the application still needs to combine and evaluate the retrieval methods.
- Bad, because the earlier experiments do not establish this project's performance on its own documents and questions.
