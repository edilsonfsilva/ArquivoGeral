import { randomInt, randomBytes } from "crypto";
import { pool } from "./db.js";
import {
  ACOES,
  STATUS,
  CERTIDAO_TIPOS,
  verificarAcao,
  podeSerResponsavelBusca,
  certidoesDisponiveis,
  renderModelo
} from "../shared/workflow.js";

// ------------------------------------------------------------------
// Utilitários de SQL
// ------------------------------------------------------------------
const q = async (sql, params = [], client = pool) => (await client.query(sql, params)).rows;
const one = async (sql, params, client) => (await q(sql, params, client))[0];

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Erro de regra de negócio com status HTTP (tratado em routes.js).
export class RegraError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.regra = true;
  }
}

const USER_COLS = `id, name, email, password, role, matricula, ativo, created_at AS "createdAt"`;

// Colunas do pedido. Dados pessoais de contato só para quem pode vê-los (P7).
const REQ_BASE = `
  r.id, r.protocol_id AS "protocolId", r.status, r.nome_completo AS "nomeCompleto",
  r.tipo_numeracao AS "tipoNumeracao", r.numero_processo AS "numeroProcesso", r.partes,
  r.comarca, r.vara_unidade AS "varaUnidade", r.segredo_justica AS "segredoJustica",
  r.localizacao_fisica AS "localizacaoFisica", r.motivo,
  r.atendimento_responsavel_id AS "atendimentoResponsavelId",
  r.busca_responsavel_id AS "buscaResponsavelId",
  r.arquivamento_responsavel_id AS "arquivamentoResponsavelId",
  ua.name AS "atendimentoResponsavel", ub.name AS "buscaResponsavel", uc.name AS "arquivamentoResponsavel",
  r.disponivel_em AS "disponivelEm", r.created_at AS "createdAt", r.updated_at AS "updatedAt"`;
const REQ_PESSOAL = `,
  r.cpf, r.whatsapp, r.email, r.oab, r.observacao,
  r.anexo_name AS "anexoName", r.anexo_size AS "anexoSize", r.anexo_type AS "anexoType"`;
const REQ_JOINS = `
  FROM requests r
  LEFT JOIN users ua ON ua.id = r.atendimento_responsavel_id
  LEFT JOIN users ub ON ub.id = r.busca_responsavel_id
  LEFT JOIN users uc ON uc.id = r.arquivamento_responsavel_id`;
const reqCols = (pessoal) => REQ_BASE + (pessoal ? REQ_PESSOAL : "");

// Horário local (Recife) para filtros de data e indicadores; o banco grava UTC.
const TZ = "America/Recife";
const inicioDoDiaLocal = (dataSql) => `((${dataSql})::timestamp AT TIME ZONE '${TZ}') AT TIME ZONE 'UTC'`;
const LOCAL = (col) => `((${col} AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}')`;
const AGORA_LOCAL = `(NOW() AT TIME ZONE '${TZ}')`;
export const STATUS_FINAIS = Object.keys(STATUS).filter((k) => STATUS[k].final);
export const LIMITE_FINAIS = 300;

const SOLICITANTE = { id: null, name: "Solicitante (formulário público)", role: "publico" };

