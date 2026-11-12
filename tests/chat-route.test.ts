import { ToolMessage } from "@langchain/core/messages";
import type { UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createArgs, createRunFixture, failedRunFixture, readUIChunks, reference } from "./helpers/chat-stream-fixtures";

const agent = vi.hoisted(() => ({ create: vi.fn(), stream: vi.fn() }));
vi.mock("@/agent/chat-agent", () => ({ createDashboardAgent: agent.create }));
vi.mock("@/lib/openui", () => ({ userId: () => "server-owner", baseUrl: "https://gateway.example" }));
// Keep the transport real, but make an accidental legacy execution fail before any network call.
vi.mock("ai", async (original) => ({
  ...await original<typeof import("ai")>(),
  streamText: () => { throw new Error("Legacy agent loop still in use"); },
}));
vi.mock("@/lib/toolkit", () => ({ default: {} }));

import { POST } from "@/app/api/chat/route";

const messages: UIMessage[] = [{ id: "user-1", role: "user", parts: [{ type: "text", text: "Create a React dashboard" }] }];
function request(body: unknown = { messages }, signal?: AbortSignal) {
  return new Request("http://localhost/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body), signal,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  // This non-credential sentinel is only a configuration-presence fixture; all execution is offline.
  vi.stubEnv("THESYS_API_KEY", "offline-test-sentinel");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected test network call")));
  agent.create.mockReturnValue({ stream: agent.stream });
  agent.stream.mockImplementation(() => createRunFixture());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Deep Agents chat route", () => {
  it("preserves the UI SSE contract and uses the server owner and bounded request signal", async () => {
    const req = request({ messages, userId: "untrusted-owner" });
    const response = await POST(req);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
    const chunks = await readUIChunks(response);
    expect(agent.create).toHaveBeenCalledExactlyOnceWith({ userId: "server-owner", signal: req.signal });
    expect(agent.stream).toHaveBeenCalledWith(expect.objectContaining({
      messages: [expect.objectContaining({ content: "Create a React dashboard" })],
    }), { streamMode: ["values", "messages"], recursionLimit: 24, signal: req.signal });
    expect(chunks).toContainEqual(expect.objectContaining({ type: "tool-output-available", toolCallId: "call_create_1", output: reference }));
    expect(chunks).toContainEqual(expect.objectContaining({ type: "text-delta", delta: "Dashboard ready." }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves completed tools from an existing local conversation", async () => {
    const history: UIMessage[] = [
      ...messages,
      { id: "assistant-1", role: "assistant", parts: [{ type: "tool-create_dashboard", toolCallId: "previous-call", state: "output-available", input: createArgs, output: reference }] },
      { id: "user-2", role: "user", parts: [{ type: "text", text: "Add a chart" }] },
    ];
    await readUIChunks(await POST(request({ messages: history })));
    const converted = agent.stream.mock.calls[0][0].messages as unknown[];
    expect(converted.filter(ToolMessage.isInstance)).toEqual([
      expect.objectContaining({ tool_call_id: "previous-call", content: reference }),
    ]);
  });

  it.each([
    "{not json", {}, { messages: null }, { messages: "invalid" }, { messages: [] },
    { messages: [{ id: "bad", role: "unknown", parts: [] }] },
    { messages: [{ id: "bad", role: "user", parts: [{ type: "text", text: 42 }] }] },
  ])("rejects malformed input before constructing an agent: %j", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid chat request." });
    expect(agent.create).not.toHaveBeenCalled();
  });

  it("reports missing configuration without invoking a model", async () => {
    vi.stubEnv("THESYS_API_KEY", "");
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Chat is not configured." });
    expect(agent.create).not.toHaveBeenCalled();
  });

  it("keeps tool errors distinct from successful artifact output", async () => {
    agent.stream.mockImplementation(() => failedRunFixture());
    const chunks = await readUIChunks(await POST(request()));
    expect(chunks).toContainEqual(expect.objectContaining({ type: "tool-output-error", toolCallId: "call_create_1" }));
    expect(chunks.some((chunk) => chunk.type === "tool-output-available")).toBe(false);
  });

  it("logs and sanitizes an agent setup failure", async () => {
    const error = new Error("Private setup diagnostics");
    agent.create.mockImplementation(() => { throw error; });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Chat request failed." });
    expect(console.error).toHaveBeenCalledExactlyOnceWith(expect.any(String), error);
  });

  it("logs and sanitizes failures while starting the graph stream", async () => {
    const error = new Error("Private provider diagnostics");
    agent.stream.mockRejectedValue(error);
    const chunks = await readUIChunks(await POST(request()));
    expect(chunks).toContainEqual({ type: "error", errorText: "Chat request failed." });
    expect(JSON.stringify(chunks)).not.toContain("Private");
    expect(console.error).toHaveBeenCalledExactlyOnceWith(expect.any(String), error);
  });

  it("logs and sanitizes error chunks emitted by the official adapter", async () => {
    const error = new Error("Private provider diagnostics");
    agent.stream.mockImplementation(() => new ReadableStream({ start(controller) { controller.error(error); } }));
    const chunks = await readUIChunks(await POST(request()));
    expect(chunks).toContainEqual({ type: "error", errorText: "Chat request failed." });
    expect(JSON.stringify(chunks)).not.toContain("Private");
    expect(console.error).toHaveBeenCalledExactlyOnceWith(expect.any(String), error.message);
  });

  it.each(["setup", "stream"])("does not log cancelled requests during %s", async (phase) => {
    const controller = new AbortController();
    agent[phase === "setup" ? "create" : "stream"].mockImplementation(() => {
      controller.abort();
      throw controller.signal.reason;
    });
    const response = await POST(request(undefined, controller.signal));
    await response.text();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("propagates cancellation without restarting the graph", async () => {
    const controller = new AbortController();
    agent.stream.mockImplementation((_input, { signal }: { signal: AbortSignal }) => new ReadableStream({
      start(output) { signal.addEventListener("abort", () => output.error(signal.reason), { once: true }); },
    }));
    const req = request(undefined, controller.signal);
    const response = await POST(req);
    const reading = readUIChunks(response);
    controller.abort();
    await reading;
    expect(req.signal.aborted).toBe(true);
    expect(agent.stream).toHaveBeenCalledTimes(1);
    expect(agent.stream.mock.calls[0][1].signal).toBe(req.signal);
    expect(console.error).not.toHaveBeenCalled();
  });
});
