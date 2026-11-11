import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/openui", () => { throw new Error("Server dashboard services must not be imported by the browser toolkit"); });
vi.mock("@/lib/chat-agent", () => { throw new Error("The server agent must not be imported by the browser toolkit"); });

import toolkit from "@/lib/toolkit";

function props(toolName: string, isError = false): Parameters<typeof toolkit.create_dashboard.render>[0] {
  const args = { title: "React health", prompt: "Show downloads", id: "art_fixture" };
  return {
    type: "tool-call", toolName, toolCallId: "call_fixture", args, argsText: JSON.stringify(args),
    result: isError ? "Dashboard creation failed." : "opaque-reference", isError, status: { type: "complete" },
    addResult: () => {}, resume: () => {}, respondToApproval: async () => {},
  };
}

describe("browser dashboard tool registrations", () => {
  it.each(["create_dashboard", "edit_dashboard"] as const)("registers %s as a render-only backend tool", (name) => {
    const entry = toolkit[name];
    expect(entry.type).toBe("backend");
    expect(entry.display).toBe("standalone");
    expect("parameters" in entry).toBe(false);
    expect("description" in entry).toBe(false);
    expect("execute" in entry).toBe(false);
  });

  it("renders a completed create call as an openable dashboard card", () => {
    const html = renderToStaticMarkup(createElement(toolkit.create_dashboard.render!, props("create_dashboard")));
    expect(html).toContain("React health");
    expect(html).toContain("Open");
  });

  it("renders a completed edit call as an openable dashboard card", () => {
    const html = renderToStaticMarkup(createElement(toolkit.edit_dashboard.render!, props("edit_dashboard")));
    expect(html).toContain("React health");
    expect(html).toContain("Open");
  });

  it("renders failed tool calls as disabled cards rather than live artifacts", () => {
    const html = renderToStaticMarkup(createElement(toolkit.create_dashboard.render!, props("create_dashboard", true)));
    expect(html).toContain("Couldn&#x27;t start");
    expect(html).toContain("disabled");
    expect(html).not.toContain(">Live<");
  });
});
