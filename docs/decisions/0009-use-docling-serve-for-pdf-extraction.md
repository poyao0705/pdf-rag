---
status: accepted
date: 2026-11-16
---

# 0009. Use self-hosted Docling Serve for uploaded PDF extraction

## Context and Problem Statement

The intended product ingests uploaded PDFs for retrieval-augmented generation. The current ingestion script fetches a temporary Markdown documentation corpus instead; see [ADR 0006](0006-use-langchain-docs-as-a-temporary-demo.md).

PDF extraction needs to retain useful reading order, headings, tables, and their surrounding context before chunking and embedding. Losing a table's title or caption can remove information needed to interpret its contents. Extraction quality is therefore relevant to retrieval quality, but does not by itself establish downstream retrieval performance.

## Considered Options

- Self-host Docling through Docling Serve and call its conversion API from the TypeScript ingestion pipeline.
- Use Xberg, the successor to Kreuzberg, for local extraction.
- Use LiteParse for local extraction.

Docling Serve is also a local/self-hosted option. The distinction is the extraction engine and integration approach, not local processing versus a cloud service. These alternatives were considered, but this record does not establish a controlled comparison on the project's PDFs.

## Decision Outcome

Chosen option: "Use self-hosted Docling Serve for uploaded PDF extraction", because the author prefers its structure-aware PDF processing, has greater confidence in its maturity and research visibility, and finds its dedicated container/API deployment a straightforward fit for this project.

This is a reasonable initial engineering choice, not a finding that Docling is universally more accurate, more mature, or easier to deploy than every alternative. The supporting evidence and qualifications are:

- **Document structure:** [Docling's documentation](https://github.com/docling-project/docling) explicitly describes PDF layout analysis, reading order, table structure, and a unified document representation with Markdown and lossless JSON exports. These capabilities align with the intended corpus. They motivate expecting useful structural context, not claiming guaranteed retrieval improvements or perfect caption extraction.
- **Maturity and research visibility:** Docling has a public [technical report from August 2024](https://arxiv.org/abs/2408.09869). Its research background supports the author's confidence, but this record does not verify citation volume or comparative production reliability. [Xberg describes itself as the next iteration of Kreuzberg](https://github.com/xberg-io/xberg), so a recent rebrand or release line is not evidence that its underlying engine is immature.
- **Setup and integration:** [Docling Serve](https://github.com/docling-project/docling-serve) provides official container images and an HTTP conversion API. This fits the existing Compose-based infrastructure and avoids implementing a PDF extraction engine or maintaining a custom Python API. Upload handling, API integration, error handling, and ingestion orchestration still require application code. Xberg also provides a Docker image and REST API; container availability is not unique to Docling, and "easiest setup" is a project-specific preference rather than an established comparative result.
- **Alternatives and table context:** Xberg documents layout detection and table extraction. [LiteParse](https://github.com/run-llama/liteparse) documents spatial text, structured output, and heuristic Markdown reconstruction including headings and tables. Neither should be described as entirely structure-unaware. The author raised a concern that Xberg may omit table titles; without a recorded version, configuration, output mode, and sample PDF, this remains an unverified concern rather than a general limitation used to reject Xberg.

The accepted decision is to use Docling Serve as the initial PDF extraction service. It does not change the embedding-model or chunking decisions in [ADR 0007](0007-start-with-text-embedding-3-small.md) and [ADR 0008](0008-use-nvidia-inspired-character-chunking.md).

Implementation is partial: `compose.yaml` defines the Docling Serve CPU image, while `scripts/ingest.ts` still loads the temporary Markdown corpus. The service configuration does not establish that conversion or PDF ingestion has been exercised. The intended integration places Docling before the existing chunking, embedding, and ParadeDB writes, not in the retrieval/chat request path.

Reconsider this choice if representative PDFs show missing table titles/captions, incorrect reading order or table contents, unacceptable resource use or processing latency, or a simpler alternative provides equivalent retrieval quality. Evaluate extracted structure and downstream retrieval separately, using the same documents, questions, chunking, and embedding settings when comparing parsers.

### Consequences

- Good, because a dedicated extraction service can be added alongside ParadeDB without changing the application's TypeScript framework or building a custom extraction server.
- Good, because Docling's documented structure-aware output provides a credible starting point for table- and context-sensitive PDF ingestion.
- Bad, because the service adds container/model resources, startup and conversion latency, and operational work; long conversions may need asynchronous processing.
- Bad, because extraction failures, upload limits, and PDF handling still need application-level validation and error handling.
- Bad, because structured extraction can be lost during export or chunking. The current character-based splitter does not guarantee that headings, captions, and tables stay together; provenance and useful context need to survive through indexed chunks.
- Bad, because better retrieval and reliable page-level citations remain evaluation goals, not demonstrated consequences of selecting Docling.
