import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";

class ScriptedChatModel extends BaseChatModel {
  constructor() { super({}); }

  _llmType() { return "scripted-dashboard-test"; }

  bindTools() { return this; }

  private answer(messages: BaseMessage[]): AIMessageChunk {
    const result = messages.filter(ToolMessage.isInstance).at(-1);
    return result
      ? new AIMessageChunk({ id: "scripted-answer", content: result.status === "error" ? "I couldn't create the dashboard." : "Your dashboard is ready." })
      : new AIMessageChunk({
          id: "scripted-call",
          content: "",
          tool_call_chunks: [{
            id: "call_create_1", name: "create_dashboard", index: 0,
            args: JSON.stringify({ title: "React health", prompt: "Show react downloads" }),
          }],
        });
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    return { generations: [{ message: this.answer(messages), text: "" }] };
  }

  async *_streamResponseChunks(messages: BaseMessage[]) {
    const message = this.answer(messages);
    yield new ChatGenerationChunk({ message, text: typeof message.content === "string" ? message.content : "" });
  }
}

export function createScriptedChatModel(): BaseChatModel {
  return new ScriptedChatModel();
}
