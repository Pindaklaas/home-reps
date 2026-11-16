#!/usr/bin/env node
/**
 * Local stand-in for the Anthropic Messages API, for end-to-end tests only.
 * Run the app with ANTHROPIC_BASE_URL=http://127.0.0.1:4010 and any
 * ANTHROPIC_API_KEY. It never calls the real API.
 *
 * Besides answering, it checks the request invariants the real API enforces
 * and answers 400 when the app breaks them:
 *  - every assistant tool_use is answered by a tool_result in the next message
 *  - a mid-conversation system message is last or followed by an assistant turn
 *  - the first message is a user message
 */
import { createServer } from "node:http";
import { appendFileSync, writeFileSync } from "node:fs";

const PORT = Number(process.env.MOCK_PORT ?? 4010);
const LOG = process.env.MOCK_LOG ?? "/tmp/mock-anthropic.log";
writeFileSync(LOG, "");

function invariantError(messages) {
  if (!messages.length || messages[0].role !== "user") return "first message must be user";
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "system") {
      const next = messages[i + 1];
      if (next && next.role !== "assistant") return `system message at ${i} must be last or followed by assistant`;
    }
    if (m.role === "assistant" && Array.isArray(m.content)) {
      const ids = m.content.filter((b) => b.type === "tool_use").map((b) => b.id);
      if (ids.length) {
        const next = messages[i + 1];
        const answered = new Set(
          (Array.isArray(next?.content) ? next.content : []).filter((b) => b.type === "tool_result").map((b) => b.tool_use_id),
        );
        for (const id of ids) if (!answered.has(id)) return `tool_use ${id} has no tool_result`;
      }
    }
  }
  return null;
}

const contextText = (body) =>
  [
    ...(Array.isArray(body.system) ? body.system.map((s) => s.text) : [body.system ?? ""]),
    ...body.messages.filter((m) => m.role === "system").map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))),
  ].join("\n");
const idsOf = (text, kind) => [...text.matchAll(new RegExp(`\\[${kind}:([0-9a-f-]{36})\\]`, "g"))].map((m) => m[1]);

function structured(body) {
  const props = Object.keys(body.output_config?.format?.schema?.properties ?? {});
  const ctx = contextText(body);
  const tasks = idsOf(ctx, "task");
  if (props.includes("reply")) return { ok: true, reply: "listo" };
  if (props.includes("verdict")) {
    return { verdict: "explore", score: 68, summary: "Idea prometedora pero sin validar con clientes reales.", fit_with_goals: "Encaja con el objetivo principal de ingresos.", strengths: ["Coste bajo"], risks: ["Demanda sin validar"], next_steps: ["Hablar con 5 clientes potenciales"], confidence: "medium", missing_information: ["Precio objetivo"] };
  }
  if (props.includes("headline")) {
    return { headline: "Cierra hoy la tarea más importante del objetivo principal.", why: "Es lo que más acerca tu objetivo principal.", focus_task_ids: tasks.slice(0, 2), warnings: ["Hay un proyecto sin objetivo vinculado."], avoid: "Abrir proyectos nuevos." };
  }
  if (props.includes("blocks")) {
    return {
      summary: "Dos bloques de foco y un descanso.",
      priorities: tasks.slice(0, 2).map((id) => ({ task_id: id, reason: "Empuja el objetivo principal" })),
      blocks: [
        { start: "09:00", minutes: 50, task_id: tasks[0] ?? null, label: "Foco 1" },
        { start: "09:50", minutes: 10, task_id: null, label: "Descanso" },
        { start: "10:00", minutes: 50, task_id: tasks[1] ?? null, label: "Foco 2" },
      ],
      total_minutes: 110,
      deferred_task_ids: [],
      notes: "",
    };
  }
  if (props.includes("wins")) {
    return { summary: "Semana con avances moderados.", wins: ["Tareas completadas"], misses: ["Sin tiempo registrado"], patterns: ["Muchas tareas sin proyecto"], focus_next_week: ["Objetivo principal"] };
  }
  return {};
}

function sse(res, events) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  for (const e of events) res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
  res.end();
}

function streamReply(res, body) {
  const last = body.messages[body.messages.length - 1];
  const afterTools = last.role === "user" && Array.isArray(last.content) && last.content.some((b) => b.type === "tool_result");
  const userText = [...body.messages].reverse().find((m) => m.role === "user" && typeof m.content === "string")?.content ?? "";
  const ctx = contextText(body);
  const projectId = idsOf(ctx, "project")[0] ?? null;
  const message = { id: `msg_${Date.now()}`, type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
  const events = [{ type: "message_start", message }];
  const text = (index, t) => {
    events.push({ type: "content_block_start", index, content_block: { type: "text", text: "" } });
    for (const chunk of t.match(/.{1,18}/gs)) events.push({ type: "content_block_delta", index, delta: { type: "text_delta", text: chunk } });
    events.push({ type: "content_block_stop", index });
  };

  if (afterTools) {
    text(0, "**He preparado 2 propuestas** para que las revises. Nada se ha aplicado todavía.\n\n- Primero, la tarea de investigación.\n- Después, el borrador.");
    events.push({ type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 40 } });
  } else if (/organ|divid|plan/i.test(userText)) {
    text(0, "Voy a dividirlo en pasos concretos.\n");
    const input = JSON.stringify({
      rationale: "Pasos pequeños y verificables para avanzar hoy.",
      tasks: [
        { title: "Investigar 3 competidores", description: null, project_id: projectId, priority: "high", due_date: null, scheduled_date: null, estimated_minutes: 45 },
        { title: "Escribir borrador de propuesta de valor", description: "Una página", project_id: projectId, priority: "medium", due_date: null, scheduled_date: null, estimated_minutes: 60 },
      ],
    });
    events.push({ type: "content_block_start", index: 1, content_block: { type: "tool_use", id: `toolu_${Date.now()}`, name: "propose_create_tasks", input: {} } });
    for (const chunk of input.match(/.{1,40}/gs)) events.push({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: chunk } });
    events.push({ type: "content_block_stop", index: 1 });
    events.push({ type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 120 } });
  } else {
    text(0, `Según tus datos, tu foco debería ser el **objetivo principal**. Recomendación: termina una tarea antes de abrir otra.`);
    events.push({ type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 30 } });
  }
  events.push({ type: "message_stop" });
  sse(res, events);
}

createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    if (req.method !== "POST" || !req.url.startsWith("/v1/messages")) {
      res.writeHead(404).end();
      return;
    }
    const body = JSON.parse(raw || "{}");
    const err = invariantError(body.messages ?? []);
    appendFileSync(
      LOG,
      JSON.stringify({
        url: req.url,
        beta: req.headers["anthropic-beta"],
        model: body.model,
        stream: Boolean(body.stream),
        fallbacks: body.fallbacks,
        effort: body.output_config?.effort,
        cache_control: body.cache_control,
        tools: (body.tools ?? []).map((t) => t.name),
        roles: (body.messages ?? []).map((m) => m.role),
        invariant_error: err,
      }) + "\n",
    );
    if (err) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: err } }));
      return;
    }
    if (body.stream) return streamReply(res, body);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: `msg_${Date.now()}`,
        type: "message",
        role: "assistant",
        model: body.model,
        content: [{ type: "text", text: JSON.stringify(structured(body)) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 900, output_tokens: 120 },
      }),
    );
  });
}).listen(PORT, "127.0.0.1", () => console.log(`mock anthropic on :${PORT}, log ${LOG}`));
