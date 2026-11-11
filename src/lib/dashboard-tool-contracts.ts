import { z } from "zod";

// Dashboard argument contracts and model descriptions; no React or server dependencies.
export const dashboardToolContracts = {
  create_dashboard: {
    description:
      "Create a live dashboard. It loads its numbers live from npm, GitHub, and OSV.dev every time it is opened, so name the packages or repositories and describe which data to show and how, without numbers. Returns right away while the dashboard is generated.",
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
