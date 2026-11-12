import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASSWORD: z.string().min(1),
    POSTGRES_DATABASE: z.string().min(1),
    THESYS_API_KEY: z.string().min(1),
    THESYS_BASE_URL: z.url().default("https://api.thesys.dev"),
    OPENUI_MODEL: z.string().min(1).default("anthropic/claude-sonnet-5.5"),
    OPENUI_DASHBOARD_MODEL: z.string().min(1).default("anthropic/claude-sonnet-5.5"),

    DEMO_USER_ID: z.string().min(1).default("assistant-ui-dashboards-demo"),
    GITHUB_TOKEN: z.string().min(1).optional(),
  },

  client: {},

  // On modern Next.js, only public variables need explicit mapping here.
  experimental__runtimeEnv: {},

  emptyStringAsUndefined: true,
});
