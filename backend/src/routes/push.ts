import { Router, type IRouter } from "express";
import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ?? "mailto:support@beninexpense.bj",
  process.env.VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
);

export async function sendPushToUser(userId: number, payload: object): Promise<void> {
  const subs = await db.select().from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        if (err && typeof err === "object" && "statusCode" in err) {
          const code = (err as { statusCode: number }).statusCode;
          if (code === 404 || code === 410) {
            await db.delete(pushSubscriptionsTable)
              .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
          }
        }
      }
    })
  );
}

router.get("/push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? "" });
});

router.post("/push/subscribe", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { endpoint, keys } = parsed.data;

  await db.insert(pushSubscriptionsTable)
    .values({ userId: req.userId!, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({ target: pushSubscriptionsTable.endpoint, set: { p256dh: keys.p256dh, auth: keys.auth } });

  res.status(201).json({ status: "subscribed" });
});

router.delete("/push/subscribe", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({ endpoint: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.delete(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, parsed.data.endpoint));
  res.json({ status: "unsubscribed" });
});

export default router;
