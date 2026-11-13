---
status: accepted
date: 2026-09-28
---

# 0006. Use LangChain documentation as a temporary integration demo

## Context and Problem Statement

The intended product uses uploaded PDFs, but the immediate goal was to quickly check whether the official LangChain documentation demo worked with the author's current LangChain + AI SDK + assistant-ui stack, alongside OpenUI.

## Considered Options

- Use the LangChain documentation demo as a temporary compatibility test.

No comparison of other initial corpora was confirmed. The author did not choose LangChain documentation as a retrieval-quality benchmark or as the permanent product scope.

## Decision Outcome

Chosen option: "Start with the LangChain documentation demo", because it is a quick integration check before introducing the intended PDF-upload workflow.

Replace this demo with actual PDF uploads later. This does not make the product a LangChain-only documentation assistant.

Relevant commits: `aa3a161` (documentation ingestion), `41c4df6` (documentation-search agent and prompt).

Implementation references: `scripts/ingest.ts`, `src/agent/tools.ts`, `src/lib/prompt.ts`.

### Consequences

- Good, because stack compatibility can be explored before adding PDF-upload and parsing work.
- Bad, because the temporary corpus and documentation-specific prompts do not implement the intended PDF experience.
- Bad, because success with this demo would not establish retrieval quality on FinanceBench, sports documents, or other intended topics.