class DatabaseStorage {
  // ---------------- Usuários ----------------
  getUser(id) {
    return one(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [id]);
  }
  getUserByEmail(email) {
    return one(`SELECT ${USER_COLS} FROM users WHERE email = $1`, [String(email).toLowerCase()]);
  }
  createUser({ name, email, password, role, matricula = null }) {
    return one(
      `INSERT INTO users (name, email, password, role, matricula) VALUES ($1, $2, $3, $4, $5) RETURNING ${USER_COLS}`,
      [name, String(email).toLowerCase(), password, role, matricula]
    );
  }
  async updateUser(id, data) {
    const map = { name: "name", email: "email", password: "password", role: "role", matricula: "matricula", ativo: "ativo" };
    const sets = [];
    const vals = [];
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        vals.push(k === "email" ? String(data[k]).toLowerCase() : data[k]);
        sets.push(`${col} = $${vals.length}`);
      }
    }
    if (!sets.length) return this.getUser(id);
    vals.push(id);
    return one(`UPDATE users SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING ${USER_COLS}`, vals);
  }
  // Encerra todas as sessões de um usuário (ex.: troca de senha feita por um gestor).
  async encerrarSessoes(userId, exceto) {
    await q(`DELETE FROM "session" WHERE (sess->>'userId')::int = $1 AND sid <> COALESCE($2, '')`, [userId, exceto ?? null]);
  }
  listUsers(roles) {
    if (roles) return q(`SELECT ${USER_COLS} FROM users WHERE role = ANY($1) ORDER BY ativo DESC, name`, [roles]);
    return q(`SELECT ${USER_COLS} FROM users ORDER BY ativo DESC, name`);
  }
  async countAtivos(role) {
    const row = await one(`SELECT COUNT(*)::int AS n FROM users WHERE role = $1 AND ativo`, [role]);
    return row.n;
  }

  // ---------------- Pedidos ----------------
  async createRequest(req) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const protocolId = `AG-${randomInt(100000, 1000000)}`;
      try {
        return await tx(async (c) => {
          const created = await one(
            `INSERT INTO requests (protocol_id, status, nome_completo, cpf, whatsapp, email, oab, tipo_numeracao,
               numero_processo, partes, comarca, vara_unidade, segredo_justica, observacao,
               anexo_name, anexo_size, anexo_type, anexo_data)
             VALUES ($1,'solicitado',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
             RETURNING id, protocol_id AS "protocolId", created_at AS "createdAt"`,
            [
              protocolId,
              req.nomeCompleto,
              req.cpf,
              req.whatsapp,
              req.email,
              req.oab ?? null,
              req.tipoNumeracao,
              req.numeroProcesso,
              req.partes,
              req.comarca,
              req.varaUnidade,
              req.segredoJustica,
              req.observacao ?? null,
              req.anexoName ?? null,
              req.anexoSize ?? null,
              req.anexoType ?? null,
              req.anexoData ?? null
            ],
            c
          );
          await this.#evento(c, created.id, "solicitar", null, "solicitado", SOLICITANTE, null);
          return created;
        });
      } catch (err) {
        if (err?.code === "23505" && String(err?.constraint || "").includes("protocol")) continue;
        throw err;
      }
    }
    throw new Error("Não foi possível gerar um protocolo único");
  }

  getRequest(id, { pessoal }) {
    return one(`SELECT ${reqCols(pessoal)} ${REQ_JOINS} WHERE r.id = $1`, [id]);
  }

  getRequestAnexo(id) {
    return one(`SELECT anexo_name AS name, anexo_type AS type, anexo_data AS data FROM requests WHERE id = $1`, [id]);
  }

  /**
   * Lista com escopo do perfil e filtros.
   * escopo: { pessoal, excluirStatus?: [], responsavelId?: n }
   */
  async listRequests(filtros = {}, escopo = {}) {
    const where = [];
    const vals = [];
    const p = (v) => {
      vals.push(v);
      return `$${vals.length}`;
    };
    if (escopo.excluirStatus?.length) where.push(`NOT (r.status = ANY(${p(escopo.excluirStatus)}))`);
    if (escopo.responsavelId) {
      const me = p(escopo.responsavelId);
      where.push(`(r.busca_responsavel_id = ${me} OR r.arquivamento_responsavel_id = ${me})`);
    }
    if (filtros.status) where.push(`r.status = ${p(filtros.status)}`);
    if (filtros.comarca) where.push(`(r.comarca ILIKE ${p("%" + filtros.comarca + "%")} OR r.vara_unidade ILIKE $${vals.length})`);
    if (filtros.operadorId) {
      const op = p(filtros.operadorId);
      where.push(`(r.atendimento_responsavel_id = ${op} OR r.busca_responsavel_id = ${op}
        OR r.arquivamento_responsavel_id = ${op}
        OR EXISTS (SELECT 1 FROM request_events e WHERE e.request_id = r.id AND e.user_id = ${op}))`);
    }
    // Dias do filtro no horário de Recife, convertidos para o UTC gravado no banco.
    if (filtros.de) where.push(`r.created_at >= ${inicioDoDiaLocal(`${p(filtros.de)}::date`)}`);
    if (filtros.ate) where.push(`r.created_at < ${inicioDoDiaLocal(`(${p(filtros.ate)}::date + 1)`)}`);
    if (filtros.q) {
      const like = p("%" + filtros.q + "%");
      const campos = [`r.protocol_id ILIKE ${like}`, `r.numero_processo ILIKE ${like}`, `r.partes ILIKE ${like}`, `r.nome_completo ILIKE ${like}`];
      if (escopo.pessoal) {
        campos.push(`r.oab ILIKE ${like}`);
        const digitos = filtros.q.replace(/\D/g, "");
        if (digitos.length >= 3) campos.push(`regexp_replace(r.cpf, '\\D', '', 'g') LIKE ${p("%" + digitos + "%")}`);
      }
      where.push(`(${campos.join(" OR ")})`);
    }
    // Pedidos em aberto vêm sempre completos (nenhuma fila pode perder pedido);
    // os finalizados vêm limitados aos LIMITE_FINAIS mais recentes.
    const base = `SELECT ${reqCols(escopo.pessoal)} ${REQ_JOINS} WHERE ${where.length ? where.join(" AND ") : "TRUE"}`;
    const iFinais = vals.length + 1;
    const [abertos, finais] = await Promise.all([
      q(`${base} AND NOT (r.status = ANY($${iFinais})) ORDER BY r.updated_at DESC`, [...vals, STATUS_FINAIS]),
      q(`${base} AND r.status = ANY($${iFinais}) ORDER BY r.updated_at DESC LIMIT ${LIMITE_FINAIS}`, [...vals, STATUS_FINAIS])
    ]);
    return [...abertos, ...finais];
  }

  getTimeline(id) {
    return q(
      `SELECT id, acao, status_de AS "statusDe", status_para AS "statusPara", user_name AS "userName",
              user_role AS "userRole", nota, created_at AS "createdAt"
       FROM request_events WHERE request_id = $1 ORDER BY created_at, id`,
      [id]
    );
  }

  async #evento(c, requestId, acao, de, para, user, nota) {
    await q(
      `INSERT INTO request_events (request_id, acao, status_de, status_para, user_id, user_name, user_role, nota)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [requestId, acao, de, para, user.id, user.name, user.role, nota],
      c
    );
  }

  /** Executa uma ação do fluxo com trava de linha (duas pessoas ao mesmo tempo → a segunda recebe 409). */
  aplicarAcao(id, acaoKey, user, dados) {
    return tx(async (c) => {
      const atual = await one(
        `SELECT id, status, segredo_justica AS "segredoJustica", busca_responsavel_id AS "buscaResponsavelId",
                arquivamento_responsavel_id AS "arquivamentoResponsavelId"
         FROM requests WHERE id = $1 FOR UPDATE`,
        [id],
        c
      );
      if (!atual) throw new RegraError(404, "Pedido não encontrado");
      const erro = verificarAcao(user.role, acaoKey, atual, user.id, dados);
      if (erro) {
        const status = /perfil|atribuído/.test(erro) ? 403 : /etapa/.test(erro) ? 409 : 400;
        throw new RegraError(status, erro);
      }
      const acao = ACOES[acaoKey];
      const sets = ["status = $1", "updated_at = NOW()"];
      const vals = [acao.para];
      const set = (col, v) => {
        vals.push(v);
        sets.push(`${col} = $${vals.length}`);
      };
      let nota = dados.nota || null;

      if (dados.responsavelId && acao.exige.includes("responsavelId")) {
        const resp = await one(`SELECT id, name, role, ativo FROM users WHERE id = $1`, [dados.responsavelId], c);
        if (!resp || !resp.ativo || !podeSerResponsavelBusca(resp.role)) {
          throw new RegraError(400, "Responsável inválido: escolha um usuário ativo da Busca");
        }
        set(acaoKey === "atribuir_busca" ? "busca_responsavel_id" : "arquivamento_responsavel_id", resp.id);
        nota = `Responsável: ${resp.name}${nota ? " — " + nota : ""}`;
      }
      if (acaoKey === "encaminhar_busca" || acaoKey === "indeferir") set("atendimento_responsavel_id", user.id);
      if (acaoKey === "indeferir" || acaoKey === "nao_localizar") set("motivo", dados.nota);
      // Nova busca: o motivo da não localização anterior fica só na linha do tempo.
      if (acaoKey === "nova_busca") sets.push("motivo = NULL");
      // Q7: o prazo de devolução começa quando o processo chega ao Atendimento.
      if (acaoKey === "receber") sets.push("disponivel_em = NOW()");
      // Q9: registra na trilha que a legitimidade foi conferida.
      if (acao.segredo && atual.segredoJustica === "sim") {
        nota = `Segredo de justiça: habilitação/procuração conferida${nota ? " — " + nota : ""}`;
      }
      if (acaoKey === "registrar_devolucao") {
        // P3: sugere para o arquivamento quem fez a busca.
        sets.push("arquivamento_responsavel_id = COALESCE(arquivamento_responsavel_id, busca_responsavel_id)");
      }
      if (dados.localizacao && (acaoKey === "localizar" || acaoKey === "arquivar")) {
        set("localizacao_fisica", dados.localizacao);
        nota = `Localização: ${dados.localizacao}${nota ? " — " + nota : ""}`;
      }
      vals.push(id, atual.status);
      await q(
        `UPDATE requests SET ${sets.join(", ")} WHERE id = $${vals.length - 1} AND status = $${vals.length}`,
        vals,
        c
      );
      await this.#evento(c, id, acaoKey, atual.status, acao.para, user, nota);
      return { id, status: acao.para };
    });
  }

  // ---------------- Observações ----------------
  getObservationsByRequest(requestId) {
    return q(
      `SELECT id, request_id AS "requestId", text, author_name AS "authorName", author_role AS "authorRole",
              created_at AS "createdAt"
       FROM observations WHERE request_id = $1 ORDER BY created_at DESC`,
      [requestId]
    );
  }
  createObservation({ requestId, text, authorName, authorRole }) {
    return one(
      `INSERT INTO observations (request_id, text, author_name, author_role) VALUES ($1,$2,$3,$4)
       RETURNING id, request_id AS "requestId", text, author_name AS "authorName", author_role AS "authorRole",
                 created_at AS "createdAt"`,
      [requestId, text, authorName, authorRole]
    );
  }

  // ---------------- Certidões ----------------
  emitirCertidao(requestId, tipo, user) {
    return tx(async (c) => {
      const r = await one(`SELECT ${reqCols(true)} ${REQ_JOINS} WHERE r.id = $1 FOR UPDATE OF r`, [requestId], c);
      if (!r) throw new RegraError(404, "Pedido não encontrado");
      if (!certidoesDisponiveis(r.status).includes(tipo)) {
        throw new RegraError(409, "Esta certidão não pode ser emitida nesta etapa do pedido");
      }
      const eventos = await q(
        `SELECT acao, status_para AS "statusPara", created_at AS "createdAt" FROM request_events
         WHERE request_id = $1 ORDER BY created_at, id`,
        [requestId],
        c
      );
      const quando = (acao) => eventos.filter((e) => e.acao === acao).at(-1)?.createdAt ?? null;
      const seq = await one(`SELECT nextval('certidao_seq')::int AS n`, [], c);
      const ano = new Date().getFullYear();
      const numero = `CERT-${ano}-${String(seq.n).padStart(6, "0")}`;
      const codigo = randomBytes(9).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X").slice(0, 12);
      const modelo = await this.getModelo(tipo, c);
      const dados = {
        tipo,
        titulo: modelo.titulo,
        texto: renderModelo(modelo.texto, r),
        protocolo: r.protocolId,
        numeroProcesso: r.numeroProcesso,
        tipoNumeracao: r.tipoNumeracao,
        partes: r.partes,
        comarca: r.comarca,
        varaUnidade: r.varaUnidade,
        requerente: r.nomeCompleto,
        situacao: STATUS[r.status].label,
        motivo: tipo === "nao_localizacao" ? r.motivo : null,
        localizacaoFisica: tipo === "arquivamento" ? r.localizacaoFisica : null,
        datas: {
          solicitacao: r.createdAt,
          localizacao: quando("localizar"),
          naoLocalizacao: quando("nao_localizar"),
          disponibilizacao: quando("receber"),
          arquivamento: quando("arquivar")
        },
        servidor: { nome: user.name, matricula: user.matricula || "—" }
      };
      const cert = await one(
        `INSERT INTO certidoes (request_id, tipo, numero, codigo_verificacao, emitida_por, dados)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, tipo, numero, codigo_verificacao AS "codigo", emitida_em AS "emitidaEm"`,
        [requestId, tipo, numero, codigo, user.id, dados],
        c
      );
      await this.#evento(c, requestId, "emitir_certidao", r.status, r.status, user, `${dados.titulo} ${numero}`);
      return cert;
    });
  }
  // ---------------- Modelos de certidão ----------------
  async getModelo(tipo, client) {
    const row = await one(`SELECT titulo, texto FROM certidao_modelos WHERE tipo = $1`, [tipo], client);
    return row || { titulo: CERTIDAO_TIPOS[tipo].label, texto: CERTIDAO_TIPOS[tipo].texto };
  }
  async listModelos() {
    const rows = await q(
      `SELECT tipo, titulo, texto, atualizado_por AS "atualizadoPor", atualizado_em AS "atualizadoEm" FROM certidao_modelos`
    );
    return Object.keys(CERTIDAO_TIPOS).map((tipo) => {
      const p = rows.find((r) => r.tipo === tipo);
      return {
        tipo,
        titulo: p?.titulo ?? CERTIDAO_TIPOS[tipo].label,
        texto: p?.texto ?? CERTIDAO_TIPOS[tipo].texto,
        personalizado: !!p,
        atualizadoPor: p?.atualizadoPor ?? null,
        atualizadoEm: p?.atualizadoEm ?? null,
        padrao: { titulo: CERTIDAO_TIPOS[tipo].label, texto: CERTIDAO_TIPOS[tipo].texto }
      };
    });
  }
  salvarModelo(tipo, { titulo, texto }, user) {
    return q(
      `INSERT INTO certidao_modelos (tipo, titulo, texto, atualizado_por) VALUES ($1, $2, $3, $4)
       ON CONFLICT (tipo) DO UPDATE SET titulo = EXCLUDED.titulo, texto = EXCLUDED.texto,
         atualizado_por = EXCLUDED.atualizado_por, atualizado_em = NOW()`,
      [tipo, titulo, texto, user.name]
    );
  }
  restaurarModelo(tipo) {
    return q(`DELETE FROM certidao_modelos WHERE tipo = $1`, [tipo]);
  }

  listCertidoes(requestId) {
    return q(
      `SELECT c.id, c.tipo, c.numero, c.codigo_verificacao AS "codigo", c.emitida_em AS "emitidaEm", u.name AS "emitidaPor"
       FROM certidoes c LEFT JOIN users u ON u.id = c.emitida_por WHERE c.request_id = $1 ORDER BY c.emitida_em DESC`,
      [requestId]
    );
  }
  getCertidao(id) {
    return one(
      `SELECT id, request_id AS "requestId", tipo, numero, codigo_verificacao AS "codigo", dados, emitida_em AS "emitidaEm"
       FROM certidoes WHERE id = $1`,
      [id]
    );
  }
  getCertidaoByCodigo(codigo) {
    return one(
      `SELECT tipo, numero, codigo_verificacao AS "codigo", dados, emitida_em AS "emitidaEm"
       FROM certidoes WHERE codigo_verificacao = $1`,
      [codigo]
    );
  }

  // ---------------- Consulta pública ----------------
  async consultaPublica(protocolo, cpfDigitos) {
    const r = await one(
      `SELECT id, protocol_id AS "protocolId", status, numero_processo AS "numeroProcesso",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM requests WHERE protocol_id = $1 AND regexp_replace(cpf, '\\D', '', 'g') = $2`,
      [protocolo, cpfDigitos]
    );
    if (!r) return null;
    const eventos = await q(
      `SELECT status_para AS "status", created_at AS "createdAt" FROM request_events
       WHERE request_id = $1 AND status_de IS DISTINCT FROM status_para ORDER BY created_at, id`,
      [r.id]
    );
    // Só rótulos públicos e datas: sem nomes de servidores nem notas internas.
    const linha = [];
    for (const e of eventos) {
      const publico = STATUS[e.status]?.publico;
      if (publico && linha.at(-1)?.situacao !== publico) linha.push({ situacao: publico, data: e.createdAt });
    }
    return {
      protocolo: r.protocolId,
      numeroProcesso: r.numeroProcesso,
      situacao: STATUS[r.status]?.publico,
      final: !!STATUS[r.status]?.final,
      solicitadoEm: r.createdAt,
      atualizadoEm: r.updatedAt,
      historico: linha
    };
  }

  // ---------------- Relatórios ----------------
  async relatorios({ pessoal, gestao }) {
    const [porStatus, porUnidade, porOperador, porMes, totais] = await Promise.all([
      q(`SELECT status, COUNT(*)::int AS total FROM requests GROUP BY status ORDER BY total DESC`),
      q(`SELECT comarca, vara_unidade AS "varaUnidade", COUNT(*)::int AS total FROM requests
         GROUP BY comarca, vara_unidade ORDER BY total DESC LIMIT 10`),
      q(`SELECT e.user_name AS nome, e.user_role AS role, COUNT(*)::int AS acoes,
                COUNT(DISTINCT e.request_id)::int AS pedidos
         FROM request_events e WHERE e.user_id IS NOT NULL
         GROUP BY e.user_name, e.user_role ORDER BY acoes DESC LIMIT 15`),
      q(`SELECT to_char(${LOCAL("created_at")}, 'YYYY-MM') AS mes, COUNT(*)::int AS total FROM requests
         WHERE ${LOCAL("created_at")} >= date_trunc('year', ${AGORA_LOCAL}) GROUP BY mes ORDER BY mes`),
      one(`SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE ${LOCAL("created_at")} >= date_trunc('day', ${AGORA_LOCAL}))::int AS hoje,
                  COUNT(*) FILTER (WHERE status = 'arquivado')::int AS concluidos,
                  COUNT(*) FILTER (WHERE status IN ('nao_localizado','encerrado'))::int AS nao_localizados,
                  ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)
                        FILTER (WHERE status = 'arquivado')::numeric, 1)::float AS dias_ciclo
           FROM requests`)
    ]);
    const solicitantes = pessoal
      ? await q(`SELECT nome_completo AS nome, oab, COUNT(*)::int AS total FROM requests
                 GROUP BY nome_completo, oab ORDER BY total DESC LIMIT 10`)
      : [];
    return { totais, porStatus, porUnidade, porOperador: gestao ? porOperador : [], porMes, solicitantes };
  }
}

const storage = new DatabaseStorage();
export { DatabaseStorage, storage };
