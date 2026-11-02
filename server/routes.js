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
  adminUpdateRequestSchema,
  statusUpdateSchema,
  observationSchema,
  createUserSchema,
  updateUserSchema,
  loginSchema
} from "../shared/validation.js";

const PgSession = connectPg(session);
const isProd = process.env.NODE_ENV === "production";
// Hash fictício usado quando o e-mail não existe (tempo de resposta igual ao de um usuário real).
const DUMMY_HASH = bcrypt.hashSync("usuario-inexistente", 12);

// ------------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------------
function zodMessage(err) {
  return err.issues.map((i) => `${i.path.join(".") || "dados"}: ${i.message}`).join("; ");
}

// Executa o handler e converte erros de validação em 400; o resto vira 500 genérico.
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ message: zodMessage(err) });
    }
    next(err);
  }
};

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
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
  limit: 10,
  message: { message: "Limite de solicitações atingido. Tente novamente mais tarde." }
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

  await seedDefaultAdmin();

  // Carrega o usuário do banco a cada requisição: perfil e exclusão valem na hora.
  async function requireAuth(req, res, next) {
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ message: "Não autenticado" });
    const user = await storage.getUser(userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Não autenticado" });
    }
    req.user = user;
    next();
  }
  function requireAdmin(req, res, next) {
    if (req.user?.role !== "admin") return res.status(403).json({ message: "Acesso negado" });
    next();
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
      if (!user || !valid) return res.status(401).json({ message: "Credenciais inválidas" });
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

  app.get(
    "/api/auth/me",
    handle(requireAuth),
    (req, res) => res.json(publicUser(req.user))
  );

  // ---------------- Solicitações ----------------
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

  app.get(
    "/api/requests",
    handle(requireAuth),
    handle(async (_req, res) => res.json(await storage.getAllRequests()))
  );

  app.get(
    "/api/requests/:id",
    handle(requireAuth),
    handle(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "ID inválido" });
      const r = await storage.getRequest(id);
      if (!r) return res.status(404).json({ message: "Não encontrado" });
      return res.json(r);
    })
  );

  app.get(
    "/api/requests/:id/anexo",
    handle(requireAuth),
    handle(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "ID inválido" });
      const a = await storage.getRequestAnexo(id);
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

  // Atendente: só muda status. Admin: edita campos de negócio (nunca protocolo/data/anexo).
  app.patch(
    "/api/requests/:id",
    handle(requireAuth),
    handle(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "ID inválido" });
      const data =
        req.user.role === "admin" ? adminUpdateRequestSchema.parse(req.body) : statusUpdateSchema.parse(req.body);
      if (Object.keys(data).length === 0) return res.status(400).json({ message: "Nada para atualizar" });
      const updated = await storage.updateRequest(id, data);
      if (!updated) return res.status(404).json({ message: "Não encontrado" });
      return res.json(updated);
    })
  );

  app.delete(
    "/api/requests/:id",
    handle(requireAuth),
    requireAdmin,
    handle(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "ID inválido" });
      await storage.deleteRequest(id);
      return res.json({ ok: true });
    })
  );

  app.get(
    "/api/requests/:id/observations",
    handle(requireAuth),
    handle(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "ID inválido" });
      return res.json(await storage.getObservationsByRequest(id));
    })
  );

  app.post(
    "/api/requests/:id/observations",
    handle(requireAuth),
    handle(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "ID inválido" });
      const { text } = observationSchema.parse(req.body);
      const exists = await storage.getRequest(id);
      if (!exists) return res.status(404).json({ message: "Não encontrado" });
      const obs = await storage.createObservation({
        requestId: id,
        text,
        authorName: req.user.name,
        authorRole: req.user.role
      });
      return res.status(201).json(obs);
    })
  );

  // ---------------- Usuários (admin) ----------------
  app.get(
    "/api/users",
    handle(requireAuth),
    requireAdmin,
    handle(async (_req, res) => res.json((await storage.getAllUsers()).map(publicUser)))
  );

  app.post(
    "/api/users",
    handle(requireAuth),
    requireAdmin,
    handle(async (req, res) => {
      const { name, email, password, role } = createUserSchema.parse(req.body);
      if (await storage.getUserByEmail(email)) return res.status(409).json({ message: "E-mail já cadastrado" });
      const hashed = await bcrypt.hash(password, 12);
      const user = await storage.createUser({ name, email, password: hashed, role });
      return res.status(201).json(publicUser(user));
    })
  );

  app.patch(
    "/api/users/:id",
    handle(requireAuth),
    requireAdmin,
    handle(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "ID inválido" });
      const body = updateUserSchema.parse(req.body);
      const target = await storage.getUser(id);
      if (!target) return res.status(404).json({ message: "Não encontrado" });
      if (body.role === "atendente" && target.role === "admin" && (await storage.countAdmins()) <= 1) {
        return res.status(409).json({ message: "Não é possível rebaixar o único administrador" });
      }
      if (body.email && body.email !== target.email) {
        const other = await storage.getUserByEmail(body.email);
        if (other && other.id !== id) return res.status(409).json({ message: "E-mail já cadastrado" });
      }
      const data = {};
      if (body.name) data.name = body.name;
      if (body.email) data.email = body.email;
      if (body.role) data.role = body.role;
      if (body.password) data.password = await bcrypt.hash(body.password, 12);
      if (Object.keys(data).length === 0) return res.status(400).json({ message: "Nada para atualizar" });
      const updated = await storage.updateUser(id, data);
      return res.json(publicUser(updated));
    })
  );

  app.delete(
    "/api/users/:id",
    handle(requireAuth),
    requireAdmin,
    handle(async (req, res) => {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ message: "ID inválido" });
      if (id === req.user.id) return res.status(409).json({ message: "Você não pode remover o próprio usuário" });
      const target = await storage.getUser(id);
      if (!target) return res.status(404).json({ message: "Não encontrado" });
      if (target.role === "admin" && (await storage.countAdmins()) <= 1) {
        return res.status(409).json({ message: "Não é possível remover o único administrador" });
      }
      await storage.deleteUser(id);
      return res.json({ ok: true });
    })
  );

  app.get(
    "/api/dashboard",
    handle(requireAuth),
    requireAdmin,
    handle(async (_req, res) => res.json(await storage.getDashboardStats()))
  );

  // Rota /api inexistente: 404 em JSON (não cai no index.html do SPA).
  app.use("/api", (_req, res) => res.status(404).json({ message: "Não encontrado" }));

  return httpServer;
}

// Cria o admin inicial somente se as variáveis existirem. Não há credencial padrão no código.
async function seedDefaultAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || "Administrador";
  if (!adminEmail || !adminPassword) {
    console.warn("[seed] ADMIN_EMAIL/ADMIN_PASSWORD não definidos: nenhum admin inicial criado.");
    return;
  }
  if (adminPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD deve ter pelo menos 12 caracteres");
  }
  const existing = await storage.getUserByEmail(adminEmail);
  if (!existing) {
    const hashed = await bcrypt.hash(adminPassword, 12);
    await storage.createUser({ name: adminName, email: adminEmail, password: hashed, role: "admin" });
    console.log("[seed] Administrador inicial criado.");
  }
}

export { registerRoutes };
