import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { documents } from "@/db/schema";

import { OpenAIEmbeddings } from "@langchain/openai";
import { inArray, sql } from "drizzle-orm";

import { client, db } from "../src/db";

const DOCS_BASE = "https://docs.langchain.com";

const DOC_PATHS = [
  "oss/python/langchain/agents",
  "oss/python/deepagents/rag",
  "oss/python/langchain/tools",
  "oss/python/langchain/models",
  "oss/python/deepagents/retrieval",
  "oss/python/langchain/knowledge-base",
  "oss/python/langchain/middleware",
  "oss/python/deepagents/overview",
  "oss/python/deepagents/subagents",
  "oss/python/deepagents/streaming",
  "oss/python/deepagents/frontend/subagent-streaming",
  "oss/python/deepagents/backends",
  "oss/python/langgraph/overview",
  "oss/python/langgraph/quickstart",
];

async function fetchAndIngest(paths: string[] = DOC_PATHS) {
  if (paths.length === 0) return;
  const docs: Document[] = [];
  for (const path of paths) {
    const source = `${DOCS_BASE}/${path}`;
    const url = `${source}.md`;
    try {
      const response = await fetch(url);
      const text = await response.text();
      const doc = new Document({ pageContent: text, metadata: { source } });
      docs.push(doc);
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
      continue;
    }
  }

  if (docs.length === 0) {
    console.log("No documents to ingest");
    return;
  }

  console.log(`Loaded ${docs.length} documents`);

  // Split documents into chunks with chunk size 1000 and overlap 200
  const textSplitter = new RecursiveCharacterTextSplitter({
    // NVidia article recommended chunk size and overlap size for FinanceBench
    // https://developer.nvidia.com/blog/finding-the-best-chunking-strategy-for-accurate-ai-responses/
    chunkSize: 1024,
    chunkOverlap: 150,
  });

  const allSplits = await textSplitter.splitDocuments(docs);
  console.log(`Split into ${allSplits.length} chunks`);
  // console.log(`${JSON.stringify(allSplits[0])}`);

  const embeddings = new OpenAIEmbeddings({
    model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  });

  const vectors = await embeddings.embedDocuments(allSplits.map((chunk) => chunk.pageContent));

  const rows: (typeof documents.$inferInsert)[] = allSplits.map((chunk, i) => ({
    content: chunk.pageContent,
    vector: vectors[i],
    metadata: chunk.metadata,
  }));

  const sources = [
    ...new Set(
      rows.map((row) => {
        const source = row.metadata.source;

        if (typeof source !== "string" || !source) {
          throw new Error("Every replacement row needs a source");
        }

        return source;
      }),
    ),
  ];

  console.log(`Found ${sources.length} sources`);

  await db.transaction(async (tx) => {
    // Remove existing chunks for the same sources
    await tx
      .delete(documents)
      .where(inArray(sql<string>`${documents.metadata}->>'source'`, sources));

    console.log(`Deleted ${sources.length} sources`);

    // Insert new chunks and skip duplicates
    const inserted = await tx
      .insert(documents)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: documents.id });

    console.log(`Inserted ${inserted.length} chunks; skipped ${rows.length - inserted.length}`);
  });
  console.log(`Indexed ${allSplits.length} documents`);
}

try {
  await fetchAndIngest();
} finally {
  await client.end({ timeout: 5 });
}
