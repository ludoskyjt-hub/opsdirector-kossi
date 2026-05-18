import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { opsUsersTable } from "./ops-users";

export const opsProjectStatusEnum = pgEnum("ops_project_status", ["active", "paused", "completed", "archived"]);
export const opsProjectPriorityEnum = pgEnum("ops_project_priority", ["low", "medium", "high", "critical"]);
export const opsProjectPoleEnum = pgEnum("ops_project_pole", [
  "cosmetique_industrie", "agro_industrie", "retail_innovation",
  "culture_evenementiel", "institutionnel_diplomatie", "autre",
]);
export const opsSequenceStatusEnum = pgEnum("ops_sequence_status", ["idee", "planification", "execution", "monitoring"]);
export const opsStrategicHorizonEnum = pgEnum("ops_strategic_horizon", ["short_term", "medium_term", "long_term"]);

export const opsProjectsTable = pgTable("ops_projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => opsUsersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: opsProjectStatusEnum("status").notNull().default("active"),
  priority: opsProjectPriorityEnum("priority").notNull().default("medium"),
  color: text("color").default("#D4AF37"),
  pole: opsProjectPoleEnum("pole").notNull().default("autre"),
  sequenceStatus: opsSequenceStatusEnum("sequence_status").notNull().default("idee"),
  dependencyIndex: text("dependency_index"),
  location: text("location"),
  strategicHorizon: opsStrategicHorizonEnum("strategic_horizon").notNull().default("medium_term"),
  monthlyPriority: boolean("monthly_priority").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OpsProject = typeof opsProjectsTable.$inferSelect;
export type InsertOpsProject = typeof opsProjectsTable.$inferInsert;
