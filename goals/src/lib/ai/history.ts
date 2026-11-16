import type Anthropic from "@anthropic-ai/sdk";


export type StoredMessage = {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  api_content: unknown;
};

/**
 * Rebuilds the API message list from stored rows. Rows are replayed exactly as
 * they were sent and received (append-only), which keeps earlier thinking
 * blocks valid and the cached prefix stable.
 *
 * A user row stores [user message, system context]. If that turn never got an
 * answer (a failed request), its system message is dropped: a mid-conversation
 * system message must be last or be followed by an assistant turn.
 */
export function toApiMessages(rows: StoredMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  rows.forEach((row, i) => {
    const stored = Array.isArray(row.api_content) ? (row.api_content as Anthropic.Beta.BetaMessageParam[]) : null;
    if (row.role === "user") {
      const answered = rows[i + 1]?.role === "assistant";
      const msgs = stored ?? [{ role: "user", content: row.content }];
      out.push(...(answered ? msgs : msgs.filter((m) => m.role !== "system")));
    } else if (row.role === "assistant") {
      out.push(...(stored?.length ? stored : [{ role: "assistant" as const, content: row.content || "…" }]));
    }
  });
  return out;
}

/**
 * Every tool_use needs a tool_result in the next message. When a turn stops
 * with tool calls that were not run (max_tokens, refusal, step limit, error),
 * answer them with an error result so the history stays valid.
 */
export function closeDanglingToolUses(turn: Anthropic.Beta.BetaMessageParam[]): void {
  const last = turn[turn.length - 1];
  if (!last || last.role !== "assistant" || !Array.isArray(last.content)) return;
  const pending = last.content.filter((b): b is Anthropic.Beta.BetaToolUseBlockParam => b.type === "tool_use");
  if (!pending.length) return;
  turn.push({
    role: "user",
    content: pending.map((b) => ({
      type: "tool_result" as const,
      tool_use_id: b.id,
      is_error: true,
      content: "No ejecutada: la respuesta se interrumpió antes de poder registrar esta propuesta.",
    })),
  });
}
