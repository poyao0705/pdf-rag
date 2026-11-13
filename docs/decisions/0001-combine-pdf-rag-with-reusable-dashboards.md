---
status: accepted
date: 2026-09-28
---

# 0001. Combine PDF-based RAG with reusable dashboards

## Context and Problem Statement

The project's central idea is to combine OpenUI's generative UI and saved-dashboard capabilities with evidence retrieved from user-uploaded PDFs. It should work across topics, not just a single corpus or industry: enterprise and financial documents, including FinanceBench, and sports such as F1 and MotoGP are examples, not product boundaries.

Here, "live" means saved and reusable. Users should be able to reopen and edit an existing dashboard without generating it from scratch. It does not mean automatically refreshing its data or re-running retrieval whenever it opens.

## Considered Options

- Combine PDF-based RAG with saved, reusable OpenUI dashboards.

This is the author-confirmed product direction. No historical comparison with other product directions was established in the retrospective discussion.

## Decision Outcome

Chosen option: "Combine PDF-based RAG with saved, reusable OpenUI dashboards", because it brings document-grounded question answering and reusable visual artifacts into the same workflow.

PDF uploads are planned, not implemented in the recorded repository state. The LangChain documentation corpus is a temporary integration demo; see [ADR 0006](0006-use-langchain-docs-as-a-temporary-demo.md). Dashboard data behavior is specified in [ADR 0002](0002-generate-evidence-grounded-snapshot-dashboards.md).

Relevant commits: `6c96325` (initial dashboard application), `41c4df6` (documentation RAG), `fb3cc8b` and `bca3940` (snapshot-dashboard instructions).

### Consequences

- Good, because users can retain and revisit a visual artifact instead of receiving only a disposable chat answer.
- Good, because the product direction is not restricted to LangChain documentation or financial documents.
- Bad, because the documentation demo does not validate PDF parsing, uploads, or usefulness across the intended domains; those capabilities still need implementation and evaluation.
