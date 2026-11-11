import { beforeEach, describe, expect, it, vi } from "vitest";

const cloud = vi.hoisted(() => ({ create: vi.fn(), edit: vi.fn() }));
const factories = vi.hoisted(() => ({ model: vi.fn(), agent: vi.fn() }));
vi.mock("@/lib/openui", () => ({ baseUrl: "https://gateway.example", dashboards: cloud }));
vi.mock("deepagents", () => ({ createDeepAgent: factories.agent }));
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: class {
    constructor(options: Record<string, unknown>) {
      const { apiKey: _secret, ...safeOptions } = options;
      factories.model(safeOptions);
    }
  },
}));

import { createDashboardAgent, createDashboardTools } from "@/lib/chat-agent";
import { dashboardToolContracts } from "@/lib/dashboard-tool-contracts";
import { chatPrompt } from "@/lib/prompt";

function context(userId = "owner-a") {
  return { userId, signal: new AbortController().signal };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  factories.agent.mockImplementation(() => ({}));
});

describe("dashboard tool boundary", () => {
  it.each([
    ["create_dashboard", { title: "React health", prompt: "Show downloads" }, { title: "", prompt: "Show downloads" }],
    ["edit_dashboard", { id: "art_fixture", prompt: "Add a chart" }, { id: "", prompt: "Add a chart" }],
  ] as const)("validates %s without tightening the existing whitespace rules", (name, valid, invalid) => {
    const schema = dashboardToolContracts[name].parameters;
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse(invalid).success).toBe(false);
    expect(schema.safeParse({ ...valid, prompt: "" }).success).toBe(false);
    expect(schema.safeParse(Object.fromEntries(Object.keys(valid).map((key) => [key, " "]))).success).toBe(true);
  });

  it("forwards create arguments, server owner and signal and returns an opaque string", async () => {
    const ctx = context();
    const args = { title: "React health", prompt: "Show downloads" };
    cloud.create.mockResolvedValue("opaque-create-reference");
    const tool = createDashboardTools(ctx).find((entry) => entry.name === "create_dashboard")!;
    expect(await tool.invoke(args)).toBe("opaque-create-reference");
    expect(cloud.create).toHaveBeenCalledExactlyOnceWith(args, { userId: "owner-a" }, { signal: ctx.signal });
  });

  it("forwards edit arguments without creating another dashboard", async () => {
    const ctx = context();
    const args = { id: "art_fixture", prompt: "Add a chart" };
    cloud.edit.mockResolvedValue("opaque-edit-reference");
    const tool = createDashboardTools(ctx).find((entry) => entry.name === "edit_dashboard")!;
    expect(await tool.invoke(args)).toBe("opaque-edit-reference");
    expect(cloud.edit).toHaveBeenCalledExactlyOnceWith(args, { userId: "owner-a" }, { signal: ctx.signal });
    expect(cloud.create).not.toHaveBeenCalled();
  });

  it("keeps concurrent owners and cancellation signals separate", async () => {
    const a = context("owner-a");
    const b = context("owner-b");
    cloud.create.mockResolvedValue("reference");
    await Promise.all([a, b].map((ctx) => createDashboardTools(ctx)[0].invoke({ title: "Health", prompt: "Show downloads" })));
    expect(cloud.create.mock.calls.map((call) => [call[1], call[2]])).toEqual([
      [{ userId: "owner-a" }, { signal: a.signal }],
      [{ userId: "owner-b" }, { signal: b.signal }],
    ]);
  });

  it("rejects invalid inputs before mutating a dashboard", async () => {
    await expect(createDashboardTools(context())[0].invoke({ title: "", prompt: "Show downloads" })).rejects.toThrow();
    expect(cloud.create).not.toHaveBeenCalled();
  });

  it("does not mutate after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(createDashboardTools({ userId: "owner-a", signal: controller.signal })[0].invoke({ title: "Health", prompt: "Show downloads" })).rejects.toThrow();
    expect(cloud.create).not.toHaveBeenCalled();
  });

  it("propagates cancellation into a pending dashboard request without retrying", async () => {
    const started = Promise.withResolvers<void>();
    const controller = new AbortController();
    cloud.create.mockImplementation((_args, _owner, { signal }: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      started.resolve();
    }));
    const pending = createDashboardTools({ userId: "owner-a", signal: controller.signal })[0].invoke({ title: "Health", prompt: "Show downloads" });
    const rejection = expect(pending).rejects.toThrow();
    await started.promise;
    controller.abort();
    await rejection;
    expect(cloud.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    [0, "create", { title: "Health", prompt: "Show downloads" }, "Dashboard creation failed."],
    [1, "edit", { id: "art_fixture", prompt: "Add a chart" }, "Dashboard edit failed."],
  ] as const)("sanitizes failed %s operations without replaying them", async (index, operation, args, message) => {
    cloud[operation].mockRejectedValue(new Error("Private upstream diagnostics"));
    await expect(createDashboardTools(context())[index].invoke(args)).rejects.toThrow(message);
    expect(cloud[operation]).toHaveBeenCalledTimes(1);
  });
});

describe("Deep Agent construction", () => {
  it("uses Gateway Chat Completions and the existing default model", () => {
    vi.stubEnv("OPENUI_MODEL", "");
    createDashboardAgent(context());
    expect(factories.model).toHaveBeenCalledWith({
      model: "anthropic/claude-sonnet-5.5", streaming: true, useResponsesApi: false,
      configuration: { baseURL: "https://gateway.example/v1/embed" },
    });
  });

  it("honors the configured model and creates independent ephemeral agents", () => {
    vi.stubEnv("OPENUI_MODEL", "configured/model");
    const a = createDashboardAgent(context("owner-a"));
    const b = createDashboardAgent(context("owner-b"));
    expect(a).not.toBe(b);
    expect(factories.model).toHaveBeenCalledWith(expect.objectContaining({ model: "configured/model" }));
    const options = factories.agent.mock.calls[0][0];
    expect(options.systemPrompt).toBe(chatPrompt);
    expect(options.tools.map((tool: { name: string }) => tool.name)).toEqual(["create_dashboard", "edit_dashboard"]);
    for (const option of ["backend", "checkpointer", "store", "skills", "subagents", "memory"]) expect(options[option]).toBeUndefined();
  });
});
