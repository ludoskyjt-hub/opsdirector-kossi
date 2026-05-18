import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { opsUsersTable } from "./ops-users";

export const opsIdeaStatusEnum = pgEnum("ops_idea_status", ["raw", "reviewed", "converted", "archived"]);

export const opsIdeasTable = pgTable("ops_ideas", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => opsUsersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  audioUrl: text("audio_url"),
  transcription: text("transcription"),
  projectId: integer("project_id"),
  status: opsIdeaStatusEnum("status").notNull().default("raw"),
  aiClassification: text("ai_classification"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OpsIdea = typeof opsIdeasTable.$inferSelect;
export type InsertOpsIdea = typeof opsIdeasTable.$inferInsert;
