import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcrypt";
import { storage } from "./storage.js";
const PgSession = connectPg(session);
async function registerRoutes(httpServer, app) {
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true
      }),
      secret: process.env.SESSION_SECRET || "tjpe-arquivo-geral-secret-key-2026",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 24 * 60 * 60 * 1e3,
        httpOnly: true,
        secure: false
      }
    })
  );
  await seedDefaultAdmin();
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "E-mail e senha s\xE3o obrigat\xF3rios" });
    }
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Credenciais inv\xE1lidas" });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Credenciais inv\xE1lidas" });
    }
    req.session.userId = user.id;
    req.session.userRole = user.role;
    return res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });
  app.get("/api/auth/me", async (req, res) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "N\xE3o autenticado" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "Usu\xE1rio n\xE3o encontrado" });
    }
    return res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });
  function requireAuth(req, res, next) {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "N\xE3o autenticado" });
    }
    next();
  }
  function requireAdmin(req, res, next) {
    if (req.session?.userRole !== "admin") {
      return res.status(403).json({ message: "Acesso negado" });
    }
    next();
  }
  app.post("/api/requests", async (req, res) => {
    try {
      const created = await storage.createRequest(req.body);
      return res.status(201).json(created);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  });
  app.get("/api/requests", requireAuth, async (_req, res) => {
    const reqs = await storage.getAllRequests();
    return res.json(reqs);
  });
  app.get("/api/requests/:id", requireAuth, async (req, res) => {
    const r = await storage.getRequest(Number(req.params.id));
    if (!r) return res.status(404).json({ message: "N\xE3o encontrado" });
    return res.json(r);
  });
  app.patch("/api/requests/:id", requireAuth, async (req, res) => {
    const updated = await storage.updateRequest(Number(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "N\xE3o encontrado" });
    return res.json(updated);
  });
  app.delete("/api/requests/:id", requireAuth, async (req, res) => {
    await storage.deleteRequest(Number(req.params.id));
    return res.json({ ok: true });
  });
  app.get("/api/requests/:id/observations", requireAuth, async (req, res) => {
    const obs = await storage.getObservationsByRequest(Number(req.params.id));
    return res.json(obs);
  });
  app.post("/api/requests/:id/observations", requireAuth, async (req, res) => {
    const { text } = req.body;
    const userId = req.session.userId;
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Usu\xE1rio n\xE3o encontrado" });
    const obs = await storage.createObservation({
      requestId: Number(req.params.id),
      text,
      authorName: user.name,
      authorRole: user.role
    });
    return res.status(201).json(obs);
  });
  app.get("/api/users", requireAuth, requireAdmin, async (_req, res) => {
    const users = await storage.getAllUsers();
    return res.json(users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })));
  });
  app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Nome, e-mail e senha s\xE3o obrigat\xF3rios" });
    }
    const existing = await storage.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "E-mail j\xE1 cadastrado" });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ name, email, password: hashed, role: role || "atendente" });
    return res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });
  app.patch("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;
    const data = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (role) data.role = role;
    if (password) data.password = await bcrypt.hash(password, 10);
    const updated = await storage.updateUser(Number(req.params.id), data);
    if (!updated) return res.status(404).json({ message: "N\xE3o encontrado" });
    return res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role });
  });
  app.delete("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
    await storage.deleteUser(Number(req.params.id));
    return res.json({ ok: true });
  });
  app.get("/api/dashboard", requireAuth, requireAdmin, async (_req, res) => {
    const stats = await storage.getDashboardStats();
    return res.json(stats);
  });
  return httpServer;
}
async function seedDefaultAdmin() {
  const existing = await storage.getUserByEmail("edilson.ferreira@tjpe.jus.br");
  if (!existing) {
    const hashed = await bcrypt.hash("MinhaSenha!@#", 10);
    await storage.createUser({
      name: "Edilson Ferreira",
      email: "edilson.ferreira@tjpe.jus.br",
      password: hashed,
      role: "admin"
    });
    console.log("Admin padr\xE3o criado: edilson.ferreira@tjpe.jus.br");
  }
}
export {
  registerRoutes
};
