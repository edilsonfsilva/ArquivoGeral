import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcrypt";
import { rateLimit } from "express-rate-limit";
import { ZodError } from "zod";
import { storage } from "./storage.js";
import { pool } from "./db.js";
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_BYTES,
  publicRequestSchema,
  acaoSchema,
  certidaoSchema,
  consultaSchema,
  listFiltersSchema,
  observationSchema,
  createUserSchema,
  updateUserSchema,
  loginSchema
} from "../shared/validation.js";
import {
  ROLES,
  setorDoPerfil,
  telaInicial,
  veDadosPessoais,
  acoesDisponiveis,
  podeEmitirCertidao,
  certidoesDisponiveis,
  perfisCriaveis,
  podeGerenciarUsuario,
  gerenciaUsuarios
} from "../shared/workflow.js";

const PgSession = connectPg(session);
const isProd = process.env.NODE_ENV === "production";
// Hash fictício usado quando o e-mail não existe (tempo de resposta igual ao de um usuário real).
const DUMMY_HASH = bcrypt.hashSync("usuario-inexistente", 12);
// Status que a Busca nunca vê (ainda na triagem do Atendimento ou indeferidos).
const FORA_DA_BUSCA = ["solicitado", "indeferido"];

// ------------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------------
function zodMessage(err) {
  return err.issues.map((i) => `${i.path.join(".") || "dados"}: ${i.message}`).join("; ");
}

// Executa o handler: validação → 400; regra de negócio → status próprio; o resto vira 500 genérico.
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    if (err instanceof ZodError) return res.status(400).json({ message: zodMessage(err) });
    if (err?.regra) return res.status(err.status).json({ message: err.message });
    next(err);
  }
};

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    matricula: u.matricula,
    ativo: u.ativo,
    setor: setorDoPerfil(u.role),
    tela: telaInicial(u.role)
  };
}

// Escopo de leitura de pedidos conforme o perfil (P2, P7).
function escopoDe(user) {
  if (veDadosPessoais(user.role)) return { pessoal: true };
  if (setorDoPerfil(user.role) === "busca") {
    return {
      pessoal: false,
      excluirStatus: FORA_DA_BUSCA,
      responsavelId: user.role === "operador_busca" ? user.id : undefined
    };
  }
  return null;
}

function dentroDoEscopo(pedido, escopo, userId) {
  if (!pedido || !escopo) return false;
  if (escopo.excluirStatus?.includes(pedido.status)) return false;
  if (escopo.responsavelId && pedido.buscaResponsavelId !== userId && pedido.arquivamentoResponsavelId !== userId) {
    return false;
  }
  return true;
}

// Confere o tipo real do arquivo pelos primeiros bytes ("magic bytes").
function sniffFileType(buf) {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}

function safeFileName(name) {
  return String(name || "anexo")
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "_")
    .slice(0, 120);
}

const limiterOpts = { standardHeaders: "draft-7", legacyHeaders: false };
const loginLimiter = rateLimit({
  ...limiterOpts,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  message: { message: "Muitas tentativas de login. Tente novamente em 15 minutos." }
});
const publicFormLimiter = rateLimit({
  ...limiterOpts,
  windowMs: 60 * 60 * 1000,
  // Configurável: na validação, várias pessoas da mesma rede (mesmo IP) testam o formulário.
  limit: Number(process.env.PUBLIC_FORM_LIMIT || 10),
  message: { message: "Limite de solicitações atingido. Tente novamente mais tarde." }
});
const consultaLimiter = rateLimit({
  ...limiterOpts,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: "Muitas consultas. Tente novamente em 15 minutos." }
});
const verificarLimiter = rateLimit({
  ...limiterOpts,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { message: "Muitas verificações. Tente novamente em 15 minutos." }
});
const apiLimiter = rateLimit({
  ...limiterOpts,
  windowMs: 60 * 1000,
  limit: 300,
  message: { message: "Muitas requisições. Aguarde um instante." }
});

