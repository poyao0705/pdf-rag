import { AIMessage, AIMessageChunk, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { toUIMessageStream } from "@ai-sdk/langchain";
import type { UIMessageChunk } from "ai";

type AdapterInput = Parameters<typeof toUIMessageStream>[0];

export const createArgs = { title: "React health", prompt: "Show react downloads" };
export const reference = "dashboard-reference-fixture";

function eventStream(events: unknown[]): AdapterInput {
  return new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(event);
      controller.close();
    },
  });
}

export function createRunFixture(): AdapterInput {
  return eventStream([
    ["values", { messages: [new HumanMessage("Create a dashboard")] }],
    ["tools", { event: "on_tool_start", name: "create_dashboard", toolCallId: "call_create_1", input: createArgs }],
    ["tools", { event: "on_tool_end", name: "create_dashboard", toolCallId: "call_create_1", input: createArgs, output: reference }],
    ["messages", [new AIMessageChunk({ id: "answer", content: "Dashboard ready." }), {}]],
    ["values", { messages: [new AIMessage({ id: "answer", content: "Dashboard ready." })] }],
  ]);
}

export function failedRunFixture(): AdapterInput {
  const call = new AIMessage({
    id: "failed-call",
    content: "",
    tool_calls: [{ id: "call_create_1", name: "create_dashboard", args: createArgs }],
  });
  const result = new ToolMessage({
    id: "failed-output",
    name: "create_dashboard",
    tool_call_id: "call_create_1",
    content: "Dashboard creation failed.",
    status: "error",
  });
  return eventStream([
    ["values", { messages: [call] }],
    ["messages", [result, {}]],
    ["values", { messages: [call, result] }],
  ]);
}

export function interleavedRunFixture(): AdapterInput {
  const calls = ["call_create_1", "call_create_2"];
  return eventStream([
    ...calls.map((toolCallId) => ["tools", { event: "on_tool_start", name: "create_dashboard", toolCallId, input: createArgs }]),
    ["tools", { event: "on_tool_event", name: "create_dashboard", toolCallId: calls[0], input: createArgs, data: { progress: "starting" } }],
    ["tools", { event: "on_tool_end", name: "create_dashboard", toolCallId: calls[1], input: createArgs, output: "second-reference" }],
    ["tools", { event: "on_tool_end", name: "create_dashboard", toolCallId: calls[0], input: createArgs, output: reference }],
    ["values", { messages: [] }],
  ]);
}

/** Finite fixture responses only; production streaming is owned by the official adapter. */
export async function readUIChunks(response: Response): Promise<UIMessageChunk[]> {
  return (await response.text())
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => JSON.parse(line.slice(6)) as UIMessageChunk);
}
