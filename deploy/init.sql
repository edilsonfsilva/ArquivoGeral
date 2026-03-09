-- ============================================================
-- TJPE Archive Assist — Script de inicialização do banco
-- Executado automaticamente pelo PostgreSQL na primeira inicialização
-- do container (docker-entrypoint-initdb.d).
-- ============================================================

-- Tabela de usuários do sistema (atendentes e administradores)
CREATE TABLE IF NOT EXISTS users (
  id       SERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  email    TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role     TEXT NOT NULL DEFAULT 'atendente'
);

-- Tabela de solicitações de desarquivamento
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
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de observações internas por solicitação
CREATE TABLE IF NOT EXISTS observations (
  id          SERIAL PRIMARY KEY,
  request_id  INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de sessões HTTP (connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid"    varchar NOT NULL COLLATE "default",
  "sess"   json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
