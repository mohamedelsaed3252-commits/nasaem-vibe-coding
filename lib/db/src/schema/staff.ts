import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const appRoleEnum = pgEnum("nasaem_app_role", [
  "owner",
  "manager",
  "cashier",
]);

export const staffTable = pgTable("nasaem_staff", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
  role: appRoleEnum("role").notNull().default("cashier"),
  isActive: boolean("is_active").notNull().default(false),
  approvalPending: boolean("approval_pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
