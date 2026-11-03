// Teste de fumaça (regressão da auditoria) contra o ambiente publicado. Uso: node smoke.cjs <baseUrl> <contas-demo.json>
const fs = require("fs");
const base = process.argv[2];
const contas = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const sec = { ADMIN_EMAIL: contas.gerente_arquivo.email, ADMIN_PASSWORD: contas.gerente_arquivo.password };
const proxy = base.startsWith("http://localhost") ? { "X-Forwarded-Proto": "https" } : {};
let pass = 0;
let fail = 0;
const ok = (cond, label, extra = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  -> " + extra : ""}`);
};

async function call(method, path, { body, cookie, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...proxy,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  const buf = Buffer.from(await res.arrayBuffer());
  let json = null;
  if (!raw) {
    try {
      json = JSON.parse(buf.toString("utf8"));
    } catch {}
  }
  return { res, json, buf };
}
const cookieOf = (res) => (res.headers.get("set-cookie") || "").split(";")[0];

// NPU válido e CPF válido para o teste
const npuBase = "0001234" + "20248170001";
const dv = 98 - Number(BigInt(npuBase + "00") % 97n);
const NPU = `0001234-${String(dv).padStart(2, "0")}.2024.8.17.0001`;
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const pedido = {
  nomeCompleto: "TESTE AUTOMATIZADO - apagar",
  cpf: "529.982.247-25",
  whatsapp: "(81) 99999-0000",
  email: "teste@example.com",
  tipoNumeracao: "npu",
  numeroProcesso: NPU,
  partes: "Teste vs Teste",
  comarca: "Recife",
  varaUnidade: "1ª Vara Cível",
  segredoJustica: "nao",
  anexo: { name: "procuracao-teste.pdf", type: "application/pdf", base64: pdf.toString("base64") }
};

(async () => {
  // 1. Saúde e cabeçalhos
  const h = await call("GET", "/api/health");
  ok(h.res.status === 200 && h.json?.status === "ok", "GET /api/health = 200");
  const home = await call("GET", "/", { raw: true });
  const hd = home.res.headers;
  ok(home.res.status === 200, "Página inicial = 200");
  ok(/default-src 'self'/.test(hd.get("content-security-policy") || ""), "CSP presente");
  ok(/max-age=31536000/.test(hd.get("strict-transport-security") || ""), "HSTS presente");
  ok(!hd.get("x-powered-by"), "Sem X-Powered-By");
  ok(hd.get("x-content-type-options") === "nosniff", "X-Content-Type-Options nosniff");
  ok(!/maximum-scale/.test(home.buf.toString()), "Zoom liberado (sem maximum-scale)");
  const nf = await call("GET", "/api/rota-inexistente");
  ok(nf.res.status === 404 && nf.json, "Rota /api inexistente = 404 JSON");

  // 2. Rotas protegidas sem login
  ok((await call("GET", "/api/requests")).res.status === 401, "Listar pedidos sem login = 401");

  // 3. Validação do formulário público
  const inval = await call("POST", "/api/requests", { body: { ...pedido, cpf: "111.111.111-11", anexo: null } });
  ok(inval.res.status === 400, "CPF inválido = 400", inval.json?.message);
  const extra = await call("POST", "/api/requests", { body: { ...pedido, anexo: null, status: "aprovado" } });
  ok(extra.res.status === 400, "Campo extra (status) no público = 400");
  const fake = await call("POST", "/api/requests", {
    body: { ...pedido, anexo: { name: "x.pdf", type: "application/pdf", base64: Buffer.from("MZ executável").toString("base64") } }
  });
  ok(fake.res.status === 400, "Anexo com conteúdo falso (não-PDF) = 400");
  const criado = await call("POST", "/api/requests", { body: pedido });
  ok(criado.res.status === 201 && /^AG-\d{6}$/.test(criado.json?.protocolId || ""), "Pedido válido com PDF = 201", criado.json?.protocolId);
  ok(criado.json && !("cpf" in criado.json), "Resposta pública não devolve dados pessoais");

  // 4. Login admin
  const badLogin = await call("POST", "/api/auth/login", { body: { email: sec.ADMIN_EMAIL, password: "errada-123" } });
  ok(badLogin.res.status === 401, "Login com senha errada = 401");
  const login = await call("POST", "/api/auth/login", { body: { email: sec.ADMIN_EMAIL, password: sec.ADMIN_PASSWORD } });
  const sc = login.res.headers.get("set-cookie") || "";
  ok(login.res.status === 200 && login.json?.role === "gerente_arquivo", "Login do Gerente = 200");
  ok(/HttpOnly/i.test(sc) && /Secure/i.test(sc) && /SameSite=Strict/i.test(sc), "Cookie HttpOnly + Secure + SameSite=Strict");
  const adm = cookieOf(login.res);

  const lista = await call("GET", "/api/requests", { cookie: adm });
  const meu = (lista.json || []).find((r) => r.protocolId === criado.json?.protocolId);
  ok(!!meu && !("anexoData" in meu), "Listagem traz o pedido e não traz o binário do anexo");

  // 5. Download do anexo
  const dl = await call("GET", `/api/requests/${meu?.id}/anexo`, { cookie: adm, raw: true });
  ok(dl.res.status === 200 && dl.res.headers.get("content-type") === "application/pdf" && dl.buf.equals(pdf), "Download do anexo devolve o PDF original");

  // 6. Atendente de teste
  const senhaAt = "Teste-" + Math.random().toString(36).slice(2) + "-9x";
  const emailAt = `atendente.teste.${Date.now()}@example.com`;
  const chefe = cookieOf((await call("POST", "/api/auth/login", { body: { email: contas.chefe_atendimento.email, password: contas.chefe_atendimento.password } })).res);
  const fraca = await call("POST", "/api/users", { cookie: chefe, body: { name: "Fraca", email: "f@example.com", matricula: "1", password: "123", role: "operador_atendimento" } });
  ok(fraca.res.status === 400, "Senha fraca rejeitada = 400");
  const at = await call("POST", "/api/users", { cookie: chefe, body: { name: "Atendente Teste", email: emailAt, matricula: "999", password: senhaAt, role: "operador_atendimento" } });
  ok(at.res.status === 201, "Chefe cria operador de atendimento = 201");
  const atLogin = await call("POST", "/api/auth/login", { body: { email: emailAt, password: senhaAt } });
  const atc = cookieOf(atLogin.res);
  ok(atLogin.res.status === 200, "Login atendente = 200");

  const p1 = await call("PATCH", `/api/requests/${meu?.id}`, { cookie: atc, body: { cpf: "000.000.000-00" } });
  ok(p1.res.status === 404, "Edição direta do pedido não existe (só ações do fluxo)");
  const p2 = await call("POST", `/api/requests/${meu?.id}/acoes`, { cookie: atc, body: { acao: "encaminhar_busca" } });
  ok(p2.res.status === 200 && p2.json?.status === "aguardando_busca", "Operador executa ação do fluxo = 200");
  const d1 = await call("DELETE", `/api/requests/${meu?.id}`, { cookie: atc });
  ok(d1.res.status === 403, "Atendente excluir pedido = 403 (bloqueado)");
  ok((await call("GET", "/api/users", { cookie: atc })).res.status === 403, "Atendente listar usuários = 403");
  const obs = await call("POST", `/api/requests/${meu?.id}/observations`, { cookie: atc, body: { text: "teste" } });
  ok(obs.res.status === 201 && obs.json?.authorName === "Atendente Teste", "Atendente registra observação = 201");

  // 7. Rebaixar/remover usuário: efeito imediato na sessão
  await call("PATCH", `/api/users/${at.json?.id}`, { cookie: chefe, body: { ativo: false } });
  ok((await call("GET", "/api/requests", { cookie: atc })).res.status === 401, "Sessão do usuário desativado perde acesso na hora");

  // 8. Proteções do admin
  const me = await call("GET", "/api/auth/me", { cookie: adm });
  const self = await call("PATCH", `/api/users/${me.json?.id}`, { cookie: adm, body: { ativo: false } });
  ok(self.res.status === 409, "Gerente não desativa a si mesmo = 409");
  const prot2 = await call("POST", `/api/requests/${meu?.id}/acoes`, { cookie: chefe, body: { acao: "receber", protocolId: "AG-000000" } });
  ok(prot2.res.status === 400, "Campos extras (protocolo) nas ações = 400");

  // 9. Limpeza
  const del = await call("DELETE", `/api/requests/${meu?.id}`, { cookie: adm });
  ok(del.res.status === 200, "Gerente exclui pedido de teste = 200");
  await call("POST", "/api/auth/logout", { cookie: adm });

  console.log(`\nResultado: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("ERRO no teste:", e.message);
  process.exit(2);
});
