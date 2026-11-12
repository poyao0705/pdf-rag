import { indexing } from "@paradedb/drizzle-paradedb";
import { jsonb, pgTable, serial, text } from "drizzle-orm/pg-core";

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull().unique(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
  },
  (table) => [indexing.paradedbIndex("documents_search_idx").on(table.id, table.content)],
);
