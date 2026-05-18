import { Router, type IRouter } from "express";
import { db, usersTable, expoPushTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

router.get("/notifications/settings", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db
    .select({ emailNotificationsEnabled: usersTable.emailNotificationsEnabled })
    .from(usersTable)
    .where(eq(usersTable.id, req.companyId!));

  res.json({ emailNotificationsEnabled: user?.emailNotificationsEnabled ?? true });
});

router.put("/notifications/settings", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { emailNotificationsEnabled } = req.body as { emailNotificationsEnabled?: boolean };
  if (typeof emailNotificationsEnabled !== "boolean") {
    res.status(400).json({ error: "emailNotificationsEnabled must be boolean" });
    return;
  }

  await db
    .update(usersTable)
    .set({ emailNotificationsEnabled })
    .where(eq(usersTable.id, req.companyId!));

  res.json({ emailNotificationsEnabled });
});

router.post("/notifications/expo-token", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({ token: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "token is required" });
    return;
  }

  await db
    .insert(expoPushTokensTable)
    .values({ userId: req.userId!, token: parsed.data.token })
    .onConflictDoUpdate({
      target: expoPushTokensTable.token,
      set: { userId: req.userId!, updatedAt: new Date() },
    });

  res.status(201).json({ status: "registered" });
});

router.delete("/notifications/expo-token", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({ token: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "token is required" });
    return;
  }

  await db
    .delete(expoPushTokensTable)
    .where(eq(expoPushTokensTable.token, parsed.data.token));

  res.json({ status: "removed" });
});

export async function sendExpoNotification(
  userId: number,
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  const tokens = await db
    .select({ token: expoPushTokensTable.token })
    .from(expoPushTokensTable)
    .where(eq(expoPushTokensTable.userId, userId));

  if (tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: "default" as const,
  }));

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });
  } catch {
    // Non-blocking — push delivery is best-effort
  }
}

export default router;
