import { dashboardToolContracts } from "./dashboard-tool-contracts";
import { dashboards } from "../lib/openui";
import { tool } from "langchain";
import type { DashboardAgentContext } from "./chat-agent";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { PGVectorStore } from "@langchain/pgvector";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PoolConfig } from "pg";
import { DistanceStrategy } from "@langchain/pgvector";
import { env } from "../env";
import { z } from "zod";
import { v7 } from "@langchain/core/utils/uuid";
import { StateBackend } from "deepagents";

export function createDashboardTools({
  userId,
  signal,
}: DashboardAgentContext): StructuredToolInterface[] {
  return [
    tool(
      async (args) => {
        signal.throwIfAborted();
        try {
          return await dashboards.create(args, { userId }, { signal });
        } catch {
          signal.throwIfAborted();
          throw new Error("Dashboard creation failed.");
        }
      },
      {
        name: "create_dashboard",
        description: dashboardToolContracts.create_dashboard.description,
        schema: dashboardToolContracts.create_dashboard.parameters,
      },
    ),
    tool(
      async (args) => {
        signal.throwIfAborted();
        try {
          return await dashboards.edit(args, { userId }, { signal });
        } catch {
          signal.throwIfAborted();
          throw new Error("Dashboard edit failed.");
        }
      },
      {
        name: "edit_dashboard",
        description: dashboardToolContracts.edit_dashboard.description,
        schema: dashboardToolContracts.edit_dashboard.parameters,
      },
    ),
  ];
}

export function createSearchTools(backend: StateBackend): StructuredToolInterface[] {
  return [
    tool(
      async (args) => {
        try {
          const connConfig = {
            postgresConnectionOptions: {
              type: "postgres",
              host: "127.0.0.1",
              port: 5432,
              user: env.POSTGRES_USER,
              password: env.POSTGRES_PASSWORD,
              database: env.POSTGRES_DATABASE,
            } as PoolConfig,
            tableName: "documents",
            columns: {
              idColumnName: "id",
              vectorColumnName: "vector",
              contentColumnName: "content",
              metadataColumnName: "metadata",
            },
            // supported distance strategies: cosine (default), innerProduct, or euclidean
            distanceStrategy: "cosine" as DistanceStrategy,
          };
          const vectorStore = new PGVectorStore(
            new OpenAIEmbeddings({
              model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
            }),
            connConfig,
          );
          const retrievedDocs = await vectorStore
            .similaritySearch(args.query, 4)
            .finally(() => vectorStore.end());
          // Different tool call will lead to different batch
          const batchID = v7();

          const uploads: [string, Buffer][] = [];
          const savedPaths: string[] = [];

          for (let index = 0; index < retrievedDocs.length; index++) {
            const doc = retrievedDocs[index];
            const path = `/retrieved/${batchID}/chunk_${index + 1}.md`;
            const content = `# Source: ${doc.metadata.source ?? "unknown"}\n\n${doc.pageContent}`;
            uploads.push([path, Buffer.from(content)]);
            savedPaths.push(path);
          }
          const results = backend.uploadFiles(uploads);
          if (results.some((result) => result.error)) {
            throw new Error("Could not save retrieved documentation chunks.");
          }

          return { paths: savedPaths };
        } catch {
          throw new Error("Search failed.");
        }
      },
      {
        name: "search_documentation",
        description:
          "Search LangChain documentation and save matching chunks to the agent filesystem",
        schema: z.object({
          query: z.string().describe("Natural language search query"),
        }),
      },
    ),
  ];
}
