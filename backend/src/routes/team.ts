import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin, hashPassword, type AuthenticatedRequest } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

const safeUser = (u: typeof usersTable.$inferSelect) => ({
  id: u.id,
  email: u.email,
  companyName: u.companyName,
  role: u.role,
  phone: u.phone,
  country: u.country,
  createdAt: u.createdAt,
});

// GET /team/members — list all users in this company (admin + members)
router.get("/team/members", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [admin] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!admin) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const members = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.companyId, req.userId!));

  res.json([safeUser(admin), ...members.map(safeUser)]);
});

// POST /team/members — admin creates a new team member
router.post("/team/members", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["accountant", "employee"]),
    phone: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const [admin] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!admin) {
    res.status(404).json({ error: "Admin not found" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [user] = await db.insert(usersTable).values({
    email: parsed.data.email,
    passwordHash,
    companyName: admin.companyName,
    ifu: admin.ifu,
    phone: parsed.data.phone ?? null,
    country: admin.country,
    role: parsed.data.role,
    companyId: req.userId!,
  }).returning();

  res.status(201).json(safeUser(user));
});

// DELETE /team/members/:id — admin removes a team member
router.delete("/team/members/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  if (id === req.userId!) {
    res.status(400).json({ error: "Cannot remove yourself" });
    return;
  }

  const [member] = await db.select().from(usersTable).where(
    and(eq(usersTable.id, id), eq(usersTable.companyId, req.userId!))
  );

  if (!member) {
    res.status(404).json({ error: "Member not found or unauthorized" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

// PATCH /team/members/:id — admin updates member role
router.patch("/team/members/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const schema = z.object({ role: z.enum(["accountant", "employee"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [member] = await db.update(usersTable)
    .set({ role: parsed.data.role })
    .where(and(eq(usersTable.id, id), eq(usersTable.companyId, req.userId!)))
    .returning();

  if (!member) {
    res.status(404).json({ error: "Member not found or unauthorized" });
    return;
  }

  res.json(safeUser(member));
});

export default router;
