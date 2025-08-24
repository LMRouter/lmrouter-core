// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { sql } from "drizzle-orm";
import { jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export interface LedgerMetadata {
  type: string;
  data: Record<string, unknown>;
}

export const apiKey = pgTable("api_key", {
  id: text("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  ownerType: text("owner_type").notNull(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const balance = pgTable("balance", {
  id: text("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  ownerType: text("owner_type").notNull(),
  ownerId: text("owner_id").notNull(),
  balance: numeric("balance", { precision: 20, scale: 8 })
    .default("0")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const ledger = pgTable("ledger", {
  id: text("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  ownerType: text("owner_type").notNull(),
  ownerId: text("owner_id").notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  metadata: jsonb("metadata").$type<LedgerMetadata>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
