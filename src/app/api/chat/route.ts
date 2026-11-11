import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import { createUIMessageStream, createUIMessageStreamResponse, validateUIMessages, type UIMessageChunk } from "ai";
import { createDashboardAgent } from "../../../lib/chat-agent";
import { userId } from "../../../lib/openui";

export const runtime = "nodejs";

const chatError = "Chat request failed.";

export async function POST(request: Request): Promise<Response> {
  let history: Awaited<ReturnType<typeof toBaseMessages>>;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("messages" in body) ||
        !Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json({ error: "Invalid chat request." }, { status: 400 });
    }
    const messages = await validateUIMessages({ messages: body.messages });
    history = await toBaseMessages(messages);
  } catch {
    return Response.json({ error: "Invalid chat request." }, { status: 400 });
  }

  if (!process.env.THESYS_API_KEY) {
    return Response.json({ error: "Chat is not configured." }, { status: 500 });
  }

  try {
    const agent = await createDashboardAgent({ userId: userId(), signal: request.signal });
    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }) => {
          const stream = await agent.stream(
            { messages: history },
            { streamMode: ["values", "messages"], signal: request.signal, recursionLimit: 24 },
          );
          writer.merge(toUIMessageStream(stream).pipeThrough(new TransformStream<UIMessageChunk, UIMessageChunk>({
            transform(chunk, controller) {
              // The adapter emits error chunks itself; the outer onError only catches rejections.
              if (chunk.type === "error" && !request.signal.aborted) {
                console.error("chat agent stream failed", chunk.errorText);
              }
              controller.enqueue(chunk.type === "error" ? { ...chunk, errorText: chatError } : chunk);
            },
          })));
        },
        onError: (error) => {
          if (!request.signal.aborted) console.error("chat ui stream failed", error);
          return chatError;
        },
      }),
    });
  } catch (error) {
    if (!request.signal.aborted) console.error("chat route failed", error);
    return Response.json({ error: chatError }, { status: 500 });
  }
}
