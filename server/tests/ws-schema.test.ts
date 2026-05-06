/**
 * Tests for the WebSocket message schema.
 *
 * The schema is the security boundary for what clients can send.
 * Untyped JSON over a socket = a great way to get pwned.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

const ClientMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    dashboardId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("widget_update"),
    dashboardId: z.string().uuid(),
    widgetId: z.string().uuid(),
    patch: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal("cursor_move"),
    dashboardId: z.string().uuid(),
    x: z.number(),
    y: z.number(),
  }),
]);

const validUuid = "00000000-0000-4000-8000-000000000000";

describe("ClientMessage schema", () => {
  it("accepts a valid subscribe message", () => {
    const result = ClientMessage.safeParse({
      type: "subscribe",
      dashboardId: validUuid,
    });
    expect(result.success).toBe(true);
  });

  it("rejects subscribe with non-uuid dashboardId", () => {
    const result = ClientMessage.safeParse({
      type: "subscribe",
      dashboardId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid widget_update", () => {
    const result = ClientMessage.safeParse({
      type: "widget_update",
      dashboardId: validUuid,
      widgetId: validUuid,
      patch: { title: "new title", color: "#ff0000" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown message type", () => {
    const result = ClientMessage.safeParse({
      type: "delete_everything",
      dashboardId: validUuid,
    });
    expect(result.success).toBe(false);
  });

  it("rejects cursor_move with non-numeric coords", () => {
    const result = ClientMessage.safeParse({
      type: "cursor_move",
      dashboardId: validUuid,
      x: "100",
      y: 200,
    });
    expect(result.success).toBe(false);
  });
});
