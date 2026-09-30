import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const rooms = pgTable("catboom_rooms", {
  code: text("code").primaryKey(),
  state: jsonb("state").notNull(),
  tokens: jsonb("tokens").notNull().$type<Record<string, string>>(),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
