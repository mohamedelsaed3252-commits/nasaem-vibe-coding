import { pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { staffTable } from "./staff";

export const localCredentialsTable = pgTable(
  "nasaem_local_credentials",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => staffTable.clerkUserId, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
  },
  (table) => [uniqueIndex("nasaem_local_credentials_email_idx").on(table.email)],
);
