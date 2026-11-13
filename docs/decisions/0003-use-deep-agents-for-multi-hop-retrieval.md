---
status: accepted
date: 2026-09-28
---

# 0003. Use Deep Agents for multi-hop retrieval

## Context and Problem Statement

The author anticipates questions requiring multiple retrieval and reasoning steps, particularly when testing FinanceBench or other benchmarks that may contain multi-hop questions. A single retrieve-and-answer pass may not be enough.

Repeated retrieval can also fill the main context with intermediate evidence. The author wants query planning, focused analysis, evidence offloading, and a multi-step fetching and verification loop.

## Considered Options

- Extend the existing direct LLM-call execution approach.
- Run LangChain Deep Agents inside the existing Next.js application.
- Introduce a separate LangGraph service.
- Replace the existing frontend/protocol wiring with the OpenUI LangGraph example's AG-UI approach.

The first two reflect the author-confirmed motivation for adopting an agent harness. The additional deployment/frontend alternatives are recorded in the [existing migration design](../superpowers/specs/2026-11-10-deep-agents-chat-design.md), not inferred from a new comparison.

## Decision Outcome

Chosen option: "Run LangChain Deep Agents inside the existing application", because its harness provides capabilities intended to support multi-hop retrieval:

- Todo middleware for query planning and tracking intermediate work.
- Subagents for focused analysis of retrieved evidence.
- A workspace for offloading retrieved material and intermediate results, reducing the risk of context explosion across many retrieval rounds.
- Iterative execution: fetch evidence, analyze it, refine queries, and verify whether the accumulated evidence answers the question.

The migration design additionally records preserving assistant-ui, existing conversations, and AI SDK's message/stream transport. AI SDK remains a transport dependency rather than the agent execution engine; a separate LangGraph service or frontend replacement is unnecessary for that migration.

These are expected benefits, not claims of benchmark-proven improvements in this project.

Relevant commits: `b5415c6` (Deep Agents migration), `41c4df6` (retrieval, workspace offloading, and documentation-analysis orchestration).

Implementation references: `src/agent/chat-agent.ts`, `src/agent/tools.ts`, `src/lib/prompt.ts`.

### Consequences

- Good, because the application can express a plan, delegate analysis, and repeat retrieval/verification instead of being limited to a single retrieval pass.
- Good, because workspace offloading is intended to avoid retaining every retrieved chunk in the main context.
- Bad, because orchestration and stream-adapter compatibility add complexity compared with direct model calls.
- Bad, because the harness alone does not establish better answer quality or effective context management; those expected benefits still need evaluation.
