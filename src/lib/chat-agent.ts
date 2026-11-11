import { ToolMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent } from "deepagents";
import { createMiddleware, tool } from "langchain";
import { dashboardToolContracts } from "./dashboard-tool-contracts";
import { baseUrl, dashboards } from "./openui";
import { chatPrompt } from "./prompt";

export type DashboardAgentContext = { userId: string; signal: AbortSignal };

export function createDashboardTools({ userId, signal }: DashboardAgentContext): StructuredToolInterface[] {
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

export function createDashboardAgent(context: DashboardAgentContext): ReturnType<typeof createDeepAgent> {
  const model = new ChatOpenAI({
    model: process.env.OPENUI_MODEL || "anthropic/claude-sonnet-5.5",
    apiKey: process.env.THESYS_API_KEY,
    streaming: true,
    useResponsesApi: false,
    configuration: { baseURL: baseUrl + "/v1/embed" },
  });

  // Each request owns its tools and ephemeral state; browser history supplies prior turns.
  return createDeepAgent({
    model,
    tools: createDashboardTools(context),
    systemPrompt: chatPrompt,
    middleware: [createMiddleware({
      name: "DashboardToolErrors",
      wrapToolCall: async (request, handler) => {
        try {
          return await handler(request);
        } catch (error) {
          const { name, id } = request.toolCall;
          if (context.signal.aborted || !id || (name !== "create_dashboard" && name !== "edit_dashboard")) throw error;
          // Preserve a failed tool's identity so the chat card cannot appear successful.
          return new ToolMessage({
            name, tool_call_id: id, status: "error",
            content: name === "create_dashboard" ? "Dashboard creation failed." : "Dashboard edit failed.",
          });
        }
      },
    })],
  });
}
