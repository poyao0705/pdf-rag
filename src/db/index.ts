import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

const databaseUrl = z.url().parse(process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

export const client = postgres(databaseUrl);
export const db = drizzle({ client });
