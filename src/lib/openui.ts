import { promptOptions } from "@openuidev/dashboard-library";
import { OpenUIClient } from "@openuidev/server";
import spec from "../generated/spec.json";
// import { dataTools, osv } from "./data";

// OpenUI Cloud, or your own deployment of it, such as a local stack at http://localhost:3102.
export const baseUrl = (process.env.THESYS_BASE_URL || "https://api.thesys.dev").replace(
  /\/+$/,
  "",
);

// Reads THESYS_API_KEY when it makes a request.
export const openui = new OpenUIClient({ baseUrl });

// There is no sign-in, so every browser shares one local user, as in apps from `openui create`.
// Use the signed-in user's id instead when you add authentication: users read and edit only
// their own dashboards.
export const userId = () => process.env.DEMO_USER_ID || "assistant-ui-dashboards-demo";

// One definition for every dashboard: the components it's built from, the model that builds
// it, and where its data comes from: our npm and GitHub data tools, and the OSV MCP server's
// tools. Its interpreter runs those tools for the browser.
export const dashboards = openui.defineDashboard({
  // The specification `npm run generate` writes from src/library.ts, so the server never loads
  // the React components the browser renders with.
  library: spec,
  model: process.env.OPENUI_DASHBOARD_MODEL || "anthropic/claude-sonnet-5.5",
  // tools: dataTools,
  tools: {},
  // mcp: osv,
  // The kit's examples and rules, with our own preamble.
  promptOptions: {
    preamble:
      "You build saved snapshot dashboards from information supplied in the request. " +
      "Organize the supplied facts, findings, and decisions into clear, useful views. " +
      "Use charts and metrics only when supported by actual data; otherwise prefer " +
      "text, tables, and structured summaries. Do not fetch external data or use Query().",
    examples: promptOptions.examples,
    additionalRules: [
      ...(promptOptions.additionalRules ?? []).filter((rule) => !rule.includes("placeholder data")),
      "Use only supplied information. Never invent facts or numbers. " +
        "Clearly label missing information.",
    ],
  },
});
