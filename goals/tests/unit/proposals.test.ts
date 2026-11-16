import { describe, expect, it } from "vitest";
import { proposalsFromToolCall } from "@/lib/ai/proposals";
import { PROPOSAL_TOOLS } from "@/lib/ai/tools";
import { closeDanglingToolUses, toApiMessages } from "@/lib/ai/history";

const PROJECT = "7b0f3c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f";

describe("proposal tools", () => {
  it("exposes only propose_* tools, all with eager input streaming", () => {
    expect(PROPOSAL_TOOLS.length).toBeGreaterThan(0);
    for (const t of PROPOSAL_TOOLS) {
      expect(t.name.startsWith("propose_")).toBe(true);
      expect(t.eager_input_streaming).toBe(true);
      expect(t.input_schema.type).toBe("object");
      expect(JSON.stringify(t.input_schema)).not.toContain("$schema");
    }
    expect(PROPOSAL_TOOLS.some((t) => /delete|remove/.test(t.name))).toBe(false);
  });

  it("fans create_tasks out into one pending proposal per task", () => {
    const r = proposalsFromToolCall("propose_create_tasks", {
      rationale: "Dividir el proyecto",
      tasks: [
        { title: "A", description: null, project_id: PROJECT, priority: "high", due_date: null, scheduled_date: "2026-11-17", estimated_minutes: 30 },
        { title: "B", description: null, project_id: null, priority: "low", due_date: null, scheduled_date: null, estimated_minutes: null },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows).toHaveLength(2);
      expect(r.rows[0]).toMatchObject({ action: "create_task", summary: "Crear tarea «A»", rationale: "Dividir el proyecto" });
    }
  });

  it("rejects malformed or truncated tool input instead of storing it", () => {
    expect(proposalsFromToolCall("propose_create_tasks", { tasks: [] }).ok).toBe(false);
    expect(proposalsFromToolCall("propose_create_project", { title: "X" }).ok).toBe(false);
    expect(
      proposalsFromToolCall("propose_create_project", {
        title: "X", description: null, goal_id: "made-up-id", status: "active", priority: "high", due_date: null, rationale: "r",
      }).ok,
    ).toBe(false);
  });

  it("keeps only real changes in updates and checks the status per entity", () => {
    const base = { entity: "task", id: PROJECT, rationale: "r", changes: { title: null, description: null, status: "completed", priority: null, due_date: null, scheduled_date: null } };
    const ok = proposalsFromToolCall("propose_update", base);
    expect(ok.ok && ok.rows[0]).toMatchObject({ action: "update_task", target_id: PROJECT, payload: { entity: "task", changes: { status: "completed" } } });
    expect(proposalsFromToolCall("propose_update", { ...base, changes: { ...base.changes, status: "archived" } }).ok).toBe(false);
    expect(proposalsFromToolCall("propose_update", { ...base, changes: { ...base.changes, status: null } }).ok).toBe(false);
  });
});

describe("conversation history", () => {
  it("replays stored turns unchanged and drops the context of an unanswered turn", () => {
    const rows = [
      { id: "1", role: "user", content: "hola", api_content: [{ role: "user", content: "hola" }, { role: "system", content: "ctx1" }] },
      { id: "2", role: "assistant", content: "¡Hola!", api_content: [{ role: "assistant", content: [{ type: "text", text: "¡Hola!" }] }] },
      { id: "3", role: "user", content: "¿y ahora?", api_content: [{ role: "user", content: "¿y ahora?" }, { role: "system", content: "ctx2" }] },
    ];
    const msgs = toApiMessages(rows);
    expect(msgs.map((m) => m.role)).toEqual(["user", "system", "assistant", "user"]);
  });

  it("answers dangling tool calls so the next request is valid", () => {
    const turn: Parameters<typeof closeDanglingToolUses>[0] = [
      { role: "assistant", content: [{ type: "tool_use", id: "toolu_1", name: "propose_create_idea", input: {} }] },
    ];
    closeDanglingToolUses(turn);
    expect(turn).toHaveLength(2);
    expect(turn[1]).toMatchObject({ role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", is_error: true }] });
  });
});
