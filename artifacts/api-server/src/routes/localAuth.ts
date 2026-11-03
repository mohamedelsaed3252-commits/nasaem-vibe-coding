import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  LoginLocalAccountBody,
  LoginLocalAccountResponse,
  RegisterLocalAccountBody,
  RegisterLocalAccountResponse,
} from "@workspace/api-zod";
import {
  db,
  isLocalMode,
  localCredentialsTable,
  staffTable,
} from "@workspace/db";
import { clearLocalSession, setLocalSession } from "../middlewares/localSession";

const router: IRouter = Router();
const scryptAsync = promisify(scrypt);
let registrationQueue: Promise<void> = Promise.resolve();

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const key = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}.${key.toString("base64url")}`;
}

async function matchesPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  const [salt, expectedText, extra] = passwordHash.split(".");
  if (!salt || !expectedText || extra) return false;
  const expected = Buffer.from(expectedText, "base64url");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function serializeRegistration<T>(task: () => Promise<T>): Promise<T> {
  const previous = registrationQueue;
  let release = (): void => {};
  registrationQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}

function localModeRequired(res: Response): boolean {
  if (isLocalMode) return true;
  res.status(404).json({ error: "المسار غير متاح في هذا التشغيل" });
  return false;
}

router.post("/auth/local/register", async (req, res): Promise<void> => {
  if (!localModeRequired(res)) return;
  const parsed = RegisterLocalAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const displayName = parsed.data.displayName.trim();
  if (!displayName) {
    res.status(400).json({ error: "اكتب اسمًا صالحًا للحساب" });
    return;
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const result = await serializeRegistration(() =>
      db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ userId: localCredentialsTable.userId })
          .from(localCredentialsTable)
          .where(eq(localCredentialsTable.email, email))
          .limit(1);
        if (existing) throw new Error("EMAIL_ALREADY_EXISTS");

        const [existingOwner] = await tx
          .select({ userId: staffTable.clerkUserId })
          .from(staffTable)
          .where(eq(staffTable.role, "owner"))
          .limit(1);
        const isFirstOwner = !existingOwner;
        const userId = `local-${randomUUID()}`;

        await tx.insert(staffTable).values({
          clerkUserId: userId,
          displayName,
          email,
          role: isFirstOwner ? "owner" : "cashier",
          isActive: isFirstOwner,
          approvalPending: !isFirstOwner,
        });
        await tx.insert(localCredentialsTable).values({
          userId,
          email,
          passwordHash,
        });
        return { userId, pending: !isFirstOwner };
      }),
    );

    if (!result.pending) setLocalSession(req, res, result.userId);
    res
      .status(201)
      .setHeader("Cache-Control", "no-store")
      .json(RegisterLocalAccountResponse.parse({ pending: result.pending }));
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
      res.status(409).json({ error: "يوجد حساب مسجل بهذا البريد الإلكتروني" });
      return;
    }
    req.log.error({ err: error }, "Could not register local shop account");
    res.status(500).json({ error: "تعذر إنشاء الحساب المحلي" });
  }
});

router.post("/auth/local/login", async (req, res): Promise<void> => {
  if (!localModeRequired(res)) return;
  const parsed = LoginLocalAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [credential] = await db
    .select()
    .from(localCredentialsTable)
    .where(eq(localCredentialsTable.email, email))
    .limit(1);
  if (!credential || !(await matchesPassword(parsed.data.password, credential.passwordHash))) {
    res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    return;
  }

  const [staff] = await db
    .select()
    .from(staffTable)
    .where(
      and(
        eq(staffTable.clerkUserId, credential.userId),
        eq(staffTable.isActive, true),
      ),
    )
    .limit(1);
  if (!staff) {
    res.status(403).json({ error: "حسابك ينتظر موافقة مالك المتجر" });
    return;
  }

  setLocalSession(req, res, staff.clerkUserId);
  res
    .setHeader("Cache-Control", "no-store")
    .json(LoginLocalAccountResponse.parse({ pending: false }));
});

router.post("/auth/local/logout", (req, res): void => {
  if (!localModeRequired(res)) return;
  clearLocalSession(req, res);
  res.status(204).end();
});

export default router;
