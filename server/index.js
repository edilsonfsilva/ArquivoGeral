import express from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { ensureSchema } from "./db.js";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);
const isProd = process.env.NODE_ENV === "production";

app.disable("x-powered-by");
// Protótipo: não indexar em buscadores.
app.use((_req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});
// Atrás do proxy (Traefik/Nginx): IP real do cliente e cookie Secure funcionam.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 1));

app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          useDefaults: false,
          directives: {
            "default-src": ["'self'"],
            "base-uri": ["'self'"],
            "object-src": ["'none'"],
            "frame-ancestors": ["'none'"],
            "form-action": ["'self'"],
            "script-src": ["'self'"],
            // 'unsafe-inline' só para estilos: o Radix injeta <style> ao travar a rolagem de diálogos. Scripts seguem restritos.
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
            "img-src": ["'self'", "data:", "blob:"],
            "connect-src": ["'self'"],
            "manifest-src": ["'self'"],
            "upgrade-insecure-requests": []
          }
        }
      : false,
    strictTransportSecurity: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  })
);

// Corpo JSON: 8 MB só no envio público (anexo em base64); 100 KB no resto.
const jsonSmall = express.json({ limit: "100kb" });
const jsonLarge = express.json({ limit: "8mb" });
app.use((req, res, next) =>
  req.method === "POST" && req.path === "/api/requests" ? jsonLarge(req, res, next) : jsonSmall(req, res, next)
);
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

function log(message, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("pt-BR", { hour12: false });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Log de acesso SEM corpo de resposta (não grava CPF, e-mail, telefone etc.).
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
    }
  });
  next();
});

(async () => {
  await ensureSchema();
  await registerRoutes(httpServer, app);

  app.use((err, _req, res, next) => {
    const status = err.status || err.statusCode || 500;
    console.error("Erro:", status, err?.type || err?.code || "", err?.message);
    if (res.headersSent) return next(err);
    if (status === 413) return res.status(413).json({ message: "Conteúdo muito grande" });
    if (status >= 400 && status < 500 && err.expose) {
      return res.status(status).json({ message: "Requisição inválida" });
    }
    return res.status(500).json({ message: "Erro interno. Tente novamente." });
  });

  if (isProd) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite.js");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    log(`serving on port ${port}`);
  });
})().catch((err) => {
  console.error("Falha ao iniciar:", err?.message || err);
  process.exit(1);
});

export { log };
