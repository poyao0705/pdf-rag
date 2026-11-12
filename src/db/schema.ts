import { indexing } from "@paradedb/drizzle-paradedb";
import { jsonb, pgTable, serial, text, vector } from "drizzle-orm/pg-core";

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    vector: vector("vector", { dimensions: 1536 }).notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
  },
  (table) => [indexing.paradedbIndex("documents_search_idx").on(table.id, table.content)],
);
