import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("atendente"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  protocolId: text("protocol_id").notNull().unique(),
  status: text("status").notNull().default("novo"),
  nomeCompleto: text("nome_completo").notNull(),
  cpf: text("cpf").notNull(),
  whatsapp: text("whatsapp").notNull(),
  email: text("email").notNull(),
  oab: text("oab"),
  tipoNumeracao: text("tipo_numeracao").notNull(),
  numeroProcesso: text("numero_processo").notNull(),
  partes: text("partes").notNull(),
  segredoJustica: text("segredo_justica").notNull().default("nao"),
  observacao: text("observacao"),
  anexoName: text("anexo_name"),
  anexoSize: integer("anexo_size"),
  anexoType: text("anexo_type"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRequestSchema = createInsertSchema(requests).omit({ id: true, protocolId: true, createdAt: true, status: true });
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Request = typeof requests.$inferSelect;

export const observations = pgTable("observations", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  text: text("text").notNull(),
  authorName: text("author_name").notNull(),
  authorRole: text("author_role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertObservationSchema = createInsertSchema(observations).omit({ id: true, createdAt: true });
export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type Observation = typeof observations.$inferSelect;
