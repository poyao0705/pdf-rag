import { indexing } from "@paradedb/drizzle-paradedb";
import { sql } from "drizzle-orm";
import { jsonb, pgTable, serial, text, uniqueIndex, vector } from "drizzle-orm/pg-core";

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    vector: vector("vector", { dimensions: 1536 }).notNull(),
    content: text("content").notNull(),
    content_hash: text("content_hash"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    indexing.paradedbIndex("documents_search_idx").on(table.id, table.content),
    uniqueIndex("documents_source_content_hash_uidx").on(
      sql`(${table.metadata}->>'source')`,
      table.content_hash,
    ),
  ],
);
