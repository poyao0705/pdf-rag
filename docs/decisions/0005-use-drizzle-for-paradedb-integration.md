---
status: accepted
date: 2026-09-28
---

# 0005. Use Drizzle for the documented ParadeDB integration

## Context and Problem Statement

The author needed schema and query tooling for ParadeDB/Postgres. ParadeDB's official documentation provided direct Drizzle integration support/examples, while the author did not find an equivalent Prisma example there.

## Considered Options

- Drizzle, following ParadeDB's documented integration.
- Prisma, for which the author did not find an equivalent example in the official documentation.

This records the documentation encountered when choosing, not a broader ORM benchmark or technical evaluation.

## Decision Outcome

Chosen option: "Use Drizzle", because following ParadeDB's documented integration provided a supported starting path for the database schema and queries.

The absence of a Prisma example in the author's search is not evidence that Prisma is incompatible, unsupported, or technically inferior.

Relevant commits: `5c53866` (Drizzle and Postgres dependencies), `b3e2415` (schema and configuration).

Implementation references: `drizzle.config.ts`, `src/db/index.ts`, `src/db/schema.ts`.

### Consequences

- Good, because implementation can follow an official ParadeDB integration example rather than first establishing an undocumented integration path.
- Bad, because the choice is documentation-led rather than evidence of a completed ORM comparison; this ADR should not be used to claim that Prisma cannot work.