// ------------------------------------------------------------------
// Rotas
// ------------------------------------------------------------------
async function registerRoutes(httpServer, app) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET ausente ou curto (mínimo de 32 caracteres)");
  }

  app.use(
    session({
      name: "tjpe.sid",
      store: new PgSession({ pool, createTableIfMissing: false }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        maxAge: 8 * 60 * 60 * 1e3,
        httpOnly: true,
        secure: isProd,
        sameSite: "strict"
      }
    })
  );

  app.use("/api", apiLimiter);

  await seedGerente();

  // Carrega o usuário do banco a cada requisição: perfil, desativação e exclusão valem na hora.
  async function requireAuth(req, res, next) {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ message: "Não autenticado" });
    const user = await storage.getUser(userId);
    if (!user || !user.ativo || !ROLES[user.role]) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Não autenticado" });
    }
    req.user = user;
    next();
  }
  const auth = handle(requireAuth);
  const requireRole = (pred, msg = "Acesso negado") => (req, res, next) =>
    pred(req.user.role) ? next() : res.status(403).json({ message: msg });

  // Carrega o pedido respeitando o escopo do perfil; fora do escopo responde 404 (não revela existência).
  async function carregarPedido(req, res) {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ message: "ID inválido" });
      return null;
    }
    const escopo = escopoDe(req.user);
    const pedido = escopo ? await storage.getRequest(id, { pessoal: escopo.pessoal }) : null;
    if (!dentroDoEscopo(pedido, escopo, req.user.id)) {
      res.status(404).json({ message: "Não encontrado" });
      return null;
    }
    return pedido;
  }

  app.get(
    "/api/health",
    handle(async (_req, res) => {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    })
  );

  // ---------------- Autenticação ----------------
  app.post(
    "/api/auth/login",
    loginLimiter,
    handle(async (req, res) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "E-mail e senha são obrigatórios" });
      const { email, password } = parsed.data;
      const user = await storage.getUserByEmail(email);
      // Compara mesmo sem usuário, para não revelar e-mails cadastrados pelo tempo de resposta.
      const hash = user?.password || DUMMY_HASH;
      const valid = await bcrypt.compare(password, hash);
      if (!user || !valid || !user.ativo || !ROLES[user.role]) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
      // Nova sessão a cada login (evita session fixation).
      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ message: "Erro ao iniciar sessão" });
        req.session.userId = user.id;
        req.session.save(() => res.json(publicUser(user)));
      });
    })
  );

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("tjpe.sid");
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", auth, (req, res) => res.json(publicUser(req.user)));

  // ---------------- Público: solicitação, consulta e verificação ----------------
  app.post(
    "/api/requests",
    publicFormLimiter,
    handle(async (req, res) => {
      const { anexo, ...data } = publicRequestSchema.parse(req.body);
      let anexoFields = { anexoName: null, anexoSize: null, anexoType: null, anexoData: null };
      if (anexo) {
        const buf = Buffer.from(anexo.base64, "base64");
        if (buf.length === 0 || buf.length > MAX_FILE_BYTES) {
          return res.status(400).json({ message: "Anexo vazio ou maior que 5 MB" });
        }
        const realType = sniffFileType(buf);
        if (!realType || !ACCEPTED_FILE_TYPES.includes(realType)) {
          return res.status(400).json({ message: "Anexo inválido. Envie PDF, PNG ou JPG." });
        }
        anexoFields = {
          anexoName: safeFileName(anexo.name),
          anexoSize: Math.ceil(buf.length / 1024),
          anexoType: realType,
          anexoData: buf.toString("base64")
        };
      }
      const created = await storage.createRequest({ ...data, ...anexoFields });
      return res.status(201).json({ protocolId: created.protocolId, createdAt: created.createdAt });
    })
  );

  app.post(
    "/api/consulta",
    consultaLimiter,
    handle(async (req, res) => {
      const { protocolo, cpf } = consultaSchema.parse(req.body);
      const r = await storage.consultaPublica(protocolo, cpf.replace(/\D/g, ""));
      if (!r) return res.status(404).json({ message: "Protocolo e CPF não conferem com nenhuma solicitação." });
      res.setHeader("Cache-Control", "no-store");
      return res.json(r);
    })
  );

  app.get(
    "/api/certidoes/verificar/:codigo",
    verificarLimiter,
    handle(async (req, res) => {
      const codigo = String(req.params.codigo || "").trim().toUpperCase();
      if (!/^[A-Z0-9]{12}$/.test(codigo)) return res.status(400).json({ message: "Código inválido" });
      const c = await storage.getCertidaoByCodigo(codigo);
      if (!c) return res.status(404).json({ message: "Nenhuma certidão encontrada com este código." });
      return res.json({
        valida: true,
        titulo: c.dados.titulo,
        numero: c.numero,
        emitidaEm: c.emitidaEm,
        protocolo: c.dados.protocolo,
        numeroProcesso: c.dados.numeroProcesso,
        servidor: c.dados.servidor?.nome
      });
    })
  );

  // ---------------- Pedidos (interno) ----------------
  app.get(
    "/api/requests",
    auth,
    handle(async (req, res) => {
      const escopo = escopoDe(req.user);
      if (!escopo) return res.status(403).json({ message: "Acesso negado" });
      const filtros = listFiltersSchema.parse(req.query);
      return res.json(await storage.listRequests(filtros, escopo));
    })
  );

  app.get(
    "/api/requests/:id",
    auth,
    handle(async (req, res) => {
      const pedido = await carregarPedido(req, res);
      if (!pedido) return;
      const [timeline, certidoes] = await Promise.all([
        storage.getTimeline(pedido.id),
        veDadosPessoais(req.user.role) ? storage.listCertidoes(pedido.id) : []
      ]);
      return res.json({
        ...pedido,
        timeline,
        certidoes,
        acoes: acoesDisponiveis(req.user.role, pedido, req.user.id),
        certidoesPermitidas: podeEmitirCertidao(req.user.role) ? certidoesDisponiveis(pedido.status) : []
      });
    })
  );

  app.post(
    "/api/requests/:id/acoes",
    auth,
    handle(async (req, res) => {
      const pedido = await carregarPedido(req, res);
      if (!pedido) return;
      const { acao, ...dados } = acaoSchema.parse(req.body);
      return res.json(await storage.aplicarAcao(pedido.id, acao, req.user, dados));
    })
  );

  app.get(
    "/api/requests/:id/anexo",
    auth,
    requireRole(veDadosPessoais),
    handle(async (req, res) => {
      const pedido = await carregarPedido(req, res);
      if (!pedido) return;
      const a = await storage.getRequestAnexo(pedido.id);
      if (!a?.data || !ACCEPTED_FILE_TYPES.includes(a.type)) {
        return res.status(404).json({ message: "Anexo não disponível" });
      }
      const buf = Buffer.from(a.data, "base64");
      res.setHeader("Content-Type", a.type);
      res.setHeader("Content-Length", buf.length);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeFileName(a.name)}"; filename*=UTF-8''${encodeURIComponent(a.name || "anexo")}`
      );
      res.setHeader("Cache-Control", "no-store");
      return res.end(buf);
    })
  );

  // Exclusão administrativa (limpeza de testes): só o Gerente. A interface não oferece exclusão.
  app.delete(
    "/api/requests/:id",
    auth,
    requireRole((r) => r === "gerente_arquivo"),
    handle(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "ID inválido" });
      await pool.query("DELETE FROM requests WHERE id = $1", [id]);
      return res.json({ ok: true });
    })
  );

  app.get(
    "/api/requests/:id/observations",
    auth,
    handle(async (req, res) => {
      const pedido = await carregarPedido(req, res);
      if (!pedido) return;
      return res.json(await storage.getObservationsByRequest(pedido.id));
    })
  );

  app.post(
    "/api/requests/:id/observations",
    auth,
    handle(async (req, res) => {
      const pedido = await carregarPedido(req, res);
      if (!pedido) return;
      const { text } = observationSchema.parse(req.body);
      const obs = await storage.createObservation({
        requestId: pedido.id,
        text,
        authorName: req.user.name,
        authorRole: req.user.role
      });
      return res.status(201).json(obs);
    })
  );

  // ---------------- Certidões ----------------
  app.post(
    "/api/requests/:id/certidoes",
    auth,
    requireRole(podeEmitirCertidao, "Somente servidores e chefe do Atendimento emitem certidões"),
    handle(async (req, res) => {
      const pedido = await carregarPedido(req, res);
      if (!pedido) return;
      const { tipo } = certidaoSchema.parse(req.body);
      return res.status(201).json(await storage.emitirCertidao(pedido.id, tipo, req.user));
    })
  );

  app.get(
    "/api/certidoes/:id",
    auth,
    requireRole(veDadosPessoais),
    handle(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "ID inválido" });
      const c = await storage.getCertidao(id);
      if (!c) return res.status(404).json({ message: "Não encontrado" });
      return res.json(c);
    })
  );

  // ---------------- Usuários (por setor) ----------------
  app.get(
    "/api/users",
    auth,
    requireRole((r) => gerenciaUsuarios(r)),
    handle(async (req, res) => {
      const roles = req.user.role === "gerente_arquivo" ? null : perfisCriaveis(req.user.role);
      return res.json((await storage.listUsers(roles)).map(publicUser));
    })
  );

  // Lista de quem pode receber uma busca/arquivamento (para o seletor de responsável).
  app.get(
    "/api/users/responsaveis-busca",
    auth,
    requireRole((r) => r === "chefe_busca" || r === "servidor_busca"),
    handle(async (_req, res) => {
      const lista = await storage.listUsers(["chefe_busca", "servidor_busca", "operador_busca"]);
      return res.json(lista.filter((u) => u.ativo).map((u) => ({ id: u.id, name: u.name, role: u.role })));
    })
  );

  app.post(
    "/api/users",
    auth,
    requireRole((r) => gerenciaUsuarios(r)),
    handle(async (req, res) => {
      const { name, email, password, role, matricula } = createUserSchema.parse(req.body);
      if (!perfisCriaveis(req.user.role).includes(role)) {
        return res.status(403).json({ message: "Seu perfil não pode cadastrar este tipo de usuário" });
      }
      if (await storage.getUserByEmail(email)) return res.status(409).json({ message: "E-mail já cadastrado" });
      const hashed = await bcrypt.hash(password, 12);
      const user = await storage.createUser({ name, email, password: hashed, role, matricula });
      return res.status(201).json(publicUser(user));
    })
  );

  app.patch(
    "/api/users/:id",
    auth,
    requireRole((r) => gerenciaUsuarios(r)),
    handle(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "ID inválido" });
      const body = updateUserSchema.parse(req.body);
      const target = await storage.getUser(id);
      if (!target || !podeGerenciarUsuario(req.user.role, target.role)) {
        return res.status(404).json({ message: "Não encontrado" });
      }
      // Fora dos perfis que cadastra (ex.: Gerente sobre operadores), só pode ativar/desativar.
      if (!perfisCriaveis(req.user.role).includes(target.role) && Object.keys(body).some((k) => k !== "ativo")) {
        return res.status(403).json({ message: "Para este usuário você só pode ativar ou desativar o acesso" });
      }
      if (body.role && body.role !== target.role && !perfisCriaveis(req.user.role).includes(body.role)) {
        return res.status(403).json({ message: "Seu perfil não pode atribuir este perfil" });
      }
      if (id === req.user.id && (body.ativo === false || (body.role && body.role !== target.role))) {
        return res.status(409).json({ message: "Você não pode desativar nem mudar o perfil do próprio usuário" });
      }
      const saiDeGerente =
        target.role === "gerente_arquivo" && (body.ativo === false || (body.role && body.role !== "gerente_arquivo"));
      if (saiDeGerente && target.ativo && (await storage.countAtivos("gerente_arquivo")) <= 1) {
        return res.status(409).json({ message: "É preciso manter ao menos um Gerente do Arquivo ativo" });
      }
      if (body.email && body.email !== target.email) {
        const other = await storage.getUserByEmail(body.email);
        if (other && other.id !== id) return res.status(409).json({ message: "E-mail já cadastrado" });
      }
      const data = {};
      for (const k of ["name", "email", "role", "matricula", "ativo"]) if (body[k] !== undefined) data[k] = body[k];
      if (body.password) data.password = await bcrypt.hash(body.password, 12);
      if (Object.keys(data).length === 0) return res.status(400).json({ message: "Nada para atualizar" });
      const updated = await storage.updateUser(id, data);
      if (data.password) await storage.encerrarSessoes(id, id === req.user.id ? req.sessionID : null);
      return res.json(publicUser(updated));
    })
  );

  // ---------------- Relatórios ----------------
  app.get(
    "/api/relatorios",
    auth,
    handle(async (req, res) => res.json(await storage.relatorios({
          pessoal: veDadosPessoais(req.user.role),
          gestao: ["gerente_arquivo", "chefe_atendimento", "chefe_busca"].includes(req.user.role)
        })))
  );

  // Rota /api inexistente: 404 em JSON (não cai no index.html do SPA).
  app.use("/api", (_req, res) => res.status(404).json({ message: "Não encontrado" }));

  return httpServer;
}

// Cria o Gerente do Arquivo inicial somente se as variáveis existirem. Não há credencial padrão no código.
async function seedGerente() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Gerente do Arquivo";
  if (!email || !password) {
    console.warn("[seed] ADMIN_EMAIL/ADMIN_PASSWORD não definidos: nenhum gerente inicial criado.");
    return;
  }
  if (password.length < 12) throw new Error("ADMIN_PASSWORD deve ter pelo menos 12 caracteres");
  if (!(await storage.getUserByEmail(email))) {
    const hashed = await bcrypt.hash(password, 12);
    await storage.createUser({ name, email, password: hashed, role: "gerente_arquivo", matricula: process.env.ADMIN_MATRICULA || null });
    console.log("[seed] Gerente do Arquivo inicial criado.");
  }
}

export { registerRoutes };
