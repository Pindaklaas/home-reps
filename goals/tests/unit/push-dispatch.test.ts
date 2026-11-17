import { beforeEach, describe, expect, it, vi } from "vitest";

const sendPush = vi.fn();
vi.mock("@/lib/push", () => ({ pushConfigured: () => true, sendPush: (...a: unknown[]) => sendPush(...a) }));
vi.mock("@/lib/env", () => ({ serverEnv: () => ({ PUSH_DISPATCH_SECRET: "s".repeat(40) }) }));

const { POST } = await import("@/app/api/notifications/dispatch/route");

const note = { endpoint: "https://push.example.test/abc", p256dh: "p", auth: "a", title: "Ahora: Quedar con Jorge", body: "16:00 · GOALS", url: "/planner" };
const req = (secret: string | null, body: unknown) =>
  new Request("https://x/api/notifications/dispatch", {
    method: "POST",
    headers: { "content-type": "application/json", ...(secret ? { "x-dispatch-secret": secret } : {}) },
    body: JSON.stringify(body),
  });

describe("push dispatch endpoint", () => {
  beforeEach(() => sendPush.mockReset());

  it("rejects a missing or wrong secret without sending anything", async () => {
    expect((await POST(req(null, { notifications: [note] }))).status).toBe(401);
    expect((await POST(req("wrong", { notifications: [note] }))).status).toBe(401);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("rejects malformed payloads", async () => {
    const res = await POST(req("s".repeat(40), { notifications: [{ ...note, endpoint: "http://insecure" }] }));
    expect(res.status).toBe(400);
  });

  it("sends each due reminder and reports subscriptions that are gone", async () => {
    sendPush.mockResolvedValueOnce("sent").mockResolvedValueOnce("gone");
    const res = await POST(req("s".repeat(40), { notifications: [note, { ...note, endpoint: "https://push.example.test/old" }] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1, gone: ["https://push.example.test/old"], failed: 0 });
    expect(sendPush).toHaveBeenCalledWith(expect.objectContaining({ endpoint: note.endpoint }), expect.objectContaining({ title: note.title }));
  });
});
