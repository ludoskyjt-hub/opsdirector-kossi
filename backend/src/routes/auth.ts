import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { hashPassword, comparePassword, generateToken, requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { logAudit } from "../lib/audit";

const ProfileUpdateBody = z.object({
  companyName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
});

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { companyName, ifu, email, password, phone, country } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    companyName,
    ifu,
    email,
    passwordHash,
    phone: phone ?? null,
    country: country ?? "BJ",
    role: "admin",
  }).returning();

  const token = generateToken(user.id);
  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      companyName: user.companyName,
      ifu: user.ifu,
      role: user.role,
      phone: user.phone,
      country: user.country,
      defaultCurrency: user.defaultCurrency ?? "XOF",
    },
    token,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = generateToken(user.id);
  void logAudit({ companyId: user.companyId ?? user.id, userId: user.id, action: "auth.login", entityType: "user", entityId: user.id, details: { email: user.email, role: user.role } });
  res.json({
    user: {
      id: user.id,
      email: user.email,
      companyName: user.companyName,
      ifu: user.ifu,
      role: user.role,
      phone: user.phone,
      country: user.country,
      defaultCurrency: user.defaultCurrency ?? "XOF",
    },
    token,
  });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ success: true });
});

router.patch("/auth/profile", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = ProfileUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [current] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!current) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // If changing password, require current password
  if (parsed.data.newPassword) {
    if (!parsed.data.currentPassword) {
      res.status(400).json({ error: "Current password required" });
      return;
    }
    const valid = await comparePassword(parsed.data.currentPassword, current.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "Current password incorrect" });
      return;
    }
  }

  // If changing email, check it's not already taken
  if (parsed.data.email && parsed.data.email !== current.email) {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
    if (existing) {
      res.status(400).json({ error: "Email already in use" });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.companyName) updates.companyName = parsed.data.companyName;
  if (parsed.data.email) updates.email = parsed.data.email;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (parsed.data.newPassword) updates.passwordHash = await hashPassword(parsed.data.newPassword);

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.userId!)).returning();

  res.json({
    id: updated.id,
    email: updated.email,
    companyName: updated.companyName,
    ifu: updated.ifu,
    role: updated.role,
    phone: updated.phone,
    country: updated.country,
    defaultCurrency: updated.defaultCurrency ?? "XOF",
  });
});

router.get("/auth/me", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    companyName: user.companyName,
    ifu: user.ifu,
    role: user.role,
    phone: user.phone,
    country: user.country,
    defaultCurrency: user.defaultCurrency ?? "XOF",
  });
});

export default router;
