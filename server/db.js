import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não configurada");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
const db = drizzle(pool, { schema });

// Cria/atualiza as tabelas na subida (idempotente). Dispensa rodar init.sql à mão.
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id       SERIAL PRIMARY KEY,
      name     TEXT NOT NULL,
      email    TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role     TEXT NOT NULL DEFAULT 'atendente'
    );
    CREATE TABLE IF NOT EXISTS requests (
      id               SERIAL PRIMARY KEY,
      protocol_id      TEXT NOT NULL UNIQUE,
      status           TEXT NOT NULL DEFAULT 'novo',
      nome_completo    TEXT NOT NULL,
      cpf              TEXT NOT NULL,
      whatsapp         TEXT NOT NULL,
      email            TEXT NOT NULL,
      oab              TEXT,
      tipo_numeracao   TEXT NOT NULL,
      numero_processo  TEXT NOT NULL,
      partes           TEXT NOT NULL,
      comarca          TEXT NOT NULL DEFAULT '',
      vara_unidade     TEXT NOT NULL DEFAULT '',
      segredo_justica  TEXT NOT NULL DEFAULT 'nao',
      observacao       TEXT,
      anexo_name       TEXT,
      anexo_size       INTEGER,
      anexo_type       TEXT,
      anexo_data       TEXT,
      created_at       TIMESTAMP NOT NULL DEFAULT NOW()
    );
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS comarca TEXT NOT NULL DEFAULT '';
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS vara_unidade TEXT NOT NULL DEFAULT '';
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS anexo_data TEXT;
    CREATE TABLE IF NOT EXISTS observations (
      id          SERIAL PRIMARY KEY,
      request_id  INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      text        TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_observations_request ON observations (request_id);
    CREATE TABLE IF NOT EXISTS "session" (
      "sid"    varchar NOT NULL COLLATE "default",
      "sess"   json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `);
}

export { db, pool, ensureSchema };
