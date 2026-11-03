import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não configurada");
}

// As colunas TIMESTAMP (sem fuso) guardam UTC (NOW() do Postgres em UTC): lê como UTC em qualquer fuso do servidor.
pg.types.setTypeParser(1114, (s) => new Date(s.replace(" ", "T") + "Z"));

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

    -- ---------- Fluxo Atendimento ↔ Busca (protótipo) ----------
    ALTER TABLE users ADD COLUMN IF NOT EXISTS matricula TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
    UPDATE users SET role = 'gerente_arquivo' WHERE role = 'admin';
    UPDATE users SET role = 'operador_atendimento' WHERE role = 'atendente';
    ALTER TABLE users ALTER COLUMN role SET DEFAULT 'operador_atendimento';

    ALTER TABLE requests ADD COLUMN IF NOT EXISTS atendimento_responsavel_id INTEGER REFERENCES users(id);
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS busca_responsavel_id INTEGER REFERENCES users(id);
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS arquivamento_responsavel_id INTEGER REFERENCES users(id);
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS localizacao_fisica TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS motivo TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
    UPDATE requests SET status = 'solicitado' WHERE status IN ('novo', 'em_analise');
    UPDATE requests SET status = 'aguardando_busca' WHERE status = 'aprovado';
    ALTER TABLE requests ALTER COLUMN status SET DEFAULT 'solicitado';
    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status);
    CREATE INDEX IF NOT EXISTS idx_requests_busca_resp ON requests (busca_responsavel_id);
    CREATE INDEX IF NOT EXISTS idx_requests_arq_resp ON requests (arquivamento_responsavel_id);

    CREATE TABLE IF NOT EXISTS request_events (
      id          SERIAL PRIMARY KEY,
      request_id  INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      acao        TEXT NOT NULL,
      status_de   TEXT,
      status_para TEXT NOT NULL,
      user_id     INTEGER REFERENCES users(id),
      user_name   TEXT NOT NULL,
      user_role   TEXT NOT NULL,
      nota        TEXT,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_events_request ON request_events (request_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_events_user ON request_events (user_id);

    CREATE SEQUENCE IF NOT EXISTS certidao_seq;
    CREATE TABLE IF NOT EXISTS certidoes (
      id                 SERIAL PRIMARY KEY,
      request_id         INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      tipo               TEXT NOT NULL,
      numero             TEXT NOT NULL UNIQUE,
      codigo_verificacao TEXT NOT NULL UNIQUE,
      emitida_por        INTEGER REFERENCES users(id),
      dados              JSONB NOT NULL,
      emitida_em         TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_certidoes_request ON certidoes (request_id);
  `);
}

export { db, pool, ensureSchema };
