import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { opsUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { OpsUser } from "@workspace/db";

export type OpsContext = {
  req: Request;
  res: Response;
  user: OpsUser | null;
};

export async function createOpsContext({ req, res }: { req: Request; res: Response }): Promise<OpsContext> {
  let user: OpsUser | null = null;
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const parts = token.split(":");
    if (parts.length >= 2) {
      const userId = parseInt(parts[0], 10);
      if (!isNaN(userId)) {
        const rows = await db.select().from(opsUsersTable).where(eq(opsUsersTable.id, userId)).limit(1);
        user = rows[0] ?? null;
      }
    }
  }
  return { req, res, user };
}
