import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface AuthenticatedRequest extends Request {
  userId?: number;
  userRole?: string;
  companyId?: number; // data-scope ID: companyId if employee/accountant, else own userId
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  if (!queryToken && (!authHeader || !authHeader.startsWith("Bearer "))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = queryToken ?? authHeader!.slice(7);
  const parts = token.split(":");
  if (parts.length < 2) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const userId = parseInt(parts[0], 10);
  if (isNaN(userId)) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  req.userId = user.id;
  req.userRole = user.role;
  req.companyId = user.companyId ?? user.id;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function requireAdminOrAccountant(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== "admin" && req.userRole !== "accountant") {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }
  next();
}

export function generateToken(userId: number): string {
  return `${userId}:${Date.now()}`;
}
