import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import { expect, it, vi } from "vitest";

const evidence = vi.hoisted(() => ({
  search: vi.fn(),
  end: vi.fn().mockResolvedValue(undefined),
  reads: [] as string[],
}));
vi.mock("@/env", () => ({ env: {} }));
vi.mock("@/lib/openui", () => ({ baseUrl: "https://gateway.example", dashboards: {} }));
vi.mock("@langchain/pgvector", () => ({
  PGVectorStore: class {
    similaritySearch = evidence.search;
    end = evidence.end;
  },
}));
vi.mock("@langchain/openai", () => ({
  OpenAIEmbeddings: class {},
  ChatOpenAI: class {
    constructor() { return new DocumentationChatModel(); }
  },
}));

import { createDashboardAgent } from "@/agent/chat-agent";

class DocumentationChatModel extends BaseChatModel {
  constructor() { super({}); }
  _llmType() { return "scripted-documentation-test"; }
  bindTools() { return this; }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const tools = messages.filter(ToolMessage.isInstance);
    const analyst = messages.some((message) =>
      SystemMessage.isInstance(message) &&
      JSON.stringify(message.content).includes("You analyze documentation evidence"),
    );
    let message: AIMessage;
    if (analyst) {
      const read = tools.find((result) => result.name === "read_file");
      if (read) {
        const content = read.text;
        evidence.reads.push(content);
        message = new AIMessage({ content });
      } else {
        const task = String(messages.filter(HumanMessage.isInstance).at(-1)?.content);
        const path = task.match(/\/retrieved\/[^\s]+\.md/)?.[0];
        if (!path) throw new Error("Analyst task is missing its chunk path");
        message = new AIMessage({
          content: "",
          tool_calls: [{ id: "read-chunk", name: "read_file", args: { file_path: path } }],
        });
      }
    } else {
      const search = tools.find((result) => result.name === "search_documentation");
      const summaries = tools.filter((result) => result.name === "task");
      if (!search) {
        message = new AIMessage({
          content: "",
          tool_calls: [{ id: "search-docs", name: "search_documentation", args: { query: "agent tools" } }],
        });
      } else if (summaries.length === 0) {
        const { paths } = JSON.parse(String(search.content)) as { paths: string[] };
        message = new AIMessage({
          content: "",
          tool_calls: paths.map((path, index) => ({
            id: `analyze-${index}`,
            name: "task",
            args: {
              subagent_type: "chunk-analyst",
              description: `Question: How do agent tools work?\nAnalyze: ${path}`,
            },
          })),
        });
      } else {
        message = new AIMessage({ content: summaries.map((result) => result.text).join("\n") });
      }
    }
    return { generations: [{ message, text: String(message.content) }] };
  }
}

it("makes retrieved chunks readable by parallel analyst tasks using the real Deep Agent", async () => {
  evidence.search.mockResolvedValue([
    { pageContent: "Agents call tools.", metadata: { source: "https://docs.langchain.com/agents" } },
    { pageContent: "Tools have schemas.", metadata: { source: "https://docs.langchain.com/tools" } },
  ]);
  const agent = createDashboardAgent({ userId: "offline-owner", signal: new AbortController().signal });
  const result = await agent.invoke(
    { messages: [new HumanMessage("How do agent tools work?")] },
    { recursionLimit: 24 },
  );
  expect(evidence.search).toHaveBeenCalledExactlyOnceWith("agent tools", 4);
  expect(evidence.end).toHaveBeenCalledOnce();
  expect(evidence.reads).toHaveLength(2);
  const answer = result.messages.at(-1)?.text;
  expect(answer).toContain("Agents call tools.");
  expect(answer).toContain("Tools have schemas.");
  expect(answer).toContain("https://docs.langchain.com/agents");
  expect(answer).toContain("https://docs.langchain.com/tools");
  expect(answer).not.toContain("not found");
});
