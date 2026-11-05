import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, isLocalMode, staffTable } from "@workspace/db";
import { getLocalSessionUserId } from "./localSession";

export type AppRole = "owner" | "manager" | "cashier" | "warehouse" | "purchasing";
export const operationalRoles: AppRole[] = ["owner", "manager", "warehouse", "purchasing"];
export type AppStaff = typeof staffTable.$inferSelect;

export async function ensureCurrentStaff(userId: string): Promise<AppStaff> {
  const clerkUser = await clerkClient.users.getUser(userId);
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    "";
  const configuredOwnerEmail = process.env.NASAEM_OWNER_EMAIL?.trim().toLowerCase();
  const verifiedPrimaryEmail =
    clerkUser.primaryEmailAddress?.emailAddress.trim().toLowerCase();
  const isConfiguredOwner =
    Boolean(configuredOwnerEmail) &&
    verifiedPrimaryEmail === configuredOwnerEmail &&
    clerkUser.primaryEmailAddress?.verification?.status === "verified";
  const displayName =
    clerkUser.fullName?.trim() ||
    clerkUser.username?.trim() ||
    email.split("@")[0] ||
    "مستخدم";

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(48192017)`);
    const [existing] = await tx
      .select()
      .from(staffTable)
      .where(eq(staffTable.clerkUserId, userId))
      .limit(1);

    if (existing) {
      const [updated] = await tx
        .update(staffTable)
        .set({
          displayName,
          email,
          ...(isConfiguredOwner
            ? { role: "owner" as const, isActive: true, approvalPending: false }
            : {}),
        })
        .where(eq(staffTable.clerkUserId, userId))
        .returning();
      return updated;
    }

    const [owner] = await tx
      .select({ clerkUserId: staffTable.clerkUserId })
      .from(staffTable)
      .where(eq(staffTable.role, "owner"))
      .limit(1);
    const isFirstUnconfiguredOwner = !owner && !configuredOwnerEmail;
    const isOwner = isConfiguredOwner || isFirstUnconfiguredOwner;
    const role: AppRole = isOwner ? "owner" : "cashier";
    const [created] = await tx
      .insert(staffTable)
      .values({
        clerkUserId: userId,
        displayName,
        email,
        role,
        isActive: isOwner,
        approvalPending: !isOwner,
      })
      .returning();
    return created;
  });
}

export function requireAppUser(
  req: Request,
  res: Response,
): string | undefined {
  const userId = isLocalMode
    ? getLocalSessionUserId(req)
    : getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
    return undefined;
  }
  return userId;
}

export async function requireAppRole(
  allowedRoles: AppRole[],
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = requireAppUser(req, res);
  if (!userId) return;

  const [staff] = await db
    .select()
    .from(staffTable)
    .where(
      and(
        eq(staffTable.clerkUserId, userId),
        inArray(staffTable.role, allowedRoles),
      ),
    )
    .limit(1);
  if (!staff) {
    res.status(403).json({ error: "ليس لديك صلاحية لتنفيذ هذا الإجراء" });
    return;
  }
  if (!staff.isActive) {
    res.status(403).json({ error: "حسابك ينتظر موافقة صاحب المتجر" });
    return;
  }

  res.locals.currentStaff = staff;
  next();
}

export async function requireActiveStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = requireAppUser(req, res);
  if (!userId) return;
  try {
    const [found] = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.clerkUserId, userId))
      .limit(1);
    const staff = found ?? (isLocalMode ? undefined : await ensureCurrentStaff(userId));
    if (!staff) {
      res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
      return;
    }
    if (!staff.isActive) {
      res.status(403).json({ error: "حسابك ينتظر موافقة صاحب المتجر" });
      return;
    }
    res.locals.currentStaff = staff;
    next();
  } catch (error) {
    req.log.error({ err: error }, "Could not establish app staff session");
    res.status(503).json({ error: "تعذر التحقق من صلاحيات الحساب" });
  }
}

export function asAppUser(staff: AppStaff) {
  return {
    id: staff.clerkUserId,
    displayName: staff.displayName,
    email: staff.email,
    role: staff.role as AppRole,
    active: staff.isActive,
    pendingApproval: staff.approvalPending ?? !staff.isActive,
    createdAt: staff.createdAt,
  };
}
