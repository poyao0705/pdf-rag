---
status: accepted
date: 2026-09-28
---

# 0008. Use NVIDIA-inspired character-based chunking

## Context and Problem Statement

The ingestion configuration was inspired by NVIDIA's article, [Finding the Best Chunking Strategy for Accurate AI Responses](https://developer.nvidia.com/blog/finding-the-best-chunking-strategy-for-accurate-ai-responses/), linked in `scripts/ingest.ts`.

Its FinanceBench findings include 1,024-token chunks and a 15% overlap setting that performed best among the tested 10%, 15%, and 20% overlap values at that chunk size. This was not a full-grid search or a universal optimum across datasets. The article recommends evaluation on the application's own data.

## Considered Options

- Use character-based chunking with numeric sizes inspired by the article.

Only the adopted character-based configuration was confirmed as the historical choice. The article's token-based configuration is external evidence, not a separately evaluated implementation in this project.

## Decision Outcome

Chosen option: "Use RecursiveCharacterTextSplitter with a chunk size of 1024 characters and overlap of 150 characters", because the author intentionally wanted a close-enough initial approximation inspired by NVIDIA's findings rather than an exact reproduction of the token-based experiment.

The installed splitter's default length function is JavaScript `text.length`, not a tokenizer. The character-based configuration is intentional, but is not equivalent to 1,024 tokens with 15% token overlap. The article motivates the starting configuration; it does not establish the performance of this exact setup.

This decision does not justify the embedding-model choice; see [ADR 0007](0007-start-with-text-embedding-3-small.md).

Relevant commits: `7b15fb0` (text splitter dependency), `aa3a161` (ingestion configuration).

Implementation reference: `scripts/ingest.ts`.

### Consequences

- Good, because the initial configuration has a documented external motivation and can be reconsidered against that evidence.
- Bad, because character counts and token counts represent different text budgets, so this setup does not reproduce the cited experiment.
- Bad, because FinanceBench findings cannot be assumed to generalize unchanged to other financial or sports documents; representative local evaluation is still needed.
