import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  opsConversationsTable, opsIdeasTable, opsMemoryEntriesTable, opsMessagesTable,
  opsProjectsTable, opsRemindersTable, opsTasksTable, opsUsersTable,
  type InsertOpsConversation, type InsertOpsIdea, type InsertOpsMemoryEntry,
  type InsertOpsMessage, type InsertOpsProject, type InsertOpsReminder,
  type InsertOpsTask, type OpsConversation, type OpsIdea, type OpsMemoryEntry,
  type OpsMessage, type OpsProject, type OpsReminder, type OpsTask,
} from "@workspace/db";
import bcrypt from "bcryptjs";

// ─── Users ────────────────────────────────────────────────────────────────────

export async function createOpsUser(email: string, password: string, name?: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  const rows = await db.insert(opsUsersTable).values({ email, passwordHash, name: name ?? null }).returning();
  return rows[0];
}

export async function getOpsUserByEmail(email: string) {
  return (await db.select().from(opsUsersTable).where(eq(opsUsersTable.email, email)).limit(1))[0] ?? null;
}

export async function getOpsUserById(id: number) {
  return (await db.select().from(opsUsersTable).where(eq(opsUsersTable.id, id)).limit(1))[0] ?? null;
}

export async function updateOpsUserPassword(email: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(opsUsersTable).set({ passwordHash }).where(eq(opsUsersTable.email, email));
}

export async function verifyOpsPassword(email: string, password: string) {
  const user = await (async () => {
    const rows = await db.select().from(opsUsersTable).where(eq(opsUsersTable.email, email)).limit(1);
    return rows[0] ?? null;
  })();
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getOpsProjects(userId: number): Promise<OpsProject[]> {
  return db.select().from(opsProjectsTable).where(eq(opsProjectsTable.userId, userId)).orderBy(desc(opsProjectsTable.updatedAt));
}

export async function getOpsProjectById(id: number, userId: number): Promise<OpsProject | undefined> {
  return (await db.select().from(opsProjectsTable).where(and(eq(opsProjectsTable.id, id), eq(opsProjectsTable.userId, userId))).limit(1))[0];
}

export async function createOpsProject(data: InsertOpsProject): Promise<number> {
  const rows = await db.insert(opsProjectsTable).values(data).returning({ id: opsProjectsTable.id });
  return rows[0].id;
}

export async function updateOpsProject(id: number, userId: number, data: Partial<InsertOpsProject>): Promise<void> {
  await db.update(opsProjectsTable).set({ ...data, updatedAt: new Date() }).where(and(eq(opsProjectsTable.id, id), eq(opsProjectsTable.userId, userId)));
}

export async function getOpsMonthlyPriorityCount(userId: number): Promise<number> {
  const rows = await db.select().from(opsProjectsTable).where(and(eq(opsProjectsTable.userId, userId), eq(opsProjectsTable.monthlyPriority, true)));
  return rows.length;
}

// ─── Ideas ────────────────────────────────────────────────────────────────────

export async function getOpsIdeas(userId: number): Promise<OpsIdea[]> {
  return db.select().from(opsIdeasTable).where(eq(opsIdeasTable.userId, userId)).orderBy(desc(opsIdeasTable.createdAt));
}

export async function createOpsIdea(data: InsertOpsIdea): Promise<number> {
  const rows = await db.insert(opsIdeasTable).values(data).returning({ id: opsIdeasTable.id });
  return rows[0].id;
}

export async function updateOpsIdea(id: number, userId: number, data: Partial<InsertOpsIdea>): Promise<void> {
  await db.update(opsIdeasTable).set({ ...data, updatedAt: new Date() }).where(and(eq(opsIdeasTable.id, id), eq(opsIdeasTable.userId, userId)));
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function getOpsConversations(userId: number): Promise<OpsConversation[]> {
  return db.select().from(opsConversationsTable).where(eq(opsConversationsTable.userId, userId)).orderBy(desc(opsConversationsTable.updatedAt));
}

export async function createOpsConversation(data: InsertOpsConversation): Promise<number> {
  const rows = await db.insert(opsConversationsTable).values(data).returning({ id: opsConversationsTable.id });
  return rows[0].id;
}

export async function updateOpsConversation(id: number, data: Partial<InsertOpsConversation>): Promise<void> {
  await db.update(opsConversationsTable).set({ ...data, updatedAt: new Date() }).where(eq(opsConversationsTable.id, id));
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getOpsMessages(conversationId: number, userId: number): Promise<OpsMessage[]> {
  return db.select().from(opsMessagesTable).where(and(eq(opsMessagesTable.conversationId, conversationId), eq(opsMessagesTable.userId, userId))).orderBy(opsMessagesTable.createdAt);
}

export async function createOpsMessage(data: InsertOpsMessage): Promise<number> {
  const rows = await db.insert(opsMessagesTable).values(data).returning({ id: opsMessagesTable.id });
  return rows[0].id;
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export async function getOpsMemoryEntries(userId: number, limit = 30): Promise<OpsMemoryEntry[]> {
  return db.select().from(opsMemoryEntriesTable).where(eq(opsMemoryEntriesTable.userId, userId)).orderBy(desc(opsMemoryEntriesTable.createdAt)).limit(limit);
}

export async function createOpsMemoryEntry(data: InsertOpsMemoryEntry): Promise<void> {
  await db.insert(opsMemoryEntriesTable).values(data);
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export async function getOpsReminders(userId: number): Promise<OpsReminder[]> {
  return db.select().from(opsRemindersTable).where(and(eq(opsRemindersTable.userId, userId), eq(opsRemindersTable.status, "pending"))).orderBy(opsRemindersTable.dueAt);
}

export async function createOpsReminder(data: InsertOpsReminder): Promise<number> {
  const rows = await db.insert(opsRemindersTable).values(data).returning({ id: opsRemindersTable.id });
  return rows[0].id;
}

export async function updateOpsReminder(id: number, userId: number, data: Partial<InsertOpsReminder>): Promise<void> {
  await db.update(opsRemindersTable).set({ ...data, updatedAt: new Date() }).where(and(eq(opsRemindersTable.id, id), eq(opsRemindersTable.userId, userId)));
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function getOpsTasks(userId: number): Promise<OpsTask[]> {
  return db.select().from(opsTasksTable).where(eq(opsTasksTable.userId, userId)).orderBy(desc(opsTasksTable.createdAt));
}

export async function createOpsTask(data: InsertOpsTask): Promise<number> {
  const rows = await db.insert(opsTasksTable).values(data).returning({ id: opsTasksTable.id });
  return rows[0].id;
}

export async function updateOpsTask(id: number, userId: number, data: Partial<InsertOpsTask>): Promise<void> {
  await db.update(opsTasksTable).set({ ...data, updatedAt: new Date() }).where(and(eq(opsTasksTable.id, id), eq(opsTasksTable.userId, userId)));
}
