import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { createArgs, createRunFixture, failedRunFixture, interleavedRunFixture, readUIChunks, reference } from "./helpers/chat-stream-fixtures";

async function chunksFor(stream: Parameters<typeof toUIMessageStream>[0]) {
  return readUIChunks(createUIMessageStreamResponse({ stream: toUIMessageStream(stream) }));
}

describe("LangChain adapter dashboard protocol", () => {
  it("converts stored create/edit results without changing IDs or string content", async () => {
    const history: UIMessage[] = [
      { id: "user-1", role: "user", parts: [{ type: "text", text: "Create a dashboard" }] },
      { id: "assistant-1", role: "assistant", parts: [{ type: "tool-create_dashboard", toolCallId: "call_create_1", state: "output-available", input: createArgs, output: reference }] },
      { id: "user-2", role: "user", parts: [{ type: "text", text: "Add a chart" }] },
      { id: "assistant-2", role: "assistant", parts: [{ type: "tool-edit_dashboard", toolCallId: "call_edit_1", state: "output-available", input: { id: "art_fixture", prompt: "Add a chart" }, output: "edited-reference" }] },
    ];
    const converted = await toBaseMessages(history);
    const toolMessages = converted.filter(ToolMessage.isInstance);
    expect(toolMessages.map((message) => ({ id: message.tool_call_id, content: message.content }))).toEqual([
      { id: "call_create_1", content: reference },
      { id: "call_edit_1", content: "edited-reference" },
    ]);
    expect(converted.filter(AIMessage.isInstance).flatMap((message) => message.tool_calls ?? [])).toEqual([
      expect.objectContaining({ id: "call_create_1", name: "create_dashboard", args: createArgs }),
      expect.objectContaining({ id: "call_edit_1", name: "edit_dashboard", args: { id: "art_fixture", prompt: "Add a chart" } }),
    ]);
  });

  it("streams text, arguments and the unchanged dashboard reference", async () => {
    const chunks = await chunksFor(createRunFixture());
    expect(chunks).toContainEqual(expect.objectContaining({ type: "tool-input-available", toolCallId: "call_create_1", toolName: "create_dashboard", input: createArgs }));
    expect(chunks).toContainEqual(expect.objectContaining({ type: "tool-output-available", toolCallId: "call_create_1", output: reference }));
    expect(chunks).toContainEqual(expect.objectContaining({ type: "text-delta", delta: "Dashboard ready." }));
  });

  it("keeps interleaved results attached to their calls and progress preliminary", async () => {
    const chunks = await chunksFor(interleavedRunFixture());
    const outputs = chunks.filter((chunk) => chunk.type === "tool-output-available");
    expect(outputs.filter((chunk) => !chunk.preliminary)).toEqual([
      { type: "tool-output-available", toolCallId: "call_create_2", output: "second-reference" },
      { type: "tool-output-available", toolCallId: "call_create_1", output: reference },
    ]);
    expect(outputs.filter((chunk) => chunk.preliminary)).toEqual([
      { type: "tool-output-available", toolCallId: "call_create_1", output: { progress: "starting" }, preliminary: true },
    ]);
  });

  it("marks a failed tool as an error rather than successful artifact output", async () => {
    const chunks = await chunksFor(failedRunFixture());
    expect(chunks).toContainEqual({ type: "tool-output-error", toolCallId: "call_create_1", errorText: "Dashboard creation failed." });
    expect(chunks.some((chunk) => chunk.type === "tool-output-available")).toBe(false);
  });
});
