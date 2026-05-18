import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { opsUsersTable } from "./ops-users";

export const opsWebauthnCredentialsTable = pgTable("ops_webauthn_credentials", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => opsUsersTable.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  deviceType: text("device_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OpsWebauthnCredential = typeof opsWebauthnCredentialsTable.$inferSelect;
