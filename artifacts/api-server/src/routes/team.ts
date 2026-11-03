import { Router, type IRouter } from "express";
import { and, count, eq } from "drizzle-orm";
import {
  ListTeamMembersResponse,
  UpdateTeamRoleBody,
  UpdateTeamRoleResponse,
} from "@workspace/api-zod";
import { db, staffTable } from "@workspace/db";
import { asAppUser, requireAppRole } from "../middlewares/appAuth";

const router: IRouter = Router();
const requireOwner = (
  req: Parameters<typeof requireAppRole>[1],
  res: Parameters<typeof requireAppRole>[2],
  next: Parameters<typeof requireAppRole>[3],
) => requireAppRole(["owner"], req, res, next);

router.get("/team", requireOwner, async (_req, res): Promise<void> => {
  const rows = await db.select().from(staffTable).orderBy(staffTable.createdAt);
  res.json(ListTeamMembersResponse.parse(rows.map(asAppUser)));
});

router.patch("/team", requireOwner, async (req, res): Promise<void> => {
  const parsed = UpdateTeamRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentStaff = res.locals.currentStaff as typeof staffTable.$inferSelect;
  const [target] = await db
    .select()
    .from(staffTable)
    .where(eq(staffTable.clerkUserId, parsed.data.userId))
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }

  const nextRole = parsed.data.role;
  const nextActive = parsed.data.active ?? target.isActive;
  if (
    target.role === "owner" &&
    target.isActive &&
    (nextRole !== "owner" || !nextActive)
  ) {
    const [activeOwners] = await db
      .select({ value: count() })
      .from(staffTable)
      .where(
        and(eq(staffTable.role, "owner"), eq(staffTable.isActive, true)),
      );
    if ((activeOwners?.value ?? 0) <= 1) {
      res.status(400).json({ error: "لا يمكن تعطيل أو خفض صلاحية آخر مالك" });
      return;
    }
  }
  if (
    currentStaff.clerkUserId === target.clerkUserId &&
    (nextRole !== "owner" || !nextActive)
  ) {
    res.status(400).json({ error: "لا يمكنك إزالة صلاحية المالك عن حسابك" });
    return;
  }

  const [updated] = await db
    .update(staffTable)
    .set({
      role: nextRole,
      isActive: nextActive,
      ...(nextActive ? { approvalPending: false } : {}),
    })
    .where(eq(staffTable.clerkUserId, target.clerkUserId))
    .returning();
  res.json(UpdateTeamRoleResponse.parse(asAppUser(updated)));
});

export default router;
