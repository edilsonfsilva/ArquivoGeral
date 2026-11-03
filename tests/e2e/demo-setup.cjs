// Cria (de forma idempotente) uma conta de demonstração para cada perfil.
// Uso: node demo-setup.cjs <baseUrl> <gerente.json com ADMIN_EMAIL/ADMIN_PASSWORD> <saida-contas.json>
// O arquivo de saída guarda as senhas; se já existir, reaproveita as senhas dele. Nada é impresso com senha.
const fs = require("fs");
const { cliente, login, senhaForte } = require("./lib.cjs");

const [base, gerenteFile, outFile] = process.argv.slice(2);
const g = JSON.parse(fs.readFileSync(gerenteFile, "utf8"));
const anterior = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};

// [chave, nome, e-mail, perfil, matrícula, quem cria]
const CONTAS = [
  ["chefe_atendimento", "Carla Mendes (demo)", "chefe.atendimento@arquivo.demo", "chefe_atendimento", "100101", "gerente_arquivo"],
  ["chefe_busca", "Roberto Lima (demo)", "chefe.busca@arquivo.demo", "chefe_busca", "100201", "gerente_arquivo"],
  ["servidor_atendimento", "Paula Souza (demo)", "servidor.atendimento@arquivo.demo", "servidor_atendimento", "100102", "chefe_atendimento"],
  ["operador_atendimento", "Marcos Alves (demo)", "operador.atendimento@arquivo.demo", "operador_atendimento", "100103", "chefe_atendimento"],
  ["servidor_busca", "Juliana Rocha (demo)", "servidor.busca@arquivo.demo", "servidor_busca", "100202", "chefe_busca"],
  ["operador_busca", "Severino Costa (demo)", "operador.busca@arquivo.demo", "operador_busca", "100203", "chefe_busca"],
  ["operador_busca_2", "Antônio Neto (demo)", "operador2.busca@arquivo.demo", "operador_busca", "100204", "chefe_busca"]
];

(async () => {
  const call = cliente(base);
  const out = {
    base,
    gerente_arquivo: { email: g.ADMIN_EMAIL, password: g.ADMIN_PASSWORD, role: "gerente_arquivo", name: g.ADMIN_NAME || "Gerente" }
  };
  const sessoes = { gerente_arquivo: (await login(call, g.ADMIN_EMAIL, g.ADMIN_PASSWORD)).cookie };

  for (const [chave, name, email, role, matricula, criador] of CONTAS) {
    const password = anterior[chave]?.password || senhaForte();
    const cookie = sessoes[criador];
    const r = await call("POST", "/api/users", { cookie, body: { name, email, matricula, password, role } });
    if (r.status === 201) console.log(`criado   ${role.padEnd(22)} ${email}`);
    else if (r.status === 409) console.log(`existente ${role.padEnd(21)} ${email}`);
    else throw new Error(`${email}: ${r.status} ${r.json?.message}`);
    out[chave] = { email, password, role, name, matricula };
    // Garante que a senha do arquivo funciona (conta pré-existente sem senha conhecida → aborta).
    sessoes[chave] = (await login(call, email, password)).cookie;
  }
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`\n${Object.keys(out).length - 1} contas prontas. Senhas gravadas no arquivo de saída (não exibidas).`);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
