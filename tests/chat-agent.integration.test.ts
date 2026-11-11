import { toUIMessageStream } from "@ai-sdk/langchain";
import { HumanMessage } from "@langchain/core/messages";
import { createUIMessageStreamResponse } from "ai";
import { beforeEach, expect, it, vi } from "vitest";
import { readUIChunks, reference } from "./helpers/chat-stream-fixtures";

const cloud = vi.hoisted(() => ({ create: vi.fn(), edit: vi.fn() }));
vi.mock("@/lib/openui", () => ({ baseUrl: "https://gateway.example", dashboards: cloud }));
vi.mock("@langchain/openai", async () => {
  const { createScriptedChatModel } = await import("./helpers/scripted-chat-model");
  return { ChatOpenAI: class { constructor() { return createScriptedChatModel(); } } };
});

import { createDashboardAgent } from "@/lib/chat-agent";

beforeEach(() => vi.clearAllMocks());

it("carries a real Deep Agent tool result into the existing dashboard-card protocol", async () => {
  cloud.create.mockResolvedValue(reference);
  const signal = new AbortController().signal;
  const agent = await createDashboardAgent({ userId: "integration-owner", signal });
  const stream = await agent.stream(
    { messages: [new HumanMessage("Build a React dashboard")] },
    { streamMode: ["values", "messages"], signal, recursionLimit: 24 },
  );
  const chunks = await readUIChunks(createUIMessageStreamResponse({ stream: toUIMessageStream(stream) }));
  expect(cloud.create).toHaveBeenCalledExactlyOnceWith(
    { title: "React health", prompt: "Show react downloads" },
    { userId: "integration-owner" }, { signal },
  );
  expect(chunks).toContainEqual(expect.objectContaining({
    type: "tool-input-available", toolName: "create_dashboard", toolCallId: "call_create_1",
  }));
  expect(chunks.filter((chunk) => chunk.type === "tool-output-available")).toEqual([
    { type: "tool-output-available", toolCallId: "call_create_1", output: reference },
  ]);
  expect(chunks.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.delta).join("")).toBe("Your dashboard is ready.");
  expect(chunks.some((chunk) => chunk.type === "error")).toBe(false);
});

it("keeps a failed real-agent dashboard call out of successful artifact output", async () => {
  cloud.create.mockRejectedValue(new Error("Private upstream diagnostics"));
  const signal = new AbortController().signal;
  const agent = await createDashboardAgent({ userId: "integration-owner", signal });
  const stream = await agent.stream(
    { messages: [new HumanMessage("Build a React dashboard")] },
    { streamMode: ["values", "messages"], signal, recursionLimit: 24 },
  );
  const chunks = await readUIChunks(createUIMessageStreamResponse({ stream: toUIMessageStream(stream) }));
  expect(cloud.create).toHaveBeenCalledTimes(1);
  expect(chunks.some((chunk) => chunk.type === "tool-output-available")).toBe(false);
  expect(chunks).toContainEqual(expect.objectContaining({
    type: "tool-output-error", toolCallId: "call_create_1", errorText: expect.stringContaining("Dashboard creation failed."),
  }));
  expect(JSON.stringify(chunks)).not.toContain("Private upstream diagnostics");
});
