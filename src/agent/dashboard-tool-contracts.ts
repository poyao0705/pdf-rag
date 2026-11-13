import { z } from "zod";

// Dashboard argument contracts and model descriptions; no React or server dependencies.
export const dashboardToolContracts = {
  create_dashboard: {
    description:
      "Create and save a snapshot dashboard based on the conversation. " +
      "Provide a descriptive title and a self-contained prompt containing " +
      "the relevant facts, numbers, decisions, labels, and requested layout. " +
      "The dashboard generator cannot access chat history, so include the " +
      "actual information rather than referring to earlier messages. " +
      "Use only information supplied by the user or supported by retrieved " +
      "sources; do not invent missing data. " +
      "Returns before dashboard generation finishes.",
    parameters: z.object({
      title: z.string().min(1).describe('A short title, such as "October sales".'),
      prompt: z
        .string()
        .min(1)
        .describe(
          "What to build: the sections, metrics, charts, and tables, and which data each shows. The dashboard is built from this alone.",
        ),
    }),
  },
  edit_dashboard: {
    description:
      "Change a dashboard in place, such as adding a chart or a section. Returns right away; the user sees the new version when it is ready.",
    parameters: z.object({
      id: z.string().min(1).describe("The dashboard's artifact_id, art_…, from its tool result."),
      prompt: z.string().min(1).describe("The change to make."),
    }),
  },
};
