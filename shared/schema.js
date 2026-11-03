import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Documenta o modelo de dados. A criação/migração real está em server/db.js (ensureSchema).
const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("operador_atendimento"),
  matricula: text("matricula"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
const insertUserSchema = createInsertSchema(users).omit({ id: true });

const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  protocolId: text("protocol_id").notNull().unique(),
  status: text("status").notNull().default("solicitado"),
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
  // Conteúdo do anexo em base64 (máx. 5 MB). Nunca é devolvido nas listagens.
  anexoData: text("anexo_data"),
  atendimentoResponsavelId: integer("atendimento_responsavel_id"),
  buscaResponsavelId: integer("busca_responsavel_id"),
  arquivamentoResponsavelId: integer("arquivamento_responsavel_id"),
  localizacaoFisica: text("localizacao_fisica"),
  motivo: text("motivo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
const insertRequestSchema = createInsertSchema(requests).omit({
  id: true,
  protocolId: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  anexoData: true
});

const observations = pgTable("observations", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  text: text("text").notNull(),
  authorName: text("author_name").notNull(),
  authorRole: text("author_role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
const insertObservationSchema = createInsertSchema(observations).omit({ id: true, createdAt: true });

// Trilha de auditoria: cada transição do fluxo.
const requestEvents = pgTable("request_events", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  acao: text("acao").notNull(),
  statusDe: text("status_de"),
  statusPara: text("status_para").notNull(),
  userId: integer("user_id"),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),
  nota: text("nota"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

const certidoes = pgTable("certidoes", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  tipo: text("tipo").notNull(),
  numero: text("numero").notNull().unique(),
  codigoVerificacao: text("codigo_verificacao").notNull().unique(),
  emitidaPor: integer("emitida_por"),
  dados: jsonb("dados").notNull(),
  emitidaEm: timestamp("emitida_em").notNull().defaultNow()
});

export {
  certidoes,
  insertObservationSchema,
  insertRequestSchema,
  insertUserSchema,
  observations,
  requestEvents,
  requests,
  users
};
