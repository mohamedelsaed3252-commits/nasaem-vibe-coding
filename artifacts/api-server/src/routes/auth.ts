import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { GetCurrentUserResponse } from "@workspace/api-zod";
import { db, isLocalMode, staffTable } from "@workspace/db";
import {
  asAppUser,
  ensureCurrentStaff,
  requireAppUser,
} from "../middlewares/appAuth";

const router: IRouter = Router();

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = requireAppUser(req, res);
  if (!userId) return;

  try {
    const staff = isLocalMode
      ? (
          await db
            .select()
            .from(staffTable)
            .where(eq(staffTable.clerkUserId, userId))
            .limit(1)
        )[0]
      : await ensureCurrentStaff(userId);
    if (!staff) {
      res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
      return;
    }
    res.json(GetCurrentUserResponse.parse(asAppUser(staff)));
  } catch (error) {
    req.log.error({ err: error }, "Could not load signed-in staff profile");
    res.status(503).json({ error: "تعذر تحميل بيانات الحساب" });
  }
});

export default router;
