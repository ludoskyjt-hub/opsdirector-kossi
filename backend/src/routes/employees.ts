import { Router, type IRouter } from "express";
import { db, employeesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateEmployeeBody, ReimburseEmployeeParams, ReimburseEmployeeBody } from "@workspace/api-zod";
import { requireAuth, requireAdminOrAccountant, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/employees", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const employees = await db.select().from(employeesTable).where(eq(employeesTable.userId, req.companyId!));
  res.json(employees);
});

router.post("/employees", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [employee] = await db.insert(employeesTable).values({
    userId: req.companyId!,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    mobileMoneyProvider: (parsed.data.mobileMoneyProvider as "mtn_momo" | "moov_money" | undefined) ?? null,
    mobileMoneyNumber: parsed.data.mobileMoneyNumber ?? null,
  }).returning();

  res.status(201).json(employee);
});

router.post("/employees/:id/reimburse", requireAuth, requireAdminOrAccountant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = ReimburseEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ReimburseEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [employee] = await db.select().from(employeesTable).where(
    and(eq(employeesTable.id, params.data.id), eq(employeesTable.userId, req.companyId!))
  );

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const transactionId = `MM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  res.json({
    status: "initiated",
    transactionId,
    message: `Remboursement de ${parsed.data.amount} FCFA initié vers ${employee.mobileMoneyProvider ?? "Mobile Money"} (${employee.mobileMoneyNumber ?? employee.phone})`,
  });
});

export default router;
