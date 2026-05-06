/**
 * Drizzle schema definitions.
 *
 * RLS policies are applied via migration SQL (see migrations/).
 * Drizzle doesn't model RLS in the schema, but the policies are critical —
 * they're what makes multi-tenancy safe.
 */
import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index("users_tenant_idx").on(t.tenantId),
  }),
);

export const dashboards = pgTable(
  "dashboards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    layout: jsonb("layout").notNull().$type<DashboardLayout>(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index("dashboards_tenant_idx").on(t.tenantId),
  }),
);

export const widgets = pgTable(
  "widgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    dashboardId: uuid("dashboard_id")
      .notNull()
      .references(() => dashboards.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // chart | table | metric | text
    config: jsonb("config").notNull().$type<Record<string, unknown>>(),
    position: jsonb("position").notNull().$type<{ x: number; y: number; w: number; h: number }>(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    dashboardIdx: index("widgets_dashboard_idx").on(t.dashboardId),
    tenantIdx: index("widgets_tenant_idx").on(t.tenantId),
  }),
);

export interface DashboardLayout {
  cols: number;
  rowHeight: number;
}
