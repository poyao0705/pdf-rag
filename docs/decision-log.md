# Decision log

This index links the project's [MADR 4.0.0 minimal](https://github.com/adr/madr/blob/4.0.0/template/adr-template-minimal.md) decision records. The product direction is PDF-based RAG combined with OpenUI's saved, reusable dashboards across domains, including enterprise/financial documents and sports.

These initial records were reconstructed from commit history and a conversation with the project author. Motivations are author-confirmed unless attributed to an existing design or to code/commit evidence. Commit references identify related work, not proof that every reason was documented at the time.

## Records

1. [Combine PDF-based RAG with reusable dashboards](decisions/0001-combine-pdf-rag-with-reusable-dashboards.md)
2. [Generate evidence-grounded snapshot dashboards](decisions/0002-generate-evidence-grounded-snapshot-dashboards.md)
3. [Use Deep Agents for multi-hop retrieval](decisions/0003-use-deep-agents-for-multi-hop-retrieval.md)
4. [Use ParadeDB for hybrid retrieval in one database](decisions/0004-use-paradedb-for-hybrid-retrieval.md)
5. [Use Drizzle for the documented ParadeDB integration](decisions/0005-use-drizzle-for-paradedb-integration.md)
6. [Use LangChain documentation as a temporary integration demo](decisions/0006-use-langchain-docs-as-a-temporary-demo.md)
7. [Start with text-embedding-3-small as a provisional baseline](decisions/0007-start-with-text-embedding-3-small.md)
8. [Use NVIDIA-inspired character-based chunking](decisions/0008-use-nvidia-inspired-character-chunking.md)

## Conventions

- Copy [the reusable template](decisions/template.md) to `docs/decisions/NNNN-short-title.md`, using the next four-digit number, and add its link above. The initial numbering follows retrospective recording order, not a claim about exact historical decision dates.
- Keep the same MADR headings: **Context and Problem Statement**, **Considered Options**, **Decision Outcome**, and **Consequences**. Retain consequences even though the upstream minimal template makes that subsection optional.
- `status` describes the decision lifecycle: `proposed`, `accepted`, `rejected`, `deprecated`, or `superseded by ADR-NNNN`. An accepted decision can be provisional or not yet implemented.
- `date` is when the record was written or last updated, not an inferred historical decision date. The initial records are retrospective; commit dates are not substituted for unknown decision dates.
- List only alternatives actually considered. Explicitly identify an unknown historical comparison or a baseline chosen without a comparison. Do not manufacture benchmarks, rejected options, or certainty.
- Consequences may describe expected benefits and technical implications; they do not imply every implication was consciously weighed at the time. Distinguish these from measured results.
- Include evidence, commit references, implementation status, and conditions for reconsideration within the standard sections instead of adding a different set of headings to each record.
- Preserve historical reasoning. For a materially changed decision, add a new ADR and link it from the old record's superseded status rather than rewriting the old rationale. Corrections and clarifications are still appropriate.

No ADR tool or additional dependency is required.

## Implementation and evaluation boundaries

The implementation observations in the initial ADRs describe the repository at `bca3940`, not a continuously updated architecture specification. Expected benefits are not claims of measured improvements in this project.

- PDF uploads are planned; the current corpus is a temporary LangChain documentation demo ([ADR 0006](decisions/0006-use-langchain-docs-as-a-temporary-demo.md)).
- Hybrid retrieval is the intended direction, but the current agent tool uses vector similarity search ([ADR 0004](decisions/0004-use-paradedb-for-hybrid-retrieval.md)).
- Retrieval quality should be evaluated on representative documents and questions before changing the embedding model or chunking configuration ([ADR 0007](decisions/0007-start-with-text-embedding-3-small.md), [ADR 0008](decisions/0008-use-nvidia-inspired-character-chunking.md)). FinanceBench findings should not be assumed to generalize unchanged to other topics.

## Supporting history not promoted to ADRs

These observations are supported by code or commit messages; their broader historical rationale was not separately confirmed:

- **Duplicate-ingestion prevention:** `84227bd` adds uniqueness by source and content hash; `2280a2e` makes the SHA-256 hash database-generated. The deduplication intent is explicit, but no additional reason is asserted for choosing database-generated hashing over application-side hashing.
- **Database configuration separation:** `0ff1160` and `c46edee` decouple database setup from the shared application environment module. The commits establish the change, but the author's original reason was not elicited.
- Build fixes, dependency-only additions, whitespace changes, and ignore-file housekeeping are not independent architectural decisions without a meaningful rationale to record.
