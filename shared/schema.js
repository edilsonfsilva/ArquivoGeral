import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("atendente")
});
const insertUserSchema = createInsertSchema(users).omit({ id: true });
const requests = pgTable("requests", {
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
  comarca: text("comarca").notNull(),
  varaUnidade: text("vara_unidade").notNull(),
  segredoJustica: text("segredo_justica").notNull().default("nao"),
  observacao: text("observacao"),
  anexoName: text("anexo_name"),
  anexoSize: integer("anexo_size"),
  anexoType: text("anexo_type"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
const insertRequestSchema = createInsertSchema(requests).omit({ id: true, protocolId: true, createdAt: true, status: true });
const observations = pgTable("observations", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  text: text("text").notNull(),
  authorName: text("author_name").notNull(),
  authorRole: text("author_role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
const insertObservationSchema = createInsertSchema(observations).omit({ id: true, createdAt: true });
export {
  insertObservationSchema,
  insertRequestSchema,
  insertUserSchema,
  observations,
  requests,
  users
};
