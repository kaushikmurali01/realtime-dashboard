/**
 * Dashboard CRUD routes.
 *
 * All queries go through `withTenant` to ensure RLS applies.
 */
import { type FastifyPluginAsync, type FastifyRequest } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { dashboards, widgets } from "../db/schema.js";
import { withTenant } from "../middleware/tenant.js";

const CreateDashboardBody = z.object({
  name: z.string().min(1).max(200),
  layout: z
    .object({ cols: z.number().int().positive(), rowHeight: z.number().positive() })
    .default({ cols: 12, rowHeight: 60 }),
});

interface AuthedRequest extends FastifyRequest {
  tenantId: string;
  userId: string;
}

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (req) => {
    const { tenantId } = req as AuthedRequest;
    return withTenant(tenantId, (tx) => tx.select().from(dashboards));
  });

  app.get("/:id", async (req, reply) => {
    const { tenantId } = req as AuthedRequest;
    const { id } = req.params as { id: string };

    return withTenant(tenantId, async (tx) => {
      const [dashboard] = await tx.select().from(dashboards).where(eq(dashboards.id, id));
      if (!dashboard) return reply.code(404).send({ error: "not found" });

      const dashWidgets = await tx
        .select()
        .from(widgets)
        .where(eq(widgets.dashboardId, id));

      return { ...dashboard, widgets: dashWidgets };
    });
  });

  app.post("/", async (req) => {
    const { tenantId, userId } = req as AuthedRequest;
    const body = CreateDashboardBody.parse(req.body);

    return withTenant(tenantId, async (tx) => {
      const [created] = await tx
        .insert(dashboards)
        .values({
          tenantId,
          name: body.name,
          layout: body.layout,
          createdBy: userId,
        })
        .returning();
      return created;
    });
  });

  app.delete("/:id", async (req, reply) => {
    const { tenantId } = req as AuthedRequest;
    const { id } = req.params as { id: string };

    return withTenant(tenantId, async (tx) => {
      const result = await tx.delete(dashboards).where(eq(dashboards.id, id)).returning();
      if (result.length === 0) return reply.code(404).send({ error: "not found" });
      return { deleted: true };
    });
  });
};
